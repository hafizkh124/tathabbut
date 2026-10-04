"use client";
import React, { useCallback, useState } from "react";
import type { ClaimResult, NarrationView } from "@/lib/clientTypes";
import { toneOf } from "@/lib/gradeStyle";
import { useI18n } from "@/lib/i18n/i18n";
import { buildShareText, plainSurah } from "@/lib/shareText";
import { Button } from "./ui/Button";
import { StateBadge } from "./ui/Badge";
import { Icon } from "./ui/Icon";

interface Via {
  label: "via.dorar" | "via.shamela" | "via.quranCom" | "via.quranpedia";
  url: string;
}

function viaLinks(r: ClaimResult): Via[] {
  const out: Via[] = [];
  if (r.verse?.externalUrls) {
    out.push({ label: "via.quranCom", url: r.verse.externalUrls.quranCom }, { label: "via.quranpedia", url: r.verse.externalUrls.quranpedia });
  }
  const ext = r.dorar?.externalUrls ?? r.saying?.externalUrls;
  if (ext) out.push({ label: "via.dorar", url: ext.dorar }, { label: "via.shamela", url: ext.shamela });
  return out;
}

/** «Via»: the sites the text was read from. Small links, not buttons; each opens the site. */
function ViaRow({ links }: { links: Via[] }) {
  const { t } = useI18n();
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-0 pt-1">
      <span className="text-muted">{t("label.via")}:</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          title={t("via.opens")}
          className="inline-flex items-center gap-1 py-2 text-[14px] text-brand-ink underline underline-offset-[5px] hover:text-brand-hover"
        >
          <span>{t(l.label)}</span>
          <Icon name="ext" size={11} />
        </a>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted">{label}: </span>
      <span>{children}</span>
    </div>
  );
}

function NarrationRow({ n }: { n: NarrationView }) {
  const { t } = useI18n();
  const grade = n.display?.grade ?? n.grade;
  return (
    <li className="space-y-1 rounded-xl border border-line bg-paper p-3 text-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StateBadge state={grade} size="sm" caution={n.display?.caution} />
        {n.muhaddith && <span className="text-muted">{n.muhaddith}</span>}
      </div>
      {n.source && (
        <Row label={t("label.source")}>
          <span className="font-semibold text-brand-ink">{n.source}</span>
          {n.reference ? `، ${n.reference}` : ""}
        </Row>
      )}
      {n.verdict && (
        <Row label={t("label.words")}>
          <span lang="ar" dir="rtl">
            {n.verdict}
          </span>
        </Row>
      )}
    </li>
  );
}

