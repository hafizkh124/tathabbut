// Sends each claim to the check that fits it and returns one state per claim, with the evidence behind it.
// Order of authority: the specialist's own list (circulating_sayings) first, then the Quran text, then Dorar.
// Nothing here writes a verdict: a state is either the specialist's, the mushaf's wording, or Dorar's muhaddithun
// read through gradeMap.
import type { Claim } from "./claims";
import { normalizeArabic } from "./arabic";
import type { DorarResult } from "./dorar";
import { NOT_FOUND_STATE, type Grade } from "./gradeMap";
import { selectRelevant, summarizeGrades, type GradedNarration, type GradeSummary, type TurathLookupOutcome } from "./hadithMatch";
import type { LookupOutcome } from "./lookup";
import { compareWithVerse, type VerseHit, type WordingCheck } from "./quranCheck";

export const STATES = {
  maqbul: "مقبول",
  daif: "ضعيف",
  shadid: "شديد الضعف أو لا أصل له",
  unsure: "غير حاسم",
  verseOk: "آية صحيحة النقل",
  verseWrong: "آية منقولة بخطأ",
  verseTranslated: "آية (نص مترجم)",
  notFound: NOT_FOUND_STATE,
  fatwa: "فتوى أو حالة شخصية — إحالة",
} as const;
export type State = (typeof STATES)[keyof typeof STATES] | string; // + the specialist's own statuses from circulating_sayings

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

export interface VerifiedClaim {
  claim: Claim;
  state: State;
  /** where the state comes from */
  basis: "specialist-list" | "quran" | "dorar" | "none" | "kind";
  verse?: { surah: number; ayah: number; surahName: string; text: string; wording?: WordingCheck; externalUrls?: { quranCom: string; quranpedia: string } };
  saying?: SayingHit & { externalUrls?: { dorar: string; shamela: string } };
  dorar?: { narrations: GradedNarration[]; summary: GradeSummary; origin?: string; externalUrls?: { dorar: string; shamela: string } };
  /** Supporting library references only; these never affect state or Dorar grading. */
  turath?: TurathLookupOutcome;
  notes: string[];
}

export interface VerifyDeps {
  matchVerses: (quoted: string) => Promise<VerseHit[]>;
  matchSayings: (query: string) => Promise<SayingHit[]>;
  lookupDorar: (query: string) => Promise<LookupOutcome>;
  lookupTurath: (query: string) => Promise<TurathLookupOutcome>;
}

/** Thresholds (word_similarity, 0–1) and the largest share of changed words still treated as "this verse, misquoted". */
const SAYING_MIN = 0.6;
const VERSE_MIN = 0.6;
const VERSE_AS_HADITH_MIN = 0.85;
const MAX_VERSE_DISTANCE = 0.5;

const hasArabic = (s: string) => /[ء-ي]/.test(s);

function verseResult(claim: Claim, v: VerseHit, wording: WordingCheck | undefined, notes: string[]): VerifiedClaim {
  const state = !wording ? STATES.verseTranslated : wording.exact ? STATES.verseOk : STATES.verseWrong;
  return {
    claim,
    state,
    basis: "quran",
    verse: {
      surah: v.surah,
      ayah: v.ayah,
      surahName: v.surah_name_ar,
      text: v.text_uthmani.replace(/﻿/g, ""),
      wording,
      externalUrls: {
        quranCom: `https://quran.com/${v.surah}/${v.ayah}`,
        quranpedia: `https://quranpedia.net/quran/${v.surah}:${v.ayah}`,
      },
    },
    notes,
  };
}

