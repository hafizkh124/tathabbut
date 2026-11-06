// Sends each claim to the check that fits it and returns one state per claim, with the evidence behind it.
// Order of authority: the specialist's own list (circulating_sayings) first, then the Quran text, then Dorar.
// Nothing here writes a verdict: a state is either the specialist's, the mushaf's wording, or Dorar's muhaddithun
// read through gradeMap.
import { normalizeArabic } from "./arabic";
import type { Claim } from "./claims";
import type { DorarResult } from "./dorar";
import type { Grade } from "./gradeMap";
import { alignedDistance, nearWord, selectRelevant, summarizeGrades, type GradedNarration, type GradeSummary } from "./hadithMatch";
import { citedNarration, isKnownBook } from "./citedBook";
import { rankAndFilterDorarResults } from "./hadithRanking";
import type { LookupOutcome } from "./lookup";
import type { QiraaVariant } from "./qiraat";
import { compareWithVerse, findVerseRuns, joinVerses, looksCopiedFromMushaf, searchForm, type VerseHit, type VerseScriptText, type WordingCheck } from "./quranCheck";
import { parseQuranReference, withoutReference } from "./quranReference";
import { BOOK_TITLES, matnQuery, parseHadithReference, sameHadith, type HadithReference, type NumberedHadith } from "./hadithReference";
import { looksLikeQuestion, type NotFoundReason } from "./notFoundReason";

import { STATES, stateOfVerse, type State } from "./states";
import { similarSaying, similarNarrations, type SimilarExpression } from "./similarExpressions";

export { STATES, stateOfVerse };
export type { State };

export interface SayingHit {
  id: number;
  text_ar: string;
  status: string;
  verdict: string;
  verdict_by: string;
  reference: string;
  correct_text: string | null;
  note: string | null;
  claimed_attribution: string | null;
  claimed_reference: string | null;
  score: number;
}

export interface ExternalUrls {
  quranCom?: string;
  quranpedia?: string;
  dorar?: string;
  shamela?: string;
}

/** One verse as the user sees it: where it is, its text, how the quote compares, and where to read it. */
export interface VerseView {
  surah: number;
  ayah: number;
  /** the last verse, when several are shown: a quote of consecutive verses, or the adjoining verse of a context cut */
  endAyah?: number;
  surahName: string;
  text: string;
  wording?: WordingCheck;
  externalUrls?: { quranCom: string; quranpedia: string };
}

export interface VerifiedClaim {
  /** Retrieved suggestions shown when nothing matched; never evidence for the claim's own state. */
  similarExpressions?: SimilarExpression[];
  claim: Claim;
  state: State;
  /** Dorar could not be asked (down, or an empty page twice): the claim was not checked, so the answer is not given
   *  or stored as "not found" (api/verify answers 503) */
  lookupFailed?: true;
  /** where the state comes from */
  basis: "specialist-list" | "quran" | "dorar" | "turath" | "none" | "kind";
  verse?: VerseView & { candidates?: VerseView[] };
  saying?: SayingHit & { externalUrls?: { dorar: string; shamela: string } };
  dorar?: {
    narrations: GradedNarration[];
    weakVariants?: GradedNarration[];
    /** the book the post names for this text, and its narration when Dorar has one from that book (citedBook.ts):
     *  shown first, with its own verdict; the state above still comes from all the narrations */
    cited?: { book: string; known: boolean; narration?: GradedNarration };
    summary: GradeSummary;
    origin?: string;
    externalUrls?: { dorar: string; shamela: string };
  };
  notes: string[];
  /** Why nothing was found, when it is known: the card says it in its own words (notFoundReason.ts). */
  reason?: NotFoundReason;
  /** The text found at the book and number the post named, when the number gave a hadith (hadithReference.ts). */
  reference?: { book: string; number: number; text: string };
  /** What the lookup saw, kept for the usage figures: Dorar's candidates and how many were this text. */
  diag?: { candidates: number; relevant: number; retried?: "typos" | "opening" };
}

