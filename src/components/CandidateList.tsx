"use client";
import React from "react";
import type { VerseView } from "@/lib/verify";
import { plainSurah } from "@/lib/shareText";
import { useI18n } from "@/lib/i18n/i18n";

/** «هل تقصد؟»: the verses a quotation fits. One is chosen at a time; picking another changes the result below. */
export function CandidateList({ candidates, picked, onPick }: { candidates: VerseView[]; picked: number; onPick: (i: number) => void }) {
  const { t, num } = useI18n();
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[15px] font-bold text-brand-ink">{t("candidates.title")}</p>
        <p className="text-[13px] text-muted">{t("candidates.hint")}</p>
      </div>
      <div role="radiogroup" aria-label={t("candidates.title")} className="space-y-2">
        {candidates.map((c, i) => {
          const on = i === picked;
          return (
            <button
              key={`${c.surah}:${c.ayah}`}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(i)}
              className={`flex min-h-12 w-full cursor-pointer items-start gap-3 rounded-2xl border-2 bg-surface px-3.5 py-2.5 text-start ${on ? "border-brand" : "border-line"}`}
            >
              <span className={`mt-2 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 ${on ? "border-brand" : "border-line-strong"}`}>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
              </span>
              <span className="min-w-0">
                <span translate="no" className="quran block text-[20px] text-ink">… {c.wording?.correctText ?? c.text}</span>
                <span className="block text-[13px] text-muted">{t("verse.ref", { s: plainSurah(c.surahName), a: num(c.ayah) })}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