/** The best verse for a quote, checked word by word; null when no verse is close enough to be "this verse". */
async function checkAsVerse(claim: Claim, deps: VerifyDeps, minScore: number): Promise<VerifiedClaim | null> {
  const quoted = claim.arabicSpan;
  if (quoted && !claim.queryIsTranslation) {
    const hits = (await deps.matchVerses(quoted)).filter((h) => h.score >= minScore);
    let best: { v: VerseHit; w: WordingCheck } | null = null;
    for (const v of hits) {
      const w = compareWithVerse(quoted, v);
      if (!best || w.distance < best.w.distance) best = { v, w };
      if (w.exact) break;
    }
    if (best && best.w.distance <= MAX_VERSE_DISTANCE) return verseResult(claim, best.v, best.w, []);
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

async function verifyClaimWithoutTurath(claim: Claim, deps: VerifyDeps): Promise<VerifiedClaim> {
  if (claim.kind === "question") return { claim, state: STATES.fatwa, basis: "kind", notes: ["سؤال عن حكم أو حالة: يُحال إلى أهل العلم"] };

  // Urdu is written in Arabic script too, so "has Arabic letters" is not enough: search only with the post's
  // Arabic wording, or with the model's Arabic rendering of an Urdu/English claim.
  const canSearch = Boolean(claim.arabicSpan) || (claim.queryIsTranslation && hasArabic(claim.query));
  // 1) the specialist's own list
  if (canSearch) {
    const [s] = (await deps.matchSayings(claim.query)).filter((h) => h.score >= SAYING_MIN);
    if (s && (claim.kind !== "scholar_quote" || s.claimed_attribution)) return fromSaying(claim, s);
  }
  if (claim.kind === "scholar_quote") {
    return { claim, state: STATES.notFound, basis: "none", notes: ["أقوال العلماء تُتحقق من قائمة المختص فقط، وهذا القول ليس فيها"] };
  }

  // 2) the Quran: a claimed verse, or an Arabic text that is in fact a verse
  if (claim.kind === "quran") {
    const r = await checkAsVerse(claim, deps, VERSE_MIN);
    if (r) return r;
  } else if (claim.arabicSpan && !claim.queryIsTranslation) {
    const r = await checkAsVerse(claim, deps, VERSE_AS_HADITH_MIN);
    if (r) return { ...r, notes: [...r.notes, "النص آية من القرآن وليس حديثا"] };
  }

  // 3) Dorar
  if (!canSearch) return { claim, state: STATES.notFound, basis: "none", notes: ["لا نص عربي يمكن البحث به"] };
  const looked = await deps.lookupDorar(claim.query);
  if (!looked.ok) return { claim, state: STATES.notFound, basis: "none", notes: [`تعذّر البحث في الدرر (${looked.error})`] };
  const narrations = selectRelevant(claim.query, looked.results);
  const notes = claim.kind === "quran" ? ["لم يُعثر على آية مطابقة"] : [];
  if (!narrations.length) return { claim, state: STATES.notFound, basis: "none", notes: [...notes, "لا رواية مطابقة في الدرر"] };
  const summary = summarizeGrades(narrations);
  const encodedQuery = encodeURIComponent(claim.query);
  return {
    claim,
    state: summary.grade as Grade,
    basis: "dorar",
    dorar: {
      narrations,
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

const TURATH_UNAVAILABLE: TurathLookupOutcome = { status: "unavailable", references: [] };

/** Turath is queried alongside the normal checks for every hadith claim, including early-return cases. */
export async function verifyClaim(claim: Claim, deps: VerifyDeps): Promise<VerifiedClaim> {
  if (claim.kind !== "hadith") return verifyClaimWithoutTurath(claim, deps);

  const verification = verifyClaimWithoutTurath(claim, deps);
  const turath = Promise.resolve()
    .then(() => deps.lookupTurath(claim.query))
    .catch(() => TURATH_UNAVAILABLE);
  const [result, lookup] = await Promise.all([verification, turath]);
  return { ...result, turath: lookup };
}

/** Verifies all claims of a post with bounded concurrency; duplicate Turath queries share a request-local lookup. */
export async function verifyClaims(claims: Claim[], deps: VerifyDeps, concurrency = 3): Promise<VerifiedClaim[]> {
  const out: VerifiedClaim[] = new Array(claims.length);
  const lookupsByQuery = new Map<string, Promise<TurathLookupOutcome>>();
  const requestDeps: VerifyDeps = {
    ...deps,
    lookupTurath: (query) => {
      const key = normalizeArabic(query).toLowerCase();
      const existing = lookupsByQuery.get(key);
      if (existing) return existing;
      const pending = Promise.resolve().then(() => deps.lookupTurath(query));
      lookupsByQuery.set(key, pending);
      return pending;
    },
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, claims.length) }, async () => {
      while (next < claims.length) {
        const i = next++;
        out[i] = await verifyClaim(claims[i], requestDeps);
      }
    }),
  );
  return out;
}

export type { DorarResult };
