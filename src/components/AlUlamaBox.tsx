"use client";
import React, { useEffect, useState } from "react";
import type { AlulamaHit } from "@/lib/alulama";
import { ALULAMA_ASK_URL, answerText } from "@/lib/alulamaClient";
import { fetchAnswerTranslation } from "@/lib/translateClient";
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
  // the answers are in Urdu: on the Arabic or English screen they are translated by machine (labelled, with the Urdu one tap away)
  const to = locale === "ar" || locale === "en" ? locale : null;
  const key = `${to}:${h.sig}`;
  const [tr, setTr] = useState<{ key: string; text: string | null } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => {
    if (!to || !h.sig) return;
    let live = true;
    fetchAnswerTranslation(answerText(h), h.sig, to).then((text) => {
      if (live) setTr({ key, text });
    });
    return () => {
      live = false;
    };
  }, [to, h, key]);
  const translated = tr && tr.key === key ? tr.text : null;
  const waiting = Boolean(to && h.sig && !(tr && tr.key === key));
  const [tTitle, ...tRest] = translated ? translated.split(/\n\s*\n/) : [];
  const tBody = tRest.join("\n");
  const original = !translated || showOriginal;
  const when = h.published ? new Date(h.published) : null;
  const date = when && !Number.isNaN(when.getTime()) ? new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : locale, { year: "numeric", month: "long" }).format(when) : null;
  return (
    <li className="space-y-1.5 rounded-xl border border-line bg-paper p-3">
      {translated && (
        <div className="space-y-1.5" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
          {tBody ? (
            <>
              <p className="text-[15px] font-semibold leading-7 text-ink">{tTitle}</p>
              <p className="text-[14px] leading-7 text-ink">{opening(tBody)}</p>
            </>
          ) : (
            <p className="text-[14px] leading-7 text-ink">{opening(tTitle ?? "")}</p>
          )}
          <p className="text-[12.5px] text-muted">{t("alulama.mt")}</p>
        </div>
      )}
      {waiting && <p className="text-[12.5px] text-muted">{t("translate.loading")}</p>}
      {original && (
        <div className="space-y-1.5" dir="auto" lang="ur">
          <p className="text-[15px] font-semibold leading-7 text-ink">{h.title}</p>
          {h.answer_snippet && <p className="text-[14px] leading-7 text-ink">{opening(h.answer_snippet)}</p>}
        </div>
      )}
      {translated && (
        <button type="button" onClick={() => setShowOriginal((v) => !v)} aria-expanded={showOriginal} className="min-h-9 cursor-pointer text-[13px] text-brand-ink underline underline-offset-[5px]">
          {t(showOriginal ? "alulama.hideOriginal" : "alulama.showOriginal")}
        </button>
      )}
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
  // a general fiqh question with nothing found even after the second look: say so plainly and show the way to ask, never an empty card
  const noPassages = !(r.turath && r.turath.status === "success" && r.turath.references.length > 0);
  if (r.claim.kind === "question" && r.state === STATES.fiqh && a?.status === "none" && a.retried && r.turath?.status !== "loading" && noPassages) {
    return (
      <section aria-label={t("alulama.notfound.title")} className="space-y-2 rounded-[14px] border border-line bg-surface p-3.5">
        <h3 className="text-[15px] font-semibold text-ink">{t("alulama.notfound.title")}</h3>
        <p className="text-[14px] leading-7 text-muted">{t("alulama.notfound.body")}</p>
        <a href={ALULAMA_ASK_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-ink underline-offset-4 hover:underline">
          <span>{t("alulama.ask.cta")}</span>
          <Icon name="ext" size={14} />
        </a>
      </section>
    );
  }
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