export interface VerifyDeps {
  /** The verses at a surah and an ayah range (quran_verses). Without it a verse named by number is not looked up by it. */
  verseByReference?: (surah: number, from: number, to: number) => Promise<VerseHit[]>;
  /** The hadith at a book and number (hadith-api). Without it a hadith named by number is not looked up by it. */
  hadithByReference?: (ref: HadithReference) => Promise<NumberedHadith[]>;
  /** The verses whose stored translation holds a text in Urdu or English (migration 016): the last way for a Quran claim with no Arabic. */
  matchByTranslation?: (text: string, lang: "ur" | "en") => Promise<VerseHit[]>;
  matchVerses: (quoted: string) => Promise<VerseHit[]>;
  /** The verses inside a paste of several verses (match_verses_in_text). Without it such a paste is not split. */
  matchVersesInText?: (quoted: string) => Promise<VerseHit[]>;
  /** The stored Uthmani and IndoPak texts of verses (quran_verse_scripts). Without it quotes are compared with the
   *  standard text only. */
  verseScripts?: (keys: { surah: number; ayah: number }[]) => Promise<Map<string, VerseScriptText[]>>;
  /** The words of the other canonical readings (quran_qiraat). Without it a word of another reading is a misquote. */
  verseQiraat?: (keys: { surah: number; ayah: number }[]) => Promise<Map<string, QiraaVariant[]>>;
  matchSayings: (query: string) => Promise<SayingHit[]>;
  lookupDorar: (query: string) => Promise<LookupOutcome>;
}

/** Thresholds (word_similarity, 0–1) and the largest share of changed words still treated as "this verse, misquoted". */
const SAYING_MIN = 0.6;
/** How much of a list entry a translated claim's Arabic rendering must cover to count as that entry. */
const TRANSLATION_COVERAGE = 0.7;
const wordCount = (s: string) => searchForm(s).split(" ").filter(Boolean).length;
const VERSE_MIN = 0.6;
const VERSE_AS_HADITH_MIN = 0.85;
const MAX_VERSE_DISTANCE = 0.5;
/** A text the model did not call a verse is still a misquoted verse when it is this near one: one word changed in four, a score from 0.7.
 *  (Live case 2026-11-07: «إن الله مع الصابرون» scored 0.82 on 2:153 and 8:46, under the 0.85 for a hadith that is a verse, and was graded as hadith.) */
const VERSE_NEAR_MIN = 0.7;
const VERSE_NEAR_DISTANCE = 0.25;
const VERSE_NEAR_MIN_WORDS = 3;

const hasArabic = (s: string) => /[ء-ي]/.test(s);

/** The mushaf text shown with a result: in the script the quote was compared with, so its corrections read in place. */
const shownText = (v: VerseHit, wording: WordingCheck | undefined) => v.scripts?.find((s) => s.script === wording?.script)?.text ?? v.text_uthmani;

/** The verses with their stored scripts and the other readings' words, when they can be fetched; as they are otherwise
 *  (the standard Hafs text decides). */
async function withScripts(hits: VerseHit[], deps: VerifyDeps): Promise<VerseHit[]> {
  if (!hits.length) return hits;
  const keys = hits.map((h) => ({ surah: h.surah, ayah: h.ayah }));
  const [scripts, qiraat] = await Promise.all([
    deps.verseScripts ? deps.verseScripts(keys).catch(() => null) : null,
    deps.verseQiraat ? deps.verseQiraat(keys).catch(() => null) : null,
  ]);
  return hits.map((h) => {
    const k = `${h.surah}:${h.ayah}`;
    return { ...h, ...(scripts ? { scripts: scripts.get(k) ?? [] } : {}), ...(qiraat?.get(k)?.length ? { qiraat: qiraat.get(k) } : {}) };
  });
}

function verseView(v: VerseHit, wording: WordingCheck | undefined, lastAyah?: number): VerseView {
  const endAyah = lastAyah ?? wording?.contextContinuation?.endAyah;
  return {
    surah: v.surah,
    ayah: v.ayah,
    surahName: v.surah_name_ar,
    text: shownText(v, wording).replace(/﻿/g, "") + (wording?.contextContinuation ? ` ${wording.contextContinuation.text}` : ""),
    ...(endAyah ? { endAyah } : {}),
    wording,
    externalUrls: {
      quranCom: `https://quran.com/${v.surah}/${v.ayah}${lastAyah ? `-${lastAyah}` : ""}`,
      quranpedia: `https://quranpedia.net/quran/${v.surah}:${v.ayah}`,
    },
  };
}

