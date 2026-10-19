"use client";
import React, { useMemo, useState } from "react";
import type { ClaimResult } from "@/lib/clientTypes";
import { LOCALES, type Locale } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/i18n";
import { shareOrCopy, whatsappUrl, type ShareOutcome } from "@/lib/shareText";
import { buildSoftReply } from "@/lib/softReply";
import { ShareNote } from "./ShareDialog";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { Icon } from "./ui/Icon";

const NAMES: Record<Locale, string> = { ur: "اردو", ar: "العربية", en: "English" };

/** A reply to whoever forwarded a text that does not hold (src/lib/softReply.ts): in the language of the sender, to copy or send. */
export function SoftReplyDialog({ open, onClose, result: r }: { open: boolean; onClose: () => void; result: ClaimResult }) {
  const { t, locale: mine } = useI18n();
  const [lang, setLang] = useState<Locale>(mine);
  const [copied, setCopied] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const text = useMemo(() => buildSoftReply(r, lang), [r, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the text is on screen to select */
    }
  };
  const share = async () => setOutcome(await shareOrCopy(text));

  return (
    <Dialog open={open} onClose={onClose} title={t("soft.title")} placement="bottom">
      <div className="mx-auto max-w-xl space-y-3 pb-1">
        <p className="text-[14px] text-muted">{t("soft.hint")}</p>
        <div role="group" aria-label={t("soft.title")} className="flex flex-wrap gap-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`min-h-11 cursor-pointer rounded-full border-[1.5px] px-4 text-[14px] ${lang === l ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-line bg-surface text-ink hover:bg-paper"}`}
            >
              {NAMES[l]}
            </button>
          ))}
        </div>
        <pre dir="auto" lang={lang} className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-paper p-3.5 text-[15px] leading-8 text-ink" style={{ fontFamily: lang === "ur" ? "var(--font-nastaliq), serif" : "inherit" }}>
          {text}
        </pre>
        <div className="flex gap-2.5 pt-1">
          <Button full variant="secondary" onClick={copy}>
            <Icon name="copy" size={16} />
            <span>{copied ? t("action.copied") : t("action.copy")}</span>
          </Button>
          <Button full onClick={share}>
            <Icon name="share" size={16} />
            <span>{t("action.share")}</span>
          </Button>
        </div>
        <a
          href={whatsappUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="nastaliq-pad inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-line bg-surface px-4 text-[15px] font-semibold text-brand-ink hover:bg-paper"
        >
          {t("share.whatsapp")}
        </a>
        <ShareNote outcome={outcome} text={text} />
      </div>
    </Dialog>
  );
}
