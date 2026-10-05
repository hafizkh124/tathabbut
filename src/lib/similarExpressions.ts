import { matnTokens, normalizeArabic } from "./arabic";
import type { DorarResult } from "./dorar";
import { classifyVerdict, displayGrade } from "./gradeMap";
import type { SayingHit } from "./verify";

export interface SimilarExpression {
  text: string;
  source: string;
  reference?: string;
  scholar?: string;
  verdict: string;
  state: string;
  scope?: "isnad" | "hadith" | "narrator";
  sig?: string;
  caution?: boolean;
}

export function similarSaying(s: SayingHit): SimilarExpression {
  return { text: s.text_ar, source: s.reference, scholar: s.verdict_by, verdict: s.verdict, state: s.status };
}

/** Suggestions are not verification matches. Require several content words, deduplicate and cap. */
export function similarNarrations(query: string, results: DorarResult[]): SimilarExpression[] {
  const requested = matnTokens(query);
  if (requested.size < 3) return [];
  const seen = new Set<string>();
  return results.map(r => {
    const tokens = matnTokens(r.matn);
    const shared = [...requested].filter(w => tokens.has(w)).length;
    return { r, shared, score: shared / requested.size };
  }).filter(x => x.shared >= 3 && x.score >= 0.4 && x.r.source && x.r.verdict && x.r.matn.length <= 1500)
    .sort((a, b) => b.score - a.score)
    .filter(({ r }) => {
      const key = normalizeArabic(r.matn);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3).map(({ r }) => {
      const grade = classifyVerdict(r.verdict!, r.muhaddith ?? "");
      return { text: r.matn, source: r.source!, reference: r.reference, scholar: r.muhaddith, verdict: r.verdict!, state: grade.grade, scope: grade.scope, caution: displayGrade(grade).caution };
    });
}