function verseResult(
  claim: Claim,
  v: VerseHit,
  wording: WordingCheck | undefined,
  notes: string[],
  candidates?: VerseView[],
  lastAyah?: number,
): VerifiedClaim {
  return {
    claim,
    state: stateOfVerse(wording),
    basis: "quran",
    verse: { ...verseView(v, wording, lastAyah), ...(candidates && candidates.length > 1 ? { candidates } : {}) },
    notes,
  };
}

/** At most this many «هل تقصد؟» choices are offered, and none that fits clearly worse than the best one
 *  (live case 2026-10-04: «إن الله مع الصابرون» also drew a verse that shares only two of its four words). */
const MAX_CANDIDATES = 3;
const CANDIDATE_MARGIN = 0.2;
// Word edits alone tie «ولا → لا» with «الصلاة → الزنا». Compare the
// actual aligned text as well, without changing the scholarly wording check.

function characterDistance(quoted: string, correctText: string): number {
  const a = searchForm(quoted).replace(/\s/g, "");
  const b = searchForm(correctText).replace(/\s/g, "");
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length] / Math.max(a.length, b.length, 1);
}

/** The best verse for a quote, checked word by word; null when no verse is close enough to be "this verse".
 *  A phrase that sits in several verses (or fits one verse only roughly) gives the user the near ones to choose from. */
async function checkAsVerse(claim: Claim, deps: VerifyDeps, minScore: number, maxDistance = MAX_VERSE_DISTANCE): Promise<VerifiedClaim | null> {
  const quoted = claim.arabicSpan;
  if (quoted && !claim.queryIsTranslation) {
    const hits = await withScripts((await deps.matchVerses(quoted)).filter((h) => h.score >= minScore), deps);
    const ranked = hits
      .map((v) => ({ v, w: compareWithVerse(quoted, v) }))
      .filter((r) => r.w.distance <= maxDistance)
      // a near verse (not a claimed one) is a misquote of ONE word, spelt almost like the verse's («الصابرون» for «الصابرين»): a word added, left out or another word altogether is a hadith that begins like the verse («اللهم رب السماوات السبع» for «من رب السماوات السبع»)
      .filter((r) => maxDistance >= MAX_VERSE_DISTANCE || (r.w.diffs.length <= 1 && r.w.diffs.every((d) => d.op === "replaced" && nearWord(normalizeArabic(d.typed), normalizeArabic(d.correct)))))
      .map((r) => ({ ...r, characterDistance: characterDistance(quoted, r.w.correctText) }))
      .sort((a, b) => a.w.distance - b.w.distance || a.characterDistance - b.characterDistance || b.v.score - a.v.score);
    ranked.splice(0, ranked.length, ...ranked.filter((r) =>
      r.w.distance <= ranked[0].w.distance + CANDIDATE_MARGIN
      && r.characterDistance <= ranked[0].characterDistance
    ).slice(0, MAX_CANDIDATES));
    if (ranked.length) return verseResult(claim, ranked[0].v, ranked[0].w, [], ranked.map((r) => verseView(r.v, r.w)));
    return null;
  }
  // An Urdu/English rendering of a verse: we can show the verse, never judge the wording.
  if (claim.queryIsTranslation && hasArabic(claim.query)) {
    const [v] = (await deps.matchVerses(claim.query)).filter((h) => h.score >= minScore);
    if (v) return verseResult(claim, v, undefined, ["النص مترجم؛ لا يُحكم على لفظه، وتُعرض الآية للمقارنة"]);
  }
  return null;
}

/** A paste is looked at as several verses only from this many words. */
const RUNS_MIN_WORDS = 6;
/** For a claim not presented as Quran, the verses found must cover all but this share of its words. */
const RUNS_MAX_LEFT_OVER = 0.1;

/** One part of a claim's Arabic wording, checked on its own. */
const partOf = (claim: Claim, text: string): Claim => ({ ...claim, textAsWritten: text, arabicSpan: text, query: text });