function SourceBox({ r }: { r: ClaimResult }) {
  const { t, num } = useI18n();
  const [more, setMore] = useState(false);

  if (r.verse) {
    const v = r.verse;
    return (
      <div className="space-y-1 rounded-xl border border-line bg-paper px-3.5 py-2 text-[14px]">
        <Row label={t("label.source")}>
          <span className="font-semibold text-brand-ink">{t("verse.ref", { s: plainSurah(v.surahName), a: num(v.ayah) })}</span>
        </Row>
        <Row label={t("label.text")}>{t("label.mushaf")}</Row>
        <ViaRow links={viaLinks(r)} />
      </div>
    );
  }

  if (r.dorar) {
    const [first, ...rest] = r.dorar.narrations;
    return (
      <div className="space-y-2">
        {r.dorar.summary.disputed && <p className="text-[13px] text-muted">{t("note.disputed")}</p>}
        <div className="space-y-1 rounded-xl border border-line bg-paper px-3.5 py-2 text-[14px]">
          {first?.source && (
            <Row label={t("label.source")}>
              <span className="font-semibold text-brand-ink">{first.source}</span>
              {first.reference ? `، ${first.reference}` : ""}
            </Row>
          )}
          {first?.muhaddith && <Row label={t("label.scholar")}>{first.muhaddith}</Row>}
          {first?.verdict && (
            <Row label={t("label.words")}>
              <span lang="ar" dir="rtl">
                {first.verdict}
              </span>
            </Row>
          )}
          {first?.display?.caution && <p className="pt-1 text-[13px] text-muted">{t("note.caution")}</p>}
          <ViaRow links={viaLinks(r)} />
        </div>
        {rest.length > 0 && (
          <div className="space-y-2">
            <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="min-h-11 text-[14px] text-brand-ink underline underline-offset-[5px] cursor-pointer">
              {more ? t("narrations.fewer") : t("narrations.more", { n: num(rest.length) })}
            </button>
            {more && (
              <ul className="space-y-2">
                {rest.map((n, i) => (
                  <NarrationRow key={i} n={n} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  if (r.saying) {
    const s = r.saying;
    return (
      <div className="space-y-1 rounded-xl border border-line bg-paper px-3.5 py-2 text-[14px]">
        {s.reference && (
          <Row label={t("label.source")}>
            <span className="font-semibold text-brand-ink">{s.reference}</span>
          </Row>
        )}
        {s.verdict_by && <Row label={t("label.scholar")}>{s.verdict_by}</Row>}
        {s.verdict && (
          <Row label={t("label.words")}>
            <span lang="ar" dir="rtl">
              {s.verdict}
            </span>
          </Row>
        )}
        {s.claimed_attribution && <Row label={t("label.attributed")}>{s.claimed_attribution}</Row>}
        {s.correct_text && (
          <Row label={t("label.correct")}>
            <span className="quran text-[17px]">{s.correct_text}</span>
          </Row>
        )}
        {s.note && <Row label={t("label.note")}>{s.note}</Row>}
        <ViaRow links={viaLinks(r)} />
      </div>
    );
  }
  return null;
}

function Diffs({ r }: { r: ClaimResult }) {
  const { t } = useI18n();
  const diffs = r.verse?.wording?.diffs;
  if (!diffs?.length) return null;
  return (
    <div className="space-y-1 rounded-xl border p-3 text-[14px]" style={{ background: "var(--t-misquote-bg)", color: "var(--t-misquote-fg)", borderColor: "var(--t-misquote-bd)" }}>
      <p className="font-semibold">{t("diff.title")}</p>
      {diffs.map((d, i) => (
        <p key={i}>
          {d.op === "replaced" && t("diff.replaced", { typed: d.typed ?? "", correct: d.correct ?? "" })}
          {d.op === "missing" && t("diff.missing", { correct: d.correct ?? "" })}
          {d.op === "added" && t("diff.added", { typed: d.typed ?? "" })}
        </p>
      ))}
    </div>
  );
}

const REPORTS_KEY = "tathabbut.reports";

/** The report is kept on this device for now (a list the team can read); it is not sent anywhere. */
function saveReport(r: ClaimResult, locale: string) {
  try {
    const list = JSON.parse(localStorage.getItem(REPORTS_KEY) ?? "[]") as unknown[];
    list.push({ at: new Date().toISOString(), locale, text: r.claim.textAsWritten, state: r.state });
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* storage unavailable: the thanks message is still shown */
  }
}

interface Props {
  result: ClaimResult;
  index: number;
  total: number;
  onOrigin: (query: string) => void;
  onEdit: () => void;
}

export function ClaimDetail({ result: r, index, total, onOrigin, onEdit }: Props) {
  const { t, num, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState<string | null>(null);
  const tone = toneOf(r.state);
  const quote = r.claim.arabicSpan || r.claim.textAsWritten;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const reportedHere = reported === r.claim.textAsWritten;

  const shareText = useCallback(() => buildShareText([r], locale), [r, locale]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ text: shareText() });
    } catch {
      /* the person closed the share sheet */
    }
  };

  const message =
    tone === "notFound" ? (
      <div className="space-y-2">
        <p className="text-base">{t("notfound.body")}</p>
        <p className="text-[14px] text-muted">{t("notfound.hint")}</p>
      </div>
    ) : tone === "fatwa" ? (
      <p className="text-base">{t("fatwa.body")}</p>
    ) : tone === "translated" ? (
      <p className="text-[14px] text-muted">{t("translated.body")}</p>
    ) : null;

  return (
    <section aria-label={t("result.title")} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <StateBadge state={r.state} size="lg" long />
        {total > 1 && <span className="text-[13px] text-muted">{t("result.of", { i: num(index + 1), n: num(total) })}</span>}
      </div>

      {tone !== "notFound" && tone !== "fatwa" && <p className="quran text-[22px] text-ink">{quote}</p>}
      {message}

      {r.verse && (
        <div className="space-y-2">
          <Diffs r={r} />
          {(tone === "misquote" || tone === "translated") && (
            <div className="rounded-xl border border-line bg-paper p-3">
              <p className="text-[12px] text-muted">{t("label.mushaf")}</p>
              <p className="quran text-[24px]">{r.verse.text}</p>
            </div>
          )}
        </div>
      )}

      <SourceBox r={r} />

      <div className="flex gap-2.5 pt-1">
        {tone === "notFound" ? (
          <>
            <Button full onClick={onEdit}>
              {t("action.editRetry")}
            </Button>
            <Button full variant="secondary" onClick={copy}>
              {copied ? t("action.copied") : t("action.copyText")}
            </Button>
          </>
        ) : (
          <>
            <Button full variant="secondary" onClick={copy}>
              <Icon name="copy" size={16} />
              <span>{copied ? t("action.copied") : t("action.copy")}</span>
            </Button>
            {canShare && (
              <Button full onClick={share}>
                <Icon name="share" size={16} />
                <span>{t("action.share")}</span>
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4">
        {tone !== "fatwa" && tone !== "notFound" && (
          <Button variant="ghost" size="sm" onClick={() => onOrigin(r.claim.query || r.claim.textAsWritten)}>
            {t("action.origin")}
          </Button>
        )}
        {reportedHere ? (
          <span className="py-3 text-[13px] text-muted" role="status">
            {t("action.reported")}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              saveReport(r, locale);
              setReported(r.claim.textAsWritten);
            }}
          >
            {t("action.report")}
          </Button>
        )}
      </div>
    </section>
  );
}
