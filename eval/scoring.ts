// Scores one system answer against one labelled prompt. Pure: no network, no app server code, so it is unit-tested
// (eval/scoring.test.ts) and shared by the live runner, the mock harness and the baseline runner.
//
// What changed from the first harness, and why:
// - Claims are paired by TEXT (the labelled quotedText against the extracted text), not by list position, and kinds are
//   the app's own («quran», «scholar_quote» …). Recall can no longer pass 100%: one expected claim takes one answer.
// - Extra claims (e.g. the chain-message line «شارك تؤجر» read as «other») lower precision but do not fail the prompt,
//   unless they are fabricated.
// - A prompt passes only when every expected claim is found with the right kind, state AND attribution, and no claim
//   in the answer is fabricated.
// - «Fabricated» means the shown evidence does not hold the text or does not support the shown state — not merely
//   «a record exists».
import { STATES } from "../src/lib/states";
import type { ActualClaim, ClaimScore, EvalPrompt, ExpectedClaim, FabricationFinding } from "./types";

// ---------- text ----------

/** Folds everything that should not decide a match: tashkeel and Quranic marks, letter variants, Urdu letter forms, case, punctuation. */
export function fold(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFC")
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ﻿​-‏]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ی/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/[ہۂھ]/g, "ه")
    .replace(/ۃ/g, "ه")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The letters that survive every spelling of the mushaf: alif and hamza are dropped, because the Uthmani script writes
 * «ٱلصَّٰبِرِينَ» / «ٱلرَّحْمَٰنِ» / «ءَالَآءِ» where the standard spelling has «الصابرين» / «الرحمن» / «آلاء».
 */
export const skeleton = (text: string | null | undefined): string => fold(text).replace(/[اء]/g, "");

export const tokens = (text: string | null | undefined): string[] => skeleton(text).split(" ").filter((w) => w.length > 1);

/**
 * How much of the shorter text is in the longer one (overlap coefficient on word sets), 0–1. An extractor that keeps
 * only the matn of a quoted «عن أبي هريرة قال: …» still pairs with it.
 */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  const fa = skeleton(a);
  const fb = skeleton(b);
  if (fa && fb && (fa.includes(fb) || fb.includes(fa))) return 1;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

/** Share of `needle`'s words found in `hay` (coverage of one side), 0–1. */
export function coverage(needle: string | null | undefined, hay: string | null | undefined): number {
  const N = new Set(tokens(needle));
  if (!N.size) return 0;
  const fh = skeleton(hay);
  if (fh.includes(skeleton(needle))) return 1;
  const H = new Set(tokens(hay));
  let k = 0;
  for (const w of N) if (H.has(w)) k++;
  return k / N.size;
}

export const PAIR_MIN = 0.5;
const VERSE_SAME_TEXT_MIN = 0.85;
const EVIDENCE_MIN = 0.5;

// ---------- states ----------

const REFERRAL_STATES = new Set([fold(STATES.fatwa), fold(STATES.notFound)]);
export const isReferral = (state: string | undefined) => REFERRAL_STATES.has(fold(state));
const VERSE_STATES = new Set([STATES.verseOk, STATES.verseWrong, STATES.verseContext, STATES.verseTranslated].map(fold));

/** Exact state match after folding diacritics and punctuation. No substring tricks: «ضعيف» never matches «شديد الضعف». */
export function stateMatches(actual: string | undefined, exp: ExpectedClaim): boolean {
  const a = fold(actual);
  if (!a) return false;
  return [exp.expectedState, ...(exp.acceptableStates ?? [])].some((s) => fold(s) === a);
}

export function kindMatches(actual: string | undefined, exp: ExpectedClaim): boolean {
  return actual === exp.kind || Boolean(actual && exp.acceptKinds?.includes(actual as ExpectedClaim["kind"]));
}

// ---------- pairing ----------