/** How many verses a set of results shows. */
const versesShown = (rs: VerifiedClaim[]) => rs.reduce((n, r) => n + (r.verse ? (r.verse.endAyah ?? r.verse.ayah) - r.verse.ayah + 1 : 0), 0);

/**
 * A paste of several verses (src/lib/quranCheck.ts findVerseRuns): each run of consecutive verses is compared with the
 * quote as one text, so a changed word anywhere in it is still reported. A stretch between runs is checked as a verse
 * of its own (a verse quoted in part, a verse from elsewhere); if it is none, it is compared with the run before it
 * (or after it), where it shows as added words. One result per run or verse, in the order of the post; null when no
 * run is found. A claim not presented as Quran is split only when the verses cover nearly all of it.
 */
async function checkAsVerseRuns(claim: Claim, deps: VerifyDeps, minScore: number, presentedAsQuran: boolean): Promise<VerifiedClaim[] | null> {
  const quoted = claim.arabicSpan;
  if (!quoted || claim.queryIsTranslation || !deps.matchVersesInText || wordCount(quoted) < RUNS_MIN_WORDS) return null;
  // The search failing (migration 008 not applied, the database unreachable) leaves the one-verse result as it was.
  const inText = await deps.matchVersesInText(quoted).catch(() => null);
  if (!inText) return null;
  const segments = findVerseRuns(quoted, await withScripts(inText, deps));
  if (!segments.some((s) => s.kind === "run")) return null;

  type Part = { start: number; end: number; verses?: VerseHit[]; result?: VerifiedClaim };
  const parts: Part[] = [];
  for (const s of segments) {
    if (s.kind === "run") parts.push({ start: s.start, end: s.end, verses: s.verses });
    else {
      const text = quoted.slice(s.start, s.end);
      const alone = wordCount(text) >= 2 ? await checkAsVerse(partOf(claim, text), deps, minScore) : null;
      parts.push({ start: s.start, end: s.end, ...(alone ? { result: alone } : {}) });
    }
  }
  // Words that are no verse join the run beside them: compared with it, they show as added words, never dropped.
  let leftOver = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.verses || p.result) continue;
    const run = parts[i - 1]?.verses ? parts[i - 1] : parts[i + 1]?.verses ? parts[i + 1] : undefined;
    leftOver += wordCount(quoted.slice(p.start, p.end));
    if (run) {
      run.start = Math.min(run.start, p.start);
      run.end = Math.max(run.end, p.end);
      parts.splice(i--, 1);
    }
  }
  if (!presentedAsQuran && leftOver > RUNS_MAX_LEFT_OVER * wordCount(quoted)) return null;

  const whole = parts.length === 1;
  return parts.map((p): VerifiedClaim => {
    const text = quoted.slice(p.start, p.end);
    if (p.result) return p.result;
    if (!p.verses) return { claim: partOf(claim, text), state: STATES.notFound, basis: "none", notes: ["لم يُعثر على آية مطابقة لهذا الجزء"] };
    const span = joinVerses(p.verses);
    const last = p.verses[p.verses.length - 1].ayah;
    return verseResult(whole ? claim : partOf(claim, text), span, compareWithVerse(text, span), [], undefined, p.verses.length > 1 ? last : undefined);
  });
}

/**
 * The verse check for a claim: one verse first; when that finds nothing, or a verse that does not fit exactly, the
 * quote is looked at as several verses, and that reading is kept when the one-verse check found nothing or when it
 * finds more than one verse. A claim not presented as Quran is looked at as several verses only when it was copied
 * from a mushaf (verse numbers «﴿١﴾» or the Uthmani script's signs), so ordinary hadith do not cost a second search.
 */
async function checkQuran(claim: Claim, deps: VerifyDeps, minScore: number, presentedAsQuran: boolean): Promise<VerifiedClaim[] | null> {
  const single = await checkAsVerse(claim, deps, minScore);
  if (single?.verse?.wording?.exact) return [single];
  if (!presentedAsQuran && !(claim.arabicSpan && looksCopiedFromMushaf(claim.arabicSpan))) return single ? [single] : null;
  const runs = await checkAsVerseRuns(claim, deps, minScore, presentedAsQuran);
  if (runs && (!single || versesShown(runs) > 1)) return runs;
  return single ? [single] : null;
}

