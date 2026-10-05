// Sends each claim to the check that fits it and returns one state per claim, with the evidence behind it.
// Order of authority: the specialist's own list (circulating_sayings) first, then the Quran text, then Dorar.
// Nothing here writes a verdict: a state is either the specialist's, the mushaf's wording, or Dorar's muhaddithun
// read through gradeMap.
import type { Claim } from "./claims";
import type { DorarResult } from "./dorar";
import type { Grade } from "./gradeMap";
import { selectRelevant, summarizeGrades, type GradedNarration, type GradeSummary } from "./hadithMatch";
import { rankAndFilterDorarResults } from "./hadithRanking";
import type { LookupOutcome } from "./lookup";
import { compareWithVerse, searchForm, type VerseHit, type WordingCheck } from "./quranCheck";

import { STATES, stateOfVerse, type State } from "./states";

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
  surahName: string;
  text: string;
  wording?: WordingCheck;
  externalUrls?: { quranCom: string; quranpedia: string };
}

export interface VerifiedClaim {
  claim: Claim;
  state: State;
  /** where the state comes from */
  basis: "specialist-list" | "quran" | "dorar" | "turath" | "none" | "kind";
  verse?: VerseView & { candidates?: VerseView[] };
  saying?: SayingHit & { externalUrls?: { dorar: string; shamela: string } };
  dorar?: {
    narrations: GradedNarration[];
    weakVariants?: GradedNarration[];
    summary: GradeSummary;
    origin?: string;
    externalUrls?: { dorar: string; shamela: string };
  };
  notes: string[];
}

export interface VerifyDeps {
  matchVerses: (quoted: string) => Promise<VerseHit[]>;
  matchSayings: (query: string) => Promise<SayingHit[]>;
  lookupDorar: (query: string) => Promise<LookupOutcome>;
}

/** Thresholds (word_similarity, 0–1) and the largest share of changed words still treated as "this verse, misquoted". */
const SAYING_MIN = 0.6;
const VERSE_MIN = 0.6;
const VERSE_AS_HADITH_MIN = 0.85;
const MAX_VERSE_DISTANCE = 0.5;

const hasArabic = (s: string) => /[ء-ي]/.test(s);

function verseView(v: VerseHit, wording: WordingCheck | undefined): VerseView {
  return {
    surah: v.surah,
    ayah: v.ayah,
    surahName: v.surah_name_ar,
    text: v.text_uthmani.replace(/﻿/g, ""),
    wording,
    externalUrls: {
      quranCom: `https://quran.com/${v.surah}/${v.ayah}`,
      quranpedia: `https://quranpedia.net/quran/${v.surah}:${v.ayah}`,
    },
  };
}

function verseResult(claim: Claim, v: VerseHit, wording: WordingCheck | undefined, notes: string[], candidates?: VerseView[]): VerifiedClaim {
  return {
    claim,
    state: stateOfVerse(wording),
    basis: "quran",
    verse: { ...verseView(v, wording), ...(candidates && candidates.length > 1 ? { candidates } : {}) },
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
async function checkAsVerse(claim: Claim, deps: VerifyDeps, minScore: number): Promise<VerifiedClaim | null> {
  const quoted = claim.arabicSpan;
  if (quoted && !claim.queryIsTranslation) {
    const hits = (await deps.matchVerses(quoted)).filter((h) => h.score >= minScore);
    const ranked = hits
      .map((v) => ({ v, w: compareWithVerse(quoted, v) }))
      .filter((r) => r.w.distance <= MAX_VERSE_DISTANCE)
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

export async function verifyClaim(claim: Claim, deps: VerifyDeps): Promise<VerifiedClaim> {
  if (claim.kind === "question") {
    // A general question with a usable topic is shown as fiqh (the books answer it, the screen asks them); a personal case, or
    // a general one the model could not give a topic for, is a referral. In doubt it is personal (specialist's rule).
    const general = claim.scope === "general" && Boolean(claim.topic);
    return { claim, state: general ? STATES.fiqh : STATES.fatwa, basis: "kind", notes: [general ? "سؤال فقهي عام: أقوال المذاهب" : "سؤال عن حكم أو حالة: يُحال إلى أهل العلم"] };
  }

  // Urdu is written in Arabic script too, so "has Arabic letters" is not enough: search only with the post's
  // Arabic wording, or with the model's Arabic rendering of an Urdu/English claim.
  const canSearch = Boolean(claim.arabicSpan) || (claim.queryIsTranslation && hasArabic(claim.query));
  // A claimed verse must never receive a hadith grade through a fuzzy saying match.
  if (claim.kind === "quran") {
    const verse = await checkAsVerse(claim, deps, VERSE_MIN);
    return verse ?? { claim, state: STATES.notFound, basis: "none", notes: ["لم يُعثر على آية مطابقة؛ لم يُحكم على النص بوصفه حديثا"] };
  }
  // 1) the specialist's own list
  if (canSearch) {
    const [s] = (await deps.matchSayings(claim.query)).filter((h) => h.score >= SAYING_MIN);
    if (s && (claim.kind !== "scholar_quote" || s.claimed_attribution)) return fromSaying(claim, s);
  }
  // A scholar's saying that is not in the specialist's list is still looked up: Dorar and the hadith books record the
  // sayings of many scholars, and its muhaddith's words are shown as they are (specialist's decision, 2026-10-04).

  // 2) the Quran: a claimed verse, or an Arabic text that is in fact a verse
  if (claim.arabicSpan && !claim.queryIsTranslation) {
    const r = await checkAsVerse(claim, deps, VERSE_AS_HADITH_MIN);
    if (r) return { ...r, notes: [...r.notes, "النص آية من القرآن وليس حديثا"] };
  }

  // 3) Dorar
  if (!canSearch) return { claim, state: STATES.notFound, basis: "none", notes: ["لا نص عربي يمكن البحث به"] };
  const looked = await deps.lookupDorar(claim.query);
  if (!looked.ok) return { claim, state: STATES.notFound, basis: "none", notes: [`تعذّر البحث في الدرر (${looked.error})`] };
  const rawNarrations = selectRelevant(claim.query, looked.results);
  const notes: string[] = [];
  if (!rawNarrations.length) return { claim, state: STATES.notFound, basis: "none", notes: [...notes, "لا رواية مطابقة في الدرر"] };
  const ranked = rankAndFilterDorarResults(claim.query, rawNarrations);
  const summary = summarizeGrades(rawNarrations);
  const encodedQuery = encodeURIComponent(claim.query);
  return {
    claim,
    state: summary.grade as Grade,
    basis: "dorar",
    dorar: {
      narrations: ranked.allRanked,
      weakVariants: ranked.weakVariants.length > 0 ? ranked.weakVariants : undefined,
      summary,
      origin: looked.origin,
      externalUrls: {
        dorar: `https://dorar.net/hadith/search?q=${encodedQuery}`,
        shamela: `https://shamela.ws/search?q=${encodedQuery}`,
      },
    },
    notes,
  };
}

/** Verifies all claims of a post, a few at a time (Dorar is reached through one relay). */
export async function verifyClaims(claims: Claim[], deps: VerifyDeps, concurrency = 3): Promise<VerifiedClaim[]> {
  const out: VerifiedClaim[] = new Array(claims.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, claims.length) }, async () => {
      while (next < claims.length) {
        const i = next++;
        out[i] = await verifyClaim(claims[i], deps);
      }
    }),
  );
  return out;
}

export type { DorarResult };
