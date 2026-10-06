"use client";
import React, { useState } from "react";
import type { ClaimResult } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n/i18n";
import { buildShareText, shareOrCopy, whatsappUrl, type ShareOutcome } from "@/lib/shareText";
import { Button } from "./ui/Button";
import { StateBadge } from "./ui/Badge";
import { Dialog } from "./ui/Dialog";
import { Icon } from "./ui/Icon";

/** Said after a share that could only copy the text: where to paste it, and WhatsApp as one way to send it. */
export function ShareNote({ outcome, text }: { outcome: ShareOutcome | null; text: string }) {
  const { t } = useI18n();
  if (outcome !== "copied" && outcome !== "failed") return null;
  return (
    <p role="status" className="text-center text-[13px] text-muted">
      {t(outcome === "copied" ? "share.copiedPaste" : "share.sendVia")}{" "}
      <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-ink underline underline-offset-[5px]">
        {t("share.whatsapp")}
      </a>
    </p>
  );
}

/** Copy or share several results at once: every claim of the post with a box, all ticked to begin with (specialist, 2026-10-05). */
export function ShareDialog({ open, onClose, claims }: { open: boolean; onClose: () => void; claims: ClaimResult[] }) {
  const { t, num, locale } = useI18n();
  const [picked, setPicked] = useState<boolean[]>(() => claims.map(() => true));
  const [copied, setCopied] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const chosen = claims.filter((_, i) => picked[i]);
  const n = chosen.length;
  const all = n === claims.length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText(chosen, locale));
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1200);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  const share = async () => {
    const result = await shareOrCopy(buildShareText(chosen, locale));
    if (result === "shared") onClose();
    else setOutcome(result);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("share.pickTitle")} placement="bottom">
      <div className="space-y-3 pb-1">
        <button type="button" onClick={() => setPicked(claims.map(() => !all))} className="min-h-11 cursor-pointer text-[14px] text-brand-ink underline underline-offset-[5px]">
          {all ? t("share.none") : t("share.all")}
        </button>
        <ul className="space-y-2">
          {claims.map((c, i) => (
            <li key={i}>
              <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${picked[i] ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}>
                <input
                  type="checkbox"
                  checked={picked[i] ?? false}
                  onChange={(e) => setPicked((p) => p.map((v, k) => (k === i ? e.target.checked : v)))}
                  className="h-5 w-5 flex-none accent-[var(--brand)]"
                />
                <span className="text-[13px] font-semibold text-muted">{num(i + 1)}</span>
                <span translate="no" className="quran min-w-0 flex-1 truncate text-[17px]">{c.claim.arabicSpan || c.claim.textAsWritten}</span>
                <StateBadge state={c.state} size="sm" />
              </label>
            </li>
          ))}
        </ul>
        <div className="flex gap-2.5 pt-1">
          <Button full variant="secondary" onClick={copy} disabled={n === 0}>
            <Icon name="copy" size={16} />
            <span>{copied ? t("action.copied") : t("share.copyN", { n: num(n) })}</span>
          </Button>
          <Button full onClick={share} disabled={n === 0}>
            <Icon name="share" size={16} />
            <span>{t("share.shareN", { n: num(n) })}</span>
          </Button>
        </div>
        <ShareNote outcome={outcome} text={buildShareText(chosen, locale)} />
      </div>
    </Dialog>
  );
}