function fromSaying(claim: Claim, s: SayingHit): VerifiedClaim {
  const query = encodeURIComponent(s.text_ar);
  return {
    claim,
    state: s.status,
    basis: "specialist-list",
    saying: {
      ...s,
      externalUrls: {
        dorar: `https://dorar.net/hadith/search?q=${query}`,
        shamela: `https://shamela.ws/search?q=${query}`,
      },
    },
    notes: [],
  };
}

/** The first result for a claim (a paste of verses from several places gives more: see verifyClaimParts). */
export async function verifyClaim(claim: Claim, deps: VerifyDeps): Promise<VerifiedClaim> {
  return (await verifyClaimParts(claim, deps))[0];
}

// ---------- a verse or a hadith named by its number ----------

/** What reading the number a post names gave: the finished results, or only notes (and what the usual way should know). */
interface ViaReference {
  results?: VerifiedClaim[];
  notes: string[];
  /** the book and number as Dorar prints them, so the narration of that book is shown first */
  citedBook?: string;
  /** the post named a hadith by number, and no text was read at it */
  unresolved?: true;
}

const exactWording = (v: VerseHit): WordingCheck => ({ exact: true, correctText: v.text_uthmani, diffs: [], distance: 0 });
const placeOf = (r: { surah: number; from: number; to: number }) => `${r.surah}:${r.from}${r.to > r.from ? `-${r.to}` : ""}`;

/**
 * A verse named by surah and ayah is looked up by its number (quran_verses). A quoted text is compared with that verse
 * (a verse that is not the one quoted sends the claim back to the usual way, with a note); a number alone, or a number
 * with a translation, shows the verse.
 */
async function viaQuranReference(claim: Claim, deps: VerifyDeps): Promise<ViaReference> {
  if (!deps.verseByReference) return { notes: [] };
  const ref = parseQuranReference(`${claim.citedSource ?? ""} ${claim.textAsWritten}`, { kind: claim.kind });
  if (!ref) return { notes: [] };
  const found = await deps.verseByReference(ref.surah, ref.from, ref.to).catch(() => [] as VerseHit[]);
  const where = placeOf(ref);
  if (!found.length) return { notes: [`لم يُعثر على آية بالرقم المذكور (${where})`] };
  const verses = await withScripts(found, deps);
  const span = verses.length > 1 ? joinVerses(verses) : verses[0];
  const last = verses.length > 1 ? verses[verses.length - 1].ayah : undefined;
  const quoted = claim.arabicSpan && !claim.queryIsTranslation && wordCount(claim.arabicSpan) >= 2 ? claim.arabicSpan : null;
  if (quoted) {
    const wording = compareWithVerse(quoted, span);
    if (wording.distance <= MAX_VERSE_DISTANCE) return { results: [verseResult(claim, span, wording, [`الآية بحسب الرقم المذكور (${where})`], undefined, last)], notes: [] };
    return { notes: [`النص المقتبس لا يطابق الآية ${where} المذكورة؛ جرى البحث عنه بالطريقة المعتادة`] };
  }
  // a number alone, or a number beside a translation: the verse is shown; a translation's wording is never judged
  const translated = (claim.language === "ur" || claim.language === "en") && wordCount(withoutReference(claim.textAsWritten, ref)) >= 8;
  const note = translated ? `النص مترجم؛ لا يُحكم على لفظه، وتُعرض الآية بحسب الرقم المذكور (${where})` : `الآية بحسب الرقم المذكور (${where})`;
  return { results: [verseResult(claim, span, translated ? undefined : exactWording(span), [note], undefined, last)], notes: [] };
}

/** How much of a post's own text the hadith at its number must have for the number to be taken as that text's place. */
const SAME_HADITH_MIN = 0.5;

/**
 * A hadith named by book and number is read at that number (hadith-api). If the post also gives the text, the text must
 * be the hadith found there: then the usual check goes on with that book's narration shown first; a different text
 * leaves the usual way alone, with a note. If it gives no text, the text found there is searched in Dorar for its
 * verdict. A number that gives nothing leaves the claim to the usual way.
 */
