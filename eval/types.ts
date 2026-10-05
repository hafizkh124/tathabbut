// Types of the evaluation suite. Claim kinds and states are the app's own (src/lib/claims.ts, src/lib/states.ts):
// the scorer compares like with like, never a renamed copy of them.
import type { ClaimKind } from "../src/lib/claims";

export type EvalCategory =
  | "quran_exact"
  | "quran_distorted"
  | "quran_translation"
  | "hadith_sahih"
  | "hadith_weak"
  | "hadith_disputed"
  | "circulating_saying"
  | "no_source"
  | "fiqh_personal"
  | "fiqh_general"
  | "multilingual"
  | "multi_claim"
  | "ocr_screenshot";

export const CATEGORIES: readonly EvalCategory[] = [
  "quran_exact",
  "quran_distorted",
  "quran_translation",
  "hadith_sahih",
  "hadith_weak",
  "hadith_disputed",
  "circulating_saying",
  "no_source",
  "fiqh_personal",
  "fiqh_general",
  "multilingual",
  "multi_claim",
  "ocr_screenshot",
];

export type ExpectedKind = ClaimKind;

/** Where a label came from, and whether the specialist has seen it. Only `approved`/`corrected` labels count as reviewed. */
export interface LabelInfo {
  status: "unreviewed" | "approved" | "corrected" | "rejected";
  /** e.g. "mushaf text", "quranlab/hadith grade_summary (all graders da'if)", "AI-drafted list — needs specialist" */
  source: string;
  reviewer?: string;
  reviewedAt?: string;
  note?: string;
}

export interface ExpectedAttribution {
  /** Quran: the verse. A returned verse with the same text (a repeated verse) is accepted too. */
  surah?: number;
  ayah?: number;
  verseText?: string;
  /** Hadith: the collections that hold it; one of Dorar's shown narrations must be in one of them. */
  collections?: string[];
  /** Specialist list: the verdict's author and reference, as labelled. */
  scholar?: string;
  reference?: string;
}

export interface ExpectedClaim {
  kind: ExpectedKind;
  /** Other extractor kinds that are also right for this text (a saying attributed to the Prophet may come as «hadith»). */
  acceptKinds?: ExpectedKind[];
  /** The claim's text exactly as it appears in the prompt: used to pair expected and extracted claims. */
  quotedText: string;
  /** The state the user must see, as the app writes it (STATES or the specialist's own status). */
  expectedState: string;
  /** Other states that are also correct (e.g. an invented text: «not found» or, if Dorar lists it as موضوع, «شديد الضعف»). */
  acceptableStates?: string[];
  /** A referral («إحالة») is the right answer: a personal fatwa, or a text with no source. */
  shouldAbstain: boolean;
  attribution?: ExpectedAttribution;
  /** The screen asks Turath for this claim (hadith/scholar text, or a general fiqh question with a topic). */
  expectTurathLookup?: boolean;
}

export interface EvalPrompt {
  id: string;
  category: EvalCategory;
  prompt: string;
  language: "ar" | "ur" | "en";
  expectedClaims: ExpectedClaim[];
  /** Items that are variants of one source text share a group; sampling, splitting and CIs work on groups. */
  group: string;
  /** dev: thresholds may be tuned on it. test: held out — never looked at while tuning. Assigned by a hash of `group`. */
  split: "dev" | "test";
  label: LabelInfo;
  /** A screenshot to read through /api/ocr first (path relative to eval/). Text items have none. */
  image?: { path: string; mimeType: "image/png" | "image/jpeg" };
  metadata?: Record<string, unknown>;
}

/** What the runner gets back for one claim: /api/verify's claim, after the Turath step the screen runs. */
export interface ActualClaim {
  claim: {
    kind: string;
    textAsWritten: string;
    arabicSpan?: string | null;
    query?: string;
    queryIsTranslation?: boolean;
    topic?: string | null;
    scope?: string;
  };
  state: string;
  basis: string;
  verse?: { surah: number; ayah: number; surahName?: string; text?: string; candidates?: Array<{ surah: number; ayah: number; text?: string }> };
  saying?: { text_ar?: string; status?: string; verdict_by?: string; reference?: string };
  dorar?: {
    narrations: Array<{ matn?: string; source?: string; muhaddith?: string; verdict?: string; grade?: string }>;
    summary?: { grade?: string };
  };
  turath?: TurathOutcomeLite;
  notes?: string[];
}

export interface TurathRefLite {
  excerpt: string;
  citation?: string;
  book?: { id?: string; title?: string };
  bookId?: string;
  url?: string;
  category?: { id?: string; title?: string };
}
export interface TurathOutcomeLite {
  status: "success" | "unavailable" | "skipped";
  references: TurathRefLite[];
  partial?: boolean;
  kind?: string;
  query?: string;
}

export interface ClaimScore {
  expectedIndex: number;
  /** index in the system's claims, or -1 when no extracted claim matches this expected one */
  actualIndex: number;
  similarity: number;
  found: boolean;
  kindOk: boolean;
  stateOk: boolean;
  /** null: nothing to attribute (a referral, or no attribution labelled) */
  attributionOk: boolean | null;
  abstentionOk: boolean;
  expectedState: string;
  actualState?: string;
  basis?: string;
  extractedKind?: string;
  extractedText?: string;
  shownSource?: string;
}

export interface FabricationFinding {
  actualIndex: number;
  reason: string;
}

export interface Usage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  calls: number;
}

export type ErrorKind = "infra" | "system";

export interface PromptEvalResult {
  promptId: string;
  category: EvalCategory;
  group: string;
  split: "dev" | "test";
  labelReviewed: boolean;
  /** passed: every expected claim found with the right kind, state and attribution, and nothing fabricated */
  success: boolean;
  /** infra: the run could not measure this item (relay down, quota, timeout) — excluded from accuracy, counted apart */
  error?: { kind: ErrorKind; message: string };
  claimsExpected: number;
  claimsFound: number;
  claimsMatched: number;
  scores: ClaimScore[];
  fabrications: FabricationFinding[];
  extraClaims: Array<{ kind: string; text: string; state: string }>;
  turath: Array<{ actualIndex: number; kind: string; query: string; status: string; references: TurathRefLite[]; patched: boolean }>;
  durationMs: number;
  stageMs?: Record<string, number>;
  usage?: Usage;
  estimatedCostUsd?: number;
}

export interface Rate {
  n: number;
  k: number;
  /** percent, one decimal */
  value: number;
  /** Wilson 95% interval, percent */
  ci: [number, number];
}

export interface CategoryMetrics {
  prompts: number;
  measured: number;
  infraErrors: number;
  accuracy: Rate;
  claimRecall: Rate;
  claimPrecision: Rate;
  kindAccuracy: Rate;
  stateAccuracy: Rate;
  attributionAccuracy: Rate;
  abstention: Rate;
  fabricationCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

export interface EvalSummary {
  timestamp: string;
  mode: "pipeline" | "api" | "mock";
  model?: string;
  gitSha?: string;
  datasetSha256: string;
  split: string;
  sampling: string;
  seed: number;
  turath: boolean;
  totalPrompts: number;
  measured: number;
  infraErrors: number;
  reviewedLabelShare: number;
  overall: CategoryMetrics;
  /** mean of the per-category accuracies, so a big category does not hide a small one */
  macroAccuracy: number;
  byCategory: Partial<Record<EvalCategory, CategoryMetrics>>;
  usage?: Usage;
  estimatedCostUsd?: number;
  costPerPromptUsd?: number;
}
