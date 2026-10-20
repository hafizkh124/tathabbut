"use client";
import React from "react";
import type { AlulamaHit } from "@/lib/alulama";
import { ALULAMA_ASK_URL } from "@/lib/alulamaClient";
import type { ClaimResult } from "@/lib/clientTypes";
import { STATES } from "@/lib/states";
import { useI18n } from "@/lib/i18n/i18n";
import { Icon } from "./ui/Icon";

/** The answer's opening, cut at a word so the card stays short; the link has all of it. */
const SHOWN_CHARS = 300;
function opening(text: string): string {
  if (text.length <= SHOWN_CHARS) return text;
  const cut = text.slice(0, SHOWN_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), SHOWN_CHARS * 0.6))}…`;
}

function HitCard({ h }: { h: AlulamaHit }) {
  const { t, locale, num } = useI18n();
  const when = h.published ? new Date(h.published) : null;
  const date = when && !Number.isNaN(when.getTime()) ? new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : locale, { year: "numeric", month: "long" }).format(when) : null;
  return (
    <li className="space-y-1.5 rounded-xl border border-line bg-paper p-3">
      <p className="text-[15px] font-semibold leading-7 text-ink" dir="auto" lang="ur">{h.title}</p>
      {h.answer_snippet && <p className="text-[14px] leading-7 text-ink" dir="auto" lang="ur">{opening(h.answer_snippet)}</p>}
      <p className="text-[12.5px] text-muted" dir="auto" lang="ur">
        {[h.answerers[0], h.number ? t("alulama.number", { n: num(h.number) }) : null, date].filter(Boolean).join(" · ")}
      </p>
      <a href={h.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-ink underline-offset-4 hover:underline">
        <span>{t("alulama.read")}</span>
        <Icon name="ext" size={14} />
      </a>
    </li>
  );
}

/**
 * Questions العلماء already answered on the matter, each with its own words, its shaikh and a link to the full answer: a source
 * shown as it is, apart from the books of Turath. It is not our ruling, and for a personal case there is none here at all, only
 * the way to ask العلماء.
 */
export function AlUlamaBox({ r }: { r: ClaimResult }) {
  const { t } = useI18n();
  if (r.state === STATES.fatwa) {
    return (
      <section aria-label={t("alulama.ask.title")} className="space-y-2 rounded-[14px] border border-line bg-surface p-3.5">
        <h3 className="text-[15px] font-semibold text-ink">{t("alulama.ask.title")}</h3>
        <p className="text-[14px] leading-7 text-muted">{t("alulama.ask.body")}</p>
        <a href={ALULAMA_ASK_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-ink underline-offset-4 hover:underline">
          <span>{t("alulama.ask.cta")}</span>
          <Icon name="ext" size={14} />
        </a>
      </section>
    );
  }
  const a = r.alulama;
  if (a?.status !== "found") return null;
  return (
    <section aria-label={t("alulama.title")} className="space-y-3 rounded-[14px] border border-line bg-surface p-3.5">
      <h3 className="text-[15px] font-semibold text-ink">{t(a.kind === "fatwa" ? "alulama.title.fatwa" : "alulama.title.hadith")}</h3>
      <ul className="space-y-2.5">
        {a.hits.map((h) => (
          <HitCard key={h.id} h={h} />
        ))}
      </ul>
      <p className="text-[12.5px] leading-6 text-muted">{t("alulama.disclaimer")}</p>
    </section>
  );
}