async function viaHadithReference(claim: Claim, deps: VerifyDeps): Promise<ViaReference> {
  if (!deps.hadithByReference || claim.kind === "quran") return { notes: [] };
  const ref = parseHadithReference(`${claim.citedSource ?? ""} ${claim.textAsWritten}`);
  if (!ref) return { notes: [] };
  const title = `${BOOK_TITLES[ref.book]} ${ref.number}`;
  const found = await deps.hadithByReference(ref).catch(() => [] as NumberedHadith[]);
  if (!found.length) return { notes: [`لم يُقرأ نص بالرقم المذكور (${title})؛ جرى البحث بالطريقة المعتادة`], unresolved: true };

  const ownText = claim.query && wordCount(claim.query) >= 4 && (claim.arabicSpan || (claim.queryIsTranslation && hasArabic(claim.query))) ? claim.query : null;
  if (ownText) {
    const best = found.map((h) => ({ h, score: sameHadith(ownText, h.text) ?? 0 })).sort((a, b) => b.score - a.score)[0];
    if (best.score >= SAME_HADITH_MIN) return { notes: [`النص موافق للحديث المقروء بالرقم المذكور (${title})`], citedBook: title };
    return { notes: [`النص لا يوافق الحديث المقروء بالرقم المذكور (${title})؛ جرى البحث عنه بالطريقة المعتادة`] };
  }

  const hadith = found[0];
  const derived: Claim = { ...claim, query: matnQuery(hadith.text), queryIsTranslation: true };
  const result = await checkInDorar(derived, deps, [], [`الحديث مقروء بالرقم المذكور (${title})`], title);
  const reference = { book: BOOK_TITLES[ref.book], number: ref.number, text: hadith.text.slice(0, 1_500) };
  if (result.lookupFailed) return { results: [result], notes: [] };
  if (result.state !== STATES.notFound) return { results: [{ ...result, reference }], notes: [] };
  return { results: [{ ...result, reason: "reference-no-grade", reference }], notes: [] };
}

/** The results for a claim: one, or one per verse or run of verses when the claim quotes verses from several places. */
export async function verifyClaimParts(claim: Claim, deps: VerifyDeps): Promise<VerifiedClaim[]> {
  if (claim.kind === "question") return verifyClaimPartsCore(claim, deps, {});
  // A verse or a hadith named by its number is looked up by it first; when the number gives nothing that fits, the
  // claim goes the usual way (the team lead's rule, 2026-11-07), and what the number said is kept as a note.
  const notes: string[] = [];
  const ctx: CoreContext = {};
  for (const via of claim.kind === "quran" ? [viaQuranReference, viaHadithReference] : [viaHadithReference, viaQuranReference]) {
    const r = await via(claim, deps);
    if (r.results) return r.results;
    notes.push(...r.notes);
    if (r.citedBook) ctx.citedBook = r.citedBook;
    if (r.unresolved) ctx.referenceUnresolved = true;
  }
  const results = await verifyClaimPartsCore(claim, deps, ctx);
  return notes.length ? results.map((x) => ({ ...x, notes: [...x.notes, ...notes] })) : results;
}

interface CoreContext {
  /** the book and number the post named, found to be this text's place: shown first among Dorar's narrations */
  citedBook?: string;
  referenceUnresolved?: boolean;
}

/** Words of a long text's opening that Dorar is searched with when the whole text found nothing. */
const OPENING_WORDS = 8;
/** A long text found by its opening may differ from the narration by this much of its words (alignedDistance). */
const MAX_OPENING_DISTANCE = 0.4;
const NOTE_TYPOS = "عُثر على النص مع تجاوز أخطاء إملائية في كتابته";
const NOTE_OPENING = "بُحث بمطلع النص لطوله";

/**
 * Dorar for a text: its nearest narrations that are this text, graded by the muhaddithun. A text that finds none is
 * looked at once more: with a word or two misspelt (the same narrations, compared with a letter of leeway), and, when
 * long, by its opening (a second search) with the whole text still having to be mostly in the narration.
 */
