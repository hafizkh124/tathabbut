"use client";
import React, { useState } from "react";
import { track } from "@/lib/analytics";
import type { ClaimResult, NarrationView } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n/i18n";
import { buildShareText, fiqhItems, sameNarration, shareOrCopy, whatsappUrl, type FiqhPick, type ShareOutcome } from "@/lib/shareText";
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
      track("copy", { n, states: chosen.map((c) => c.state), linked: chosen.every((c) => c.shareId) });
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
    track("share", { n, states: chosen.map((c) => c.state), linked: chosen.every((c) => c.shareId), outcome: result });
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

/**
 * Share one fiqh result: the person chooses which of العلماء answers and which passages of the books go into the text, as with the
 * narrations of a hadith. What the plain share would carry (the first two answers, the first three passages) is ticked to begin with.
 */
export function FiqhShareDialog({ open, onClose, result: r }: { open: boolean; onClose: () => void; result: ClaimResult }) {
  const { t, num, locale } = useI18n();
  const items = fiqhItems(r);
  const [a, setA] = useState<boolean[]>(() => items.alulama.map((_, i) => i < 2));
  const [b, setB] = useState<boolean[]>(() => items.books.map((_, i) => i < 3));
  const [copied, setCopied] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const pick: FiqhPick = { alulama: a.flatMap((v, i) => (v ? [i] : [])), books: b.flatMap((v, i) => (v ? [i] : [])) };
  const n = pick.alulama.length + pick.books.length;
  const all = n === items.alulama.length + items.books.length;
  const text = buildShareText([r], locale, { fiqhPick: pick });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      track("copy", { n: 1, states: [r.state], linked: Boolean(r.shareId), fiqhPicked: n });
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
    const result = await shareOrCopy(text);
    track("share", { n: 1, states: [r.state], linked: Boolean(r.shareId), fiqhPicked: n, outcome: result });
    if (result === "shared") onClose();
    else setOutcome(result);
  };
  const row = (checked: boolean, onChange: (v: boolean) => void, body: React.ReactNode) => (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${checked ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 flex-none accent-[var(--brand)]" />
      <span className="min-w-0 flex-1 text-[14px]">{body}</span>
    </label>
  );

  return (
    <Dialog open={open} onClose={onClose} title={t("share.pickTitle")} placement="bottom">
      <div className="space-y-3 pb-1">
        <button
          type="button"
          onClick={() => {
            setA(items.alulama.map(() => !all));
            setB(items.books.map(() => !all));
          }}
          className="min-h-11 cursor-pointer text-[14px] text-brand-ink underline underline-offset-[5px]"
        >
          {all ? t("share.none") : t("share.all")}
        </button>
        <div className="max-h-[48vh] space-y-3 overflow-y-auto">
          {items.alulama.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[13px] font-semibold text-muted">{t("share.fiqh.alulama")}</h3>
              <ul className="space-y-2">
                {items.alulama.map((h, i) => (
                  <li key={h.id}>
                    {row(
                      a[i] ?? false,
                      (v) => setA((p) => p.map((x, k) => (k === i ? v : x))),
                      <span lang="ur" dir="auto">
                        {h.title}
                      </span>,
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {items.books.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[13px] font-semibold text-muted">{t("fiqh.title")}</h3>
              <ul className="space-y-2">
                {items.books.map((ref, i) => (
                  <li key={`${ref.bookId}-${i}`}>
                    {row(
                      b[i] ?? false,
                      (v) => setB((p) => p.map((x, k) => (k === i ? v : x))),
                      <span translate="no" lang="ar" dir="rtl">
                        <span className="font-semibold text-brand-ink">{ref.book.title}</span>
                        {ref.author?.name ? <span className="text-muted"> — {ref.author.name}</span> : null}
                      </span>,
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
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
        <ShareNote outcome={outcome} text={text} />
      </div>
    </Dialog>
  );
}

type NarrationMode = "main" | "pick" | "all";

/** Every narration of one result once, in the order the card shows them: the cited book's first, then the accepted,
 *  then the weaker variants. */
export function shareableNarrations(r: ClaimResult): NarrationView[] {
  const out: NarrationView[] = [];
  for (const n of [r.dorar?.cited?.narration, ...(r.dorar?.narrations ?? []), ...(r.dorar?.weakVariants ?? [])])
    if (n && !out.some((x) => sameNarration(x, n))) out.push(n);
  return out;
}

/** Share one hadith result: the main result as the card shows it, chosen narrations, or all of them (team lead,
 *  2026-10-19: the narration the post quoted must be sendable even when it is not the strongest). */
export function NarrationShareDialog({ open, onClose, result: r }: { open: boolean; onClose: () => void; result: ClaimResult }) {
  const { t, num, locale } = useI18n();
  const list = shareableNarrations(r);
  const [mode, setMode] = useState<NarrationMode>("main");
  const [picked, setPicked] = useState<boolean[]>(() => list.map((_, i) => i === 0));
  const [copied, setCopied] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const chosen = mode === "all" ? list : mode === "pick" ? list.filter((_, i) => picked[i]) : undefined;
  const text = buildShareText([r], locale, chosen ? { narrations: chosen } : {});
  const none = mode === "pick" && chosen?.length === 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      track("copy", { n: 1, states: [r.state], linked: Boolean(r.shareId), narrations: mode });
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
    const result = await shareOrCopy(text);
    track("share", { n: 1, states: [r.state], linked: Boolean(r.shareId), narrations: mode, outcome: result });
    if (result === "shared") onClose();
    else setOutcome(result);
  };

  const option = (m: NarrationMode, label: string) => (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${mode === m ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}>
      <input type="radio" name="share-mode" checked={mode === m} onChange={() => setMode(m)} className="h-5 w-5 flex-none accent-[var(--brand)]" />
      <span className="text-[15px]">{label}</span>
    </label>
  );

  return (
    <Dialog open={open} onClose={onClose} title={t("share.choose")} placement="bottom">
      <div className="space-y-3 pb-1">
        <div className="space-y-2" role="radiogroup">
          {option("main", t("share.main"))}
          {option("pick", t("share.pick"))}
          {option("all", t("share.allNarrations", { n: num(list.length) }))}
        </div>
        {mode === "pick" && (
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto">
            {list.map((n, i) => (
              <li key={i}>
                <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${picked[i] ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}>
                  <input
                    type="checkbox"
                    checked={picked[i] ?? false}
                    onChange={(e) => setPicked((p) => p.map((v, k) => (k === i ? e.target.checked : v)))}
                    className="h-5 w-5 flex-none accent-[var(--brand)]"
                  />
                  <span translate="no" className="min-w-0 flex-1 text-[14px]">
                    <span className="font-semibold text-brand-ink">{n.source}</span>
                    {n.reference ? `، ${n.reference}` : ""}
                    {n.muhaddith ? <span className="text-muted"> — {n.muhaddith}</span> : null}
                  </span>
                  <StateBadge state={n.display?.grade ?? n.grade} size="sm" caution={n.display?.caution} />
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2.5 pt-1">
          <Button full variant="secondary" onClick={copy} disabled={none}>
            <Icon name="copy" size={16} />
            <span>{copied ? t("action.copied") : t("action.copy")}</span>
          </Button>
          <Button full onClick={share} disabled={none}>
            <Icon name="share" size={16} />
            <span>{t("action.share")}</span>
          </Button>
        </div>
        <ShareNote outcome={outcome} text={text} />
      </div>
    </Dialog>
  );
}
