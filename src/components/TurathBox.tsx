"use client";
import React, { useState } from "react";
import type { ClaimResult } from "@/lib/clientTypes";
import type { TurathReference } from "@/lib/hadithMatch";
import { DICT, type Key } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/i18n";
import { findPhrase } from "@/lib/turathText";
import { Icon } from "./ui/Icon";

/** The references shown at once; the rest are behind «Other results». */
const SHOWN = 3;
/** An excerpt is folded to this many lines until the reader asks for all of it. */
const FOLDED_LINES = 6;

/** Where the books hold a text Dorar gave no verdict on: said outright, since a card of «غير حاسم» alone would not tell it. */
export function TurathBasisLine({ r }: { r: ClaimResult }) {
  const { t } = useI18n();
  const first = r.turath && r.turath.status === "success" ? r.turath.references[0] : undefined;
  if (!first) return null;
  const key: Key = r.claim.kind === "scholar_quote" ? "turath.basis.saying" : r.turathReason === "dorar-unavailable" ? "turath.basis.hadithDown" : "turath.basis.hadith";
  return <p className="text-base">{t(key, { book: first.book.title })}</p>;
}

function PageLine({ ref_ }: { ref_: TurathReference }) {
  const { t, num } = useI18n();
  const loc = ref_.pageLocator;
  if (!loc) return null;
  const parts: string[] = [];
  if (loc.volume && loc.printedPage !== undefined) parts.push(t("label.pages", { v: num(loc.volume), p: num(loc.printedPage) }));
  else if (loc.printedPage !== undefined) parts.push(t("turath.printedPage", { p: num(loc.printedPage) }));
  else if (loc.volume) parts.push(t("turath.volume", { v: num(loc.volume) }));
  // Turath's own page key is shown apart from the printed page and never as one
  if (loc.internalPage !== undefined) parts.push(t("turath.page", { p: num(loc.internalPage) }));
  return parts.length ? <p className="text-muted">{parts.join(" · ")}</p> : null;
}

/** The passage with the asked phrase marked. Folded, a passage whose phrase lies far in starts just before it, so the fold never hides it. */
function Excerpt({ text, phrase, folded }: { text: string; phrase: string; folded: boolean }) {
  const hit = findPhrase(text, phrase);
  if (!hit) return <>{text}</>;
  const skip = folded && hit[0] > 220 ? text.lastIndexOf(" ", hit[0] - 120) + 1 : 0;
  const body = text.slice(skip);
  const [a, b] = [hit[0] - skip, hit[1] - skip];
  return (
    <>
      {skip > 0 && "… "}
      {body.slice(0, a)}
      <mark className="rounded px-0.5 text-ink" style={{ background: "color-mix(in srgb, var(--gold) 38%, transparent)" }}>
        {body.slice(a, b)}
      </mark>
      {body.slice(b)}
    </>
  );
}

function ReferenceCard({ r: ref_, phrase }: { r: TurathReference; phrase: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const catKey = ref_.category ? (`turath.cat.${ref_.category.id}` as Key) : null;
  const category = ref_.category ? (catKey && catKey in DICT ? t(catKey) : ref_.category.title) : null;
  const long = ref_.excerpt.length > 400;
  return (
    <li className="space-y-1 rounded-xl border border-line bg-paper p-3 text-[14px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-semibold text-brand-ink" lang="ar" dir="rtl">
          {ref_.book.title}
          {ref_.author?.name ? ` — ${ref_.author.name}` : ""}
        </span>
        {category && <span className="rounded-full border border-line px-2 py-0.5 text-[12px] text-muted">{category}</span>}
      </div>
      <PageLine ref_={ref_} />
      {ref_.rulingBook && <p className="text-[13px] font-semibold text-ink">{t("turath.ruling")}</p>}
      <p
        className="quran text-[18px] leading-[2.1] text-ink"
        lang="ar"
        dir="rtl"
        style={open || !long ? undefined : { display: "-webkit-box", WebkitLineClamp: FOLDED_LINES, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        <Excerpt text={ref_.excerpt} phrase={phrase} folded={!open && long} />
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-h-11 text-[13px] text-brand-ink underline underline-offset-[5px] cursor-pointer">
          {open ? t("narrations.fewer") : t("turath.expand")}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-x-4 pt-0.5">
        <span className="text-muted">{t("label.via")}:</span>
        <a href={ref_.url} target="_blank" rel="noopener noreferrer" title={t("via.opens")} className="inline-flex items-center gap-1 py-2 text-[14px] text-brand-ink underline underline-offset-[5px] hover:text-brand-hover">
          <span>{t("via.turath")}</span>
          <Icon name="ext" size={11} />
        </a>
      </div>
    </li>
  );
}

/** The passages of the books that hold the claim's text, under the result. It never changes the result by itself: the state is
 *  changed only by the server's patch (turathFallback.ts), and no passage is read as a verdict. */
export function TurathBox({ r }: { r: ClaimResult }) {
  const { t, num } = useI18n();
  const [more, setMore] = useState(false);
  const turath = r.turath;
  if (!turath) return null;

  if (turath.status === "loading") {
    return (
      <p className="text-[13px] text-muted" role="status" aria-live="polite">
        {t("turath.loading")}
      </p>
    );
  }
  if (turath.status === "unavailable") return <p className="text-[13px] text-muted">{t("turath.unavailable")}</p>;

  const partial = turath.partial ? <p className="text-[13px] text-muted">{t("turath.partial")}</p> : null;
  if (turath.references.length === 0) return partial;

  const [shown, rest] = [turath.references.slice(0, SHOWN), turath.references.slice(SHOWN)];
  return (
    <div className="space-y-2 border-t border-line/60 pt-2">
      <p className="text-[13px] font-semibold text-muted">{t("turath.title")}</p>
      <ul className="space-y-2">
        {shown.map((ref_, i) => (
          <ReferenceCard key={`${ref_.bookId}:${ref_.pageLocator?.internalPage ?? i}`} r={ref_} phrase={r.claim.query} />
        ))}
      </ul>
      {rest.length > 0 && (
        <div className="space-y-2">
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="min-h-11 text-[14px] text-brand-ink underline underline-offset-[5px] cursor-pointer">
            {more ? t("narrations.fewer") : t("narrations.more", { n: num(rest.length) })}
          </button>
          {more && (
            <ul className="space-y-2">
              {rest.map((ref_, i) => (
                <ReferenceCard key={`${ref_.bookId}:${ref_.pageLocator?.internalPage ?? i}:more`} r={ref_} phrase={r.claim.query} />
              ))}
            </ul>
          )}
        </div>
      )}
      {partial}
    </div>
  );
}
