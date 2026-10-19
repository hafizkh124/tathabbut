"use client";
import React from "react";
import type { ClaimResult } from "@/lib/clientTypes";
import { styleOf } from "@/lib/gradeStyle";
import { useI18n } from "@/lib/i18n/i18n";
import { summarize, summaryKind } from "@/lib/summary";

/** «4 texts, only 1 established» over a colour bar with a segment for each text, in the order of the post. Shown from two texts up. */
export function ResultSummary({ claims }: { claims: ClaimResult[] }) {
  const { t, num } = useI18n();
  const s = summarize(claims.map((c) => c.state));
  const kind = summaryKind(s);
  if (!kind) return null;
  return (
    <div className="w-full space-y-2" role="group" aria-label={t(`summary.${kind}`, { n: num(s.total), ok: num(s.established) })}>
      <p className="nastaliq-pad text-[15px] font-semibold text-brand-ink">{t(`summary.${kind}`, { n: num(s.total), ok: num(s.established) })}</p>
      <div aria-hidden className="flex gap-1">
        {claims.map((c, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: styleOf(c.state).line }} />
        ))}
      </div>
    </div>
  );
}