async function checkInDorar(claim: Claim, deps: VerifyDeps, nearbySayings: SimilarExpression[], notes: string[] = [], citedOverride?: string): Promise<VerifiedClaim> {
  const looked = await deps.lookupDorar(claim.query);
  if (!looked.ok) return { claim, state: STATES.notFound, basis: "none", lookupFailed: true, notes: [`تعذّر البحث في الدرر (${looked.error})`], similarExpressions: nearbySayings };
  let found = looked.results;
  let rawNarrations = selectRelevant(claim.query, found);
  let retried: "typos" | "opening" | undefined;
  if (!rawNarrations.length) {
    const typos = selectRelevant(claim.query, found, 0.6, { typos: true });
    if (typos.length) {
      rawNarrations = typos;
      retried = "typos";
      notes = [...notes, NOTE_TYPOS];
    }
  }
  if (!rawNarrations.length && wordCount(claim.query) > OPENING_WORDS + 2) {
    const opening = searchForm(claim.query).split(" ").slice(0, OPENING_WORDS).join(" ");
    const second = await deps.lookupDorar(opening);
    if (second.ok) {
      // the opening must stand in the narration word for word, and the whole text must be near it (a different hadith never begins the same and goes on the same)
      const part = selectRelevant(opening, second.results).filter((n) => n.matchedBy === "contained" && (alignedDistance(claim.query, n.matn) ?? 1) <= MAX_OPENING_DISTANCE);
      if (part.length) {
        rawNarrations = part;
        found = second.results;
        retried = "opening";
        notes = [...notes, NOTE_OPENING];
      }
    }
  }
  const diag = { candidates: found.length, relevant: rawNarrations.length, ...(retried ? { retried } : {}) };
  if (!rawNarrations.length) {
    // Nothing matched: up to three retrieved near texts as suggestions, each with its own source and verdict.
    const seen = new Set<string>();
    const similarExpressions = [...nearbySayings, ...similarNarrations(claim.query, found)].filter((x) => {
      const key = searchForm(x.text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
    const reason: NotFoundReason | undefined = looksLikeQuestion(claim.textAsWritten) ? "question" : claim.kind === "other" && !claim.attributedTo && !claim.citedSource ? "unattributed" : undefined;
    return { claim, state: STATES.notFound, basis: "none", notes: [...notes, "لا رواية مطابقة في الدرر"], similarExpressions, diag, ...(reason ? { reason } : {}) };
  }
  const ranked = rankAndFilterDorarResults(claim.query, rawNarrations);
  const summary = summarizeGrades(rawNarrations);
  const citedBook = (citedOverride ?? claim.citedSource)?.trim();
  const citedHit = citedBook ? citedNarration(citedBook, [ranked.allRanked, ranked.weakVariants]) : null;
  const encodedQuery = encodeURIComponent(claim.query);
  return {
    claim,
    state: summary.grade as Grade,
    basis: "dorar",
    dorar: {
      narrations: ranked.allRanked,
      weakVariants: ranked.weakVariants.length > 0 ? ranked.weakVariants : undefined,
      ...(citedBook ? { cited: { book: citedBook, known: isKnownBook(citedBook), ...(citedHit ? { narration: citedHit } : {}) } } : {}),
      summary,
      origin: looked.origin,
      externalUrls: {
        dorar: `https://dorar.net/hadith/search?q=${encodedQuery}`,
        shamela: `https://shamela.ws/search?q=${encodedQuery}`,
      },
    },
    notes,
    diag,
  };
}

async function verifyClaimPartsCore(claim: Claim, deps: VerifyDeps, ctx: CoreContext): Promise<VerifiedClaim[]> {
  if (claim.kind === "question") {
    // A general question with a usable topic is shown as fiqh (the books answer it, the screen asks them); a personal case, or
    // a general one the model could not give a topic for, is a referral. In doubt it is personal (specialist's rule).
    const general = claim.scope === "general" && Boolean(claim.topic);
    return [{ claim, state: general ? STATES.fiqh : STATES.fatwa, basis: "kind", notes: [general ? "سؤال فقهي عام: أقوال المذاهب" : "سؤال عن حكم أو حالة: يُحال إلى أهل العلم"] }];
  }

  // Urdu is written in Arabic script too, so "has Arabic letters" is not enough: search only with the post's
  // Arabic wording, or with the model's Arabic rendering of an Urdu/English claim.
  const canSearch = Boolean(claim.arabicSpan) || (claim.queryIsTranslation && hasArabic(claim.query));
  // A claimed verse must never receive a hadith grade through a fuzzy saying match.
  if (claim.kind === "quran") {
    const verses = await checkQuran(claim, deps, VERSE_MIN, true);
    if (verses) return verses;
    // a translation of a verse with no Arabic wording: the stored translations are searched (the posts that copy the translator's words)
    if (deps.matchByTranslation && !claim.arabicSpan && (claim.language === "ur" || claim.language === "en")) {
      const [hit] = await deps.matchByTranslation(claim.textAsWritten, claim.language).catch(() => [] as VerseHit[]);
      if (hit) return [verseResult(claim, (await withScripts([hit], deps))[0], undefined, ["النص مترجم؛ لا يُحكم على لفظه، وتُعرض الآية للمقارنة"])];
    }
    return [{ claim, state: STATES.notFound, basis: "none", notes: ["لم يُعثر على آية مطابقة؛ لم يُحكم على النص بوصفه حديثا"] }];
  }
  // 1) the specialist's own list
  let nearbySayings: SimilarExpression[] = [];
  if (canSearch) {
    const hits = await deps.matchSayings(claim.query);
    nearbySayings = hits.filter((h) => h.score >= 0.5 && h.score < SAYING_MIN && h.text_ar.length <= 1500).slice(0, 3).map(similarSaying);
    // A translated claim is matched to an entry only when its Arabic rendering covers most of the entry: a model may render
    // a fragment («الحمية رأس الدواء» for a different Urdu proverb), and a fragment is a suggestion, not the entry itself.
    const covers = (h: SayingHit) => !claim.queryIsTranslation || wordCount(claim.query) >= TRANSLATION_COVERAGE * wordCount(h.text_ar);
    for (const h of hits) if (h.score >= SAYING_MIN && !covers(h) && nearbySayings.length < 3) nearbySayings.push(similarSaying(h));
    const [s] = hits.filter((h) => h.score >= SAYING_MIN && covers(h));
    if (s && (claim.kind !== "scholar_quote" || s.claimed_attribution)) return [fromSaying(claim, s)];
  }
  // A scholar's saying that is not in the specialist's list is still looked up: Dorar and the hadith books record the
  // sayings of many scholars, and its muhaddith's words are shown as they are (specialist's decision, 2026-10-04).

  // 2) the Quran: a claimed verse, or an Arabic text that is in fact a verse
  if (claim.arabicSpan && !claim.queryIsTranslation) {
    const rs = await checkQuran(claim, deps, VERSE_AS_HADITH_MIN, false);
    if (rs) return rs.map((r) => ({ ...r, notes: [...r.notes, "النص آية من القرآن وليس حديثا"] }));
    // a verse with one word changed is a misquoted verse, whatever the model called it
    const near = wordCount(claim.arabicSpan) >= VERSE_NEAR_MIN_WORDS ? await checkAsVerse(claim, deps, VERSE_NEAR_MIN, VERSE_NEAR_DISTANCE) : null;
    if (near) return [{ ...near, notes: [...near.notes, "النص آية من القرآن وليس حديثا"] }];
  }

  // 3) Dorar
  if (!canSearch) {
    const reason: NotFoundReason = looksLikeQuestion(claim.textAsWritten) ? "question" : ctx.referenceUnresolved || isKnownBook(claim.citedSource) || parseHadithReference(`${claim.citedSource ?? ""} ${claim.textAsWritten}`) ? "reference" : "no-arabic";
    return [{ claim, state: STATES.notFound, basis: "none", notes: ["لا نص عربي يمكن البحث به"], reason }];
  }
  return [await checkInDorar(claim, deps, nearbySayings, [], ctx.citedBook)];
}

/** Verifies all claims of a post, a few at a time (Dorar is reached through one relay), in the post's order; a claim
 *  quoting verses from several places gives one result per verse or run of verses. */
export async function verifyClaims(claims: Claim[], deps: VerifyDeps, concurrency = 3): Promise<VerifiedClaim[]> {
  const out: VerifiedClaim[][] = new Array(claims.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, claims.length) }, async () => {
      while (next < claims.length) {
        const i = next++;
        out[i] = await verifyClaimParts(claims[i], deps);
      }
    }),
  );
  return out.flat();
}

export type { DorarResult };
