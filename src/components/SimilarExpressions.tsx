"use client";
import { useEffect, useId, useState } from "react";
import type { SimilarExpression } from "@/lib/similarExpressions";
import { useI18n } from "@/lib/i18n/i18n";
import { fetchTranslation } from "@/lib/translateClient";
import { dorarSearchUrl } from "@/lib/dorarLink";
import { Button } from "./ui/Button";
import { StateBadge } from "./ui/Badge";

function SimilarCard({ candidate }: { candidate: SimilarExpression }) {
  const { locale, t } = useI18n();
  const to = locale === "ur" || locale === "en" ? locale : null;
  const key = `${to}:${candidate.sig}`;
  const [translation, setTranslation] = useState<{ key: string; text: string | null } | null>(null);
  useEffect(() => {
    if (!to || !candidate.sig) return;
    let active = true;
    fetchTranslation(candidate.text, candidate.sig, to).then(text => {
      if (active) setTranslation({ key, text });
    });
    return () => { active = false; };
  }, [to, key, candidate.sig, candidate.text]);
  const loading = Boolean(to && candidate.sig && translation?.key !== key);
  return <li className="space-y-2 rounded-xl border border-line bg-paper p-3">
    <p role="note" className="text-[14px]">{t("similar.warning")}</p>
    <p translate="no" lang="ar" dir="rtl" className="quran text-[22px]">{candidate.text}</p>
    {to && <div className="space-y-1">
      <p className="text-[12px] text-muted">{t("similar.translation")}</p>
      <p aria-live="polite" className="text-[14px] leading-loose">{loading ? t("similar.loading") : translation?.key === key && translation.text ? translation.text : t("similar.unavailable")}</p>
    </div>}
    <StateBadge state={candidate.state} size="sm" caution={candidate.caution} />
    <p className="text-[14px]">{t("label.source")}: {candidate.source}{candidate.reference ? `، ${candidate.reference}` : ""}</p>
    {candidate.scholar && <p className="text-[14px]">{t("label.scholar")}: {candidate.scholar}</p>}
    <p translate="no" lang="ar" dir="rtl" className="text-[14px]">{t("label.words")}: {candidate.verdict}</p>
    {candidate.scope === "isnad" && <p role="note" className="text-[13px]">{t("similar.isnad")}</p>}
    {candidate.scope === "narrator" && <p role="note" className="text-[13px]">{t("note.narratorCriticism")}</p>}
    <a href={dorarSearchUrl(candidate.text)} target="_blank" rel="noopener noreferrer" className="inline-block py-2 text-[14px] text-brand-ink underline">{t("via.dorar")}</a>
  </li>;
}

export function SimilarExpressions({ candidates }: { candidates: SimilarExpression[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!candidates.length) return null;
  return <section className="space-y-3">
    <Button full variant="secondary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{t(open ? "similar.hide" : "similar.show")}</Button>
    {open && <ul id={id} className="space-y-3">{candidates.map(candidate => <SimilarCard key={candidate.text} candidate={candidate} />)}</ul>}
  </section>;
}
