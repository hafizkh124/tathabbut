"use client";
import React, { useCallback, useState } from "react";
import type { ClaimResult, NarrationView } from "@/lib/clientTypes";
import { dorarSearchUrl } from "@/lib/dorarLink";
import { isDorarAddition, sahihAttribution } from "@/lib/sahihAttribution";
import { toneOf } from "@/lib/gradeStyle";
import { useI18n } from "@/lib/i18n/i18n";
import { buildShareText, plainSurah, readersLine, shareOrCopy, type ShareOutcome } from "@/lib/shareText";
import { pickedIndex } from "@/lib/candidates";
import { matchedArabic } from "@/lib/matchedArabic";
import { quranpediaUrl, splitReferenceUrl } from "@/lib/viaLinks";
import { CandidateList } from "./CandidateList";
import { Button } from "./ui/Button";
import { StateBadge } from "./ui/Badge";
import { Icon } from "./ui/Icon";
import { FiqhBox, TurathBox } from "./TurathBox";
import { ShareDialog, ShareNote } from "./ShareDialog";
import { SimilarExpressions } from "./SimilarExpressions";

interface Via {
  label: "via.dorar" | "via.quranpedia" | "via.alulama";
  /** shown instead of the label for a site we have no name for */
  host?: string;
  url: string;
  /** the link opens the very hadith in its book (not just a search) */
  exact?: boolean;
}

/** Only the site the text was read from: quranpedia for a verse, Dorar for Dorar's narrations and for the list entries whose
 *  verdict was copied from Dorar, and the article's own site for an entry that cites one. Never a site we did not read. */
function viaLinks(r: ClaimResult): Via[] {
  if (r.verse) return [{ label: "via.quranpedia", url: quranpediaUrl(r.verse.surah, r.verse.ayah) }];
  if (r.dorar) {
    const first = r.dorar.narrations[0];
    if (first?.matn) return [{ label: "via.dorar", url: dorarSearchUrl(first.matn, first.source), exact: true }];
    return r.dorar.externalUrls ? [{ label: "via.dorar", url: r.dorar.externalUrls.dorar }] : [];
  }
  if (r.saying) {
    const ref = splitReferenceUrl(r.saying.reference ?? "");
    if (ref.url) return [{ label: ref.site ?? "via.alulama", host: ref.site ? undefined : ref.host, url: ref.url }];
    return r.saying.externalUrls ? [{ label: "via.dorar", url: r.saying.externalUrls.dorar }] : [];
  }
  return [];
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
          title={l.exact ? t("via.exact") : undefined}
          className="inline-flex items-center gap-1 py-2 text-[14px] text-brand-ink underline underline-offset-[5px] hover:text-brand-hover"
        >
          <span>{l.host ?? t(l.label)}</span>
          <Icon name="ext" size={11} />
        </a>
      ))}
      {links.some((l) => l.exact) && <DorarTabHint />}
    </div>
  );
}

/** Dorar opens on its «لغير المتخصص» tab, and a narration from a book for specialists (العلل، الضعفاء…) is only under
 *  the other one; no link can choose the tab, so the reader is told where to look. */
function DorarTabHint() {
  const { t } = useI18n();
  const [before, after = ""] = t("via.dorarTab").split("{tab}");
  return (
    <p className="w-full text-[12px] text-muted">
      {before}
      <bdi lang="ar" dir="rtl" translate="no" className="font-semibold">للمتخصص في علم الحديث</bdi>
      {after}
    </p>
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
        {n.muhaddith && <span className="text-muted" translate="no">{n.muhaddith}</span>}
      </div>
      {n.source && (
        <Row label={t("label.source")}>
          <span className="font-semibold text-brand-ink" translate="no">{n.source}</span>
          {n.reference ? `، ${n.reference}` : ""}
        </Row>
      )}
      <NarrationVerdict n={n} />
      <a
        href={dorarSearchUrl(n.matn, n.source)}
        target="_blank"
        rel="noopener noreferrer"
        title={t("via.exact")}
        className="inline-flex items-center gap-1 py-2 text-[14px] text-brand-ink underline underline-offset-[5px] hover:text-brand-hover"
      >
        <span>{t("via.dorar")}</span>
        <Icon name="ext" size={11} />
      </a>
      <DorarTabHint />
    </li>
  );
}