/** One-to-one pairing, best similarity first. Returns for each expected claim the index of its answer, or -1. */
export function alignClaims(expected: ExpectedClaim[], actual: ActualClaim[]): Array<{ actualIndex: number; similarity: number }> {
  const pairs: Array<{ e: number; a: number; s: number }> = [];
  expected.forEach((exp, e) =>
    actual.forEach((act, a) => {
      const s = Math.max(textSimilarity(exp.quotedText, act.claim.textAsWritten), textSimilarity(exp.quotedText, act.claim.arabicSpan));
      // a fiqh question is often reworded by the extractor; its kind is then the better signal
      const bonus = exp.kind === "question" && act.claim.kind === "question" ? 0.25 : 0;
      if (s + bonus >= PAIR_MIN) pairs.push({ e, a, s: Math.min(1, s + bonus) });
    }),
  );
  pairs.sort((x, y) => y.s - x.s || x.e - y.e || x.a - y.a);
  const out = expected.map(() => ({ actualIndex: -1, similarity: 0 }));
  const taken = new Set<number>();
  for (const p of pairs) {
    if (out[p.e].actualIndex !== -1 || taken.has(p.a)) continue;
    out[p.e] = { actualIndex: p.a, similarity: Math.round(p.s * 100) / 100 };
    taken.add(p.a);
  }
  return out;
}

// ---------- attribution ----------

const nameMatches = (shown: string | undefined, wanted: string) => {
  const s = fold(shown);
  const w = fold(wanted);
  return Boolean(s && w && (s.includes(w) || w.includes(s)));
};

/** null when there is nothing to attribute. */
export function attributionMatches(exp: ExpectedClaim, act: ActualClaim): boolean | null {
  const want = exp.attribution;
  if (exp.shouldAbstain || !want) return null;

  if (want.surah !== undefined) {
    const v = act.verse;
    if (!v) return false;
    if (v.surah === want.surah && (want.ayah === undefined || v.ayah === want.ayah)) return true;
    // a verse repeated word for word in several places (e.g. 55:13 … 55:77): any place with the same text is right
    return Boolean(want.verseText && v.text && coverage(want.verseText, v.text) >= VERSE_SAME_TEXT_MIN && coverage(v.text, want.verseText) >= VERSE_SAME_TEXT_MIN);
  }

  if (want.scholar || want.reference) {
    if (act.basis !== "specialist-list" || !act.saying) return false;
    const scholarOk = !want.scholar || want.scholar.split("/").some((n) => nameMatches(act.saying?.verdict_by, n.trim()));
    const refOk = !want.reference || nameMatches(act.saying.reference, want.reference.replace(/[\d/\s]+$/, ""));
    return scholarOk && refOk;
  }

  if (want.collections?.length) {
    const books = act.dorar?.narrations.map((n) => n.source ?? "") ?? [];
    return books.some((b) => want.collections!.some((c) => nameMatches(b, c)));
  }
  return null;
}

// ---------- fabrication ----------

/** The answer shows evidence that does not hold the text, or a state its own evidence does not give. */
export function fabricationOf(act: ActualClaim): string | null {
  const text = act.claim.queryIsTranslation ? act.claim.query ?? "" : act.claim.arabicSpan || act.claim.textAsWritten;
  switch (act.basis) {
    case "quran": {
      if (!act.verse) return "state from the Quran with no verse shown";
      if (!VERSE_STATES.has(fold(act.state))) return `verse shown with a non-verse state «${act.state}»`;
      if (act.claim.queryIsTranslation) return null; // the wording of a translation is never compared
      if (act.verse.text && coverage(act.verse.text, text) < EVIDENCE_MIN && coverage(text, act.verse.text) < EVIDENCE_MIN) {
        return "the verse shown does not hold the quoted text";
      }
      return null;
    }
    case "dorar": {
      const ns = act.dorar?.narrations ?? [];
      if (!ns.length) return "grade from Dorar with no narration shown";
      if (act.dorar?.summary?.grade && fold(act.dorar.summary.grade) !== fold(act.state)) {
        return `shown state «${act.state}» differs from the evidence summary «${act.dorar.summary.grade}»`;
      }
      if (!ns.some((n) => n.matn && (coverage(text, n.matn) >= EVIDENCE_MIN || coverage(n.matn, text) >= EVIDENCE_MIN))) {
        return "no narration shown holds the claimed text";
      }
      return null;
    }
    case "specialist-list": {
      if (!act.saying) return "specialist status with no list entry shown";
      if (act.saying.status && fold(act.saying.status) !== fold(act.state)) return "shown state differs from the list entry's status";
      if (act.saying.text_ar && textSimilarity(act.saying.text_ar, text) < EVIDENCE_MIN) return "the list entry shown is a different text";
      return null;
    }
    case "turath": {
      const refs = act.turath?.references ?? [];
      if (fold(act.state) !== fold(STATES.turathFound)) return `Turath basis with state «${act.state}»`;
      if (!refs.length) return "«found in the books» with no passage shown";
      if (!refs.some((r) => coverage(text, r.excerpt) >= 0.8)) return "no Turath passage shown holds the text";
      return null;
    }
    case "none":
      return fold(act.state) === fold(STATES.notFound) ? null : `state «${act.state}» with no evidence`;
    case "kind":
      if (act.claim.kind !== "question") return "a non-question answered by kind";
      return [STATES.fatwa, STATES.fiqh].map(fold).includes(fold(act.state)) ? null : `question given state «${act.state}»`;
    default:
      return `unknown basis «${act.basis}»`;
  }
}