function NarrationVerdict({ n }: { n: NarrationView }) {
  const { t, locale } = useI18n();
  const attribution = sahihAttribution(n, locale);
  return <>
    {n.textVariant && <div className="space-y-1">
      <p role="note" className="text-[13px] text-muted">{t(n.textVariant === "additional" ? "note.additionalWording" : "note.differentWording")}</p>
      <p className="text-[12px] text-muted">{t("label.narrationText")}</p>
      <p translate="no" lang="ar" dir="rtl" className="quran text-[18px]">{n.matn}</p>
    </div>}
    {attribution && <p>{attribution}</p>}
    {n.verdict && <Row label={t(isDorarAddition(n.verdict) ? "label.dorarGrade" : "label.words")}>
      <span translate="no" lang="ar" dir="rtl">{n.verdict}</span>
    </Row>}
    {n.scope === "isnad" && /هالك/.test(n.verdict ?? "") && <p className="text-[13px] text-muted">{t("note.halikIsnad")}</p>}
    {n.scope === "narrator" && <p role="note" className="text-[13px] text-muted">{t("note.narratorCriticism")}</p>}
  </>;
}

function SourceBox({ r }: { r: ClaimResult }) {
  const { t, num } = useI18n();
  const [more, setMore] = useState(false);
  const [showWeak, setShowWeak] = useState(false);

  if (r.verse) {
    const v = r.verse;
    return (
      <div className="space-y-1 rounded-xl border border-line bg-paper px-3.5 py-2 text-[14px]">
        <Row label={t("label.source")}>
          <span className="font-semibold text-brand-ink">{t("verse.ref", { s: plainSurah(v.surahName), a: num(v.ayah) + (v.endAyah ? `–${num(v.endAyah)}` : "") })}</span>
        </Row>
        {v.wording?.qiraat?.map((q) => (
          <Row key={q.typed} label={t("label.qiraa")}>
            <span translate="no" lang="ar" className="quran text-[17px] text-ink">«{q.typed}»</span>{" "}
            {t("qiraa.of", { readers: "{readers}" }).split("{readers}").map((part, i) =>
              i ? (
                <React.Fragment key={i}>
                  <bdi translate="no" lang="ar" dir="rtl" className="font-semibold">{readersLine(q.readers)}</bdi>
                  {part}
                </React.Fragment>
              ) : (
                part
              ),
            )}
          </Row>
        ))}
        <Row label={t("label.text")}>{t("label.mushafSource")}</Row>
        {v.wording?.qiraat?.length ? <p className="text-[12px] text-muted">{t("qiraa.note")}</p> : null}
        <ViaRow links={viaLinks(r)} />
      </div>
    );
  }

  if (r.dorar) {
    const [first, ...rest] = r.dorar.narrations;
    const weakList = r.dorar.weakVariants;
    return (
      <div className="space-y-2">
        {r.dorar.summary.disputed && <p className="text-[13px] text-muted">{t("note.disputed")}</p>}
        {[...r.dorar.narrations, ...(weakList ?? [])].some((n) => n.textVariant) && <p role="note" className="text-[13px] text-muted">{t("note.variantSummary")}</p>}
        <div className="space-y-1 rounded-xl border border-line bg-paper px-3.5 py-2 text-[14px]">
          {first?.source && (
            <Row label={t("label.source")}>
              <span className="font-semibold text-brand-ink">{first.source}</span>
              {first.reference ? `، ${first.reference}` : ""}
            </Row>
          )}
          {first?.muhaddith && <Row label={t("label.scholar")}>{first.muhaddith}</Row>}
          {first && <NarrationVerdict n={first} />}
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
        {weakList && weakList.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-line/60">
            <button
              type="button"
              onClick={() => setShowWeak((w) => !w)}
              aria-expanded={showWeak}
              className="min-h-11 text-[13px] text-muted underline underline-offset-[5px] cursor-pointer hover:text-brand-ink"
            >
              {showWeak ? t("narrations.fewer") : t("narrations.weakVariants", { n: num(weakList.length) })}
            </button>
            {showWeak && (
              <ul className="space-y-2">
                {weakList.map((n, i) => (
                  <NarrationRow key={`weak-${i}`} n={n} />
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
            <span className="font-semibold text-brand-ink">{splitReferenceUrl(s.reference).text}</span>
          </Row>
        )}
        {s.verdict_by && <Row label={t("label.scholar")}>{s.verdict_by}</Row>}
        {s.verdict && (
          <Row label={t("label.words")}>
            <span translate="no" lang="ar" dir="rtl">
              {s.verdict}
            </span>
          </Row>
        )}
        {s.claimed_attribution && <Row label={t("label.attributed")}>{s.claimed_attribution}</Row>}
        {s.correct_text && (
          <Row label={t("label.correct")}>
            <span translate="no" className="quran text-[17px]">{s.correct_text}</span>
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

/** Sends the report to the team (/api/report). If it cannot be sent it is kept on this device, and the page says it was
 *  not sent: thanking the reader for a report nobody received would not be true. */
async function sendReport(r: ClaimResult, locale: string): Promise<boolean> {
  const report = { text: r.claim.textAsWritten, query: r.claim.query, state: r.state, locale };
  try {
    const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
    if (res.ok) return true;
  } catch {
    /* offline or blocked: kept below */
  }
  try {
    const list = JSON.parse(localStorage.getItem(REPORTS_KEY) ?? "[]") as unknown[];
    list.push({ at: new Date().toISOString(), ...report });
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* storage unavailable */
  }
  return false;
}

interface Props {
  result: ClaimResult;
  index: number;
  total: number;
  onOrigin: (query: string) => void;
  onEdit: () => void;
  /** the user chose another verse of «هل تقصد؟» */
  onPick: (candidate: number) => void;
  /** every claim of the post: with more than one, copy and share first ask which to take */
  all?: ClaimResult[];
}

export function ClaimDetail({ result: r, index, total, onOrigin, onEdit, onPick, all }: Props) {
  const { t, num, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState<{ text: string; status: "sending" | "sent" | "failed" } | null>(null);
  const [picking, setPicking] = useState(false);
  const several = (all?.length ?? 0) > 1;
  const tone = toneOf(r.state);
  const quote = r.claim.arabicSpan || r.claim.textAsWritten;
  // a question is shown by its topic, never by its own words: the books were asked the topic only
  const isQuestion = r.claim.kind === "question";
  const [shareOutcome, setShareOutcome] = useState<ShareOutcome | null>(null);
  const reportedHere = reported?.text === r.claim.textAsWritten ? reported.status : null;

  const shareText = useCallback(() => buildShareText([r], locale), [r, locale]);

  const copy = async () => {
    if (several) return setPicking(true);
    try {
      await navigator.clipboard.writeText(shareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  const share = async () => {
    if (several) return setPicking(true);
    setShareOutcome(await shareOrCopy(shareText()));
  };

  const message =
    tone === "notFound" ? (
      <div className="space-y-2">
        <p className="text-base">{t("notfound.body")}</p>
        {r.claim.citedSource && (
          <p className="text-[14px]">
            <span className="text-muted">{t("label.cited")}: </span>
            <span translate="no" lang="ar" dir="rtl">
              {r.claim.citedSource}
            </span>
          </p>
        )}
        <p className="text-[14px] text-muted">{t("notfound.hint")}</p>
      </div>
    ) : tone === "fatwa" ? (
      // a personal case: the answer is to ask a mufti, so that comes first; the books are offered after it, closed
      <div className="space-y-1">
        <p className="text-[17px] font-semibold leading-relaxed text-ink">{t("fiqh.refer")}</p>
        {!r.claim.topic && <p className="text-[14px] text-muted">{t("fatwa.body")}</p>}
      </div>
    ) : isQuestion && r.claim.topic ? (
      <p className="text-[14px]">{t("fiqh.topic", { topic: r.claim.topic })}</p>
    ) : tone === "translated" ? (
      <p className="text-[14px] text-muted">{t("translated.body")}</p>
    ) : null;

  return (
    <section aria-label={t("result.title")} className="space-y-3">
      {r.verse?.candidates && r.verse.candidates.length > 1 && <CandidateList candidates={r.verse.candidates} picked={pickedIndex(r)} onPick={onPick} />}

      <div className="flex items-center justify-between gap-3">
        <StateBadge state={r.state} size="lg" long />
        {total > 1 && <span className="text-[13px] text-muted">{t("result.of", { i: num(index + 1), n: num(total) })}</span>}
      </div>

      {tone !== "notFound" && tone !== "fatwa" && !isQuestion && <p translate="no" className="quran text-[22px] text-ink">{quote}</p>}
      {message}
      {matchedArabic(r) && (
        <div role="note" className="space-y-1 rounded-xl border border-line bg-paper p-3">
          <p className="text-[12px] text-muted">{t("label.matchedArabic")}</p>
          <p translate="no" lang="ar" dir="rtl" className="quran text-[22px]">{matchedArabic(r)}</p>
          <p className="text-[13px] text-muted">{t("note.translationMatch")}</p>
        </div>
      )}

      {r.verse && (
        <div className="space-y-2">
          {r.verse.wording?.contextOmitted && <p role="note" className="rounded-xl border border-line bg-paper p-3 text-[14px]">{t("verse.contextWarning")}</p>}
          <Diffs r={r} />
          {(tone === "misquote" || tone === "translated" || Boolean(r.verse.wording?.qiraat?.length)) && (
            <div className="rounded-xl border border-line bg-paper p-3">
              <p className="text-[12px] text-muted">{t("label.mushaf")}</p>
              <p translate="no" className="quran text-[24px]">{r.verse.text}</p>
            </div>
          )}
        </div>
      )}

      {r.claim.kind === "scholar_quote" && r.dorar && <p className="text-[13px] text-muted">{t("note.scholar")}</p>}

      <SourceBox r={r} />
      {r.similarExpressions?.length ? <SimilarExpressions key={r.claim.textAsWritten} candidates={r.similarExpressions} /> : null}

      {isQuestion ? (
        <FiqhBox
          r={r}
          lead={tone === "fatwa" && <p className="pt-2 text-[14px] text-muted">{t("fiqh.optional")}</p>}
          intro={
            tone === "fatwa" && (
              <div className="space-y-1 rounded-xl border border-line bg-paper p-3 text-[14px]">
                {r.claim.topic && <p>{t("fiqh.topic", { topic: r.claim.topic })}</p>}
                <p className="font-semibold" style={{ color: "var(--t-weak-fg)" }}>{t("fatwa.warn")}</p>
              </div>
            )
          }
        />
      ) : (
        <TurathBox r={r} />
      )}

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
            <Button full onClick={share}>
              <Icon name="share" size={16} />
              <span>{t("action.share")}</span>
            </Button>
          </>
        )}
      </div>

      <ShareNote outcome={shareOutcome} text={shareText()} />

      {several && picking && <ShareDialog open onClose={() => setPicking(false)} claims={all!} />}

      <div className="flex flex-wrap items-center justify-center gap-x-4">
        {tone !== "fatwa" && tone !== "notFound" && !isQuestion && (
          <Button variant="ghost" size="sm" onClick={() => onOrigin(r.claim.query || r.claim.textAsWritten)}>
            {t("action.origin")}
          </Button>
        )}
        {reportedHere === "sent" || reportedHere === "failed" ? (
          <span className="py-3 text-[13px] text-muted" role="status">
            {t(reportedHere === "sent" ? "action.reported" : "action.reportFailed")}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={reportedHere === "sending"}
            onClick={async () => {
              const text = r.claim.textAsWritten;
              setReported({ text, status: "sending" });
              setReported({ text, status: (await sendReport(r, locale)) ? "sent" : "failed" });
            }}
          >
            {t("action.report")}
          </Button>
        )}
      </div>
    </section>
  );
}