/** Any Turath reference without a usable citation (book, page link) is a citation error. */
export function citationProblems(refs: Array<{ citation?: string; book?: { id?: string; title?: string }; bookId?: string; url?: string }>): string[] {
  const out: string[] = [];
  refs.forEach((r, i) => {
    if (!r.book?.title) out.push(`#${i + 1}: no book title`);
    if (!r.bookId) out.push(`#${i + 1}: no book id`);
    if (!r.url || !/^https:\/\/(app\.)?turath\.io\//.test(r.url)) out.push(`#${i + 1}: no turath.io link`);
    else if (r.bookId && !r.url.includes(r.bookId)) out.push(`#${i + 1}: link does not point to book ${r.bookId}`);
    if (!r.citation) out.push(`#${i + 1}: no citation text`);
  });
  return out;
}

// ---------- one prompt ----------

export interface PromptScore {
  success: boolean;
  scores: ClaimScore[];
  fabrications: FabricationFinding[];
  extraClaims: Array<{ kind: string; text: string; state: string }>;
  claimsMatched: number;
}

const shownSource = (a: ActualClaim) =>
  a.verse ? `${a.verse.surahName ?? a.verse.surah}:${a.verse.ayah}` : a.saying?.reference ?? a.dorar?.narrations[0]?.source ?? a.turath?.references[0]?.book?.title;

export function scorePrompt(
  prompt: Pick<EvalPrompt, "expectedClaims">,
  actual: ActualClaim[],
  opts: { fabrication?: (a: ActualClaim) => string | null } = {},
): PromptScore {
  const fab = opts.fabrication ?? fabricationOf;
  const align = alignClaims(prompt.expectedClaims, actual);
  const scores: ClaimScore[] = prompt.expectedClaims.map((exp, i) => {
    const { actualIndex, similarity } = align[i];
    const act = actualIndex >= 0 ? actual[actualIndex] : undefined;
    if (!act) {
      return { expectedIndex: i, actualIndex: -1, similarity: 0, found: false, kindOk: false, stateOk: false, attributionOk: exp.shouldAbstain || !exp.attribution ? null : false, abstentionOk: false, expectedState: exp.expectedState };
    }
    return {
      expectedIndex: i,
      actualIndex,
      similarity,
      found: true,
      kindOk: kindMatches(act.claim.kind, exp),
      stateOk: stateMatches(act.state, exp),
      attributionOk: attributionMatches(exp, act),
      abstentionOk: exp.shouldAbstain === isReferral(act.state),
      expectedState: exp.expectedState,
      actualState: act.state,
      basis: act.basis,
      extractedKind: act.claim.kind,
      extractedText: act.claim.textAsWritten,
      shownSource: shownSource(act),
    };
  });
  const fabrications = actual.flatMap((a, i) => {
    const reason = fab(a);
    return reason ? [{ actualIndex: i, reason }] : [];
  });
  const paired = new Set(scores.map((s) => s.actualIndex));
  const extraClaims = actual.flatMap((a, i) => (paired.has(i) ? [] : [{ kind: a.claim.kind, text: a.claim.textAsWritten, state: a.state }]));
  const success = scores.every((s) => s.found && s.kindOk && s.stateOk && s.attributionOk !== false) && fabrications.length === 0;
  return { success, scores, fabrications, extraClaims, claimsMatched: scores.filter((s) => s.found).length };
}

// ---------- statistics ----------

/** Wilson 95% interval for k successes out of n, in percent. */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  const r = (x: number) => Math.round(x * 1000) / 10;
  return [r(Math.max(0, centre - half)), r(Math.min(1, centre + half))];
}

export const rate = (k: number, n: number) => ({ n, k, value: n ? Math.round((k / n) * 1000) / 10 : 0, ci: wilson(k, n) });

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
