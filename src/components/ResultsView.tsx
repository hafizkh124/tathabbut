"use client";
import React, { useMemo, useState } from "react";
import type { ClaimResult } from "@/lib/clientTypes";
import { applyPick } from "@/lib/candidates";
import { segmentPost } from "@/lib/highlight";
import { styleOf } from "@/lib/gradeStyle";
import { useI18n } from "@/lib/i18n/i18n";
import { ClaimDetail } from "./ClaimDetail";
import { StateBadge } from "./ui/Badge";

/** The claim's own words, short enough for a tab. */
function tabLabel(c: ClaimResult): string {
  const words = (c.claim.arabicSpan || c.claim.textAsWritten).trim().split(/\s+/);
  return words.length > 4 ? `${words.slice(0, 4).join(" ")}…` : words.join(" ");
}

/** One tab per claim of the post, above its result, so the other claims stay one tap away.
 *  The number and its colour are the same as on the marked text. */
function ClaimTabs({ claims, selected, onSelect }: { claims: ClaimResult[]; selected: number; onSelect: (i: number) => void }) {
  const { num } = useI18n();
  return (
    <div role="group" className="flex flex-wrap gap-2">
      {claims.map((c, i) => {
        const s = styleOf(c.state);
        const on = i === selected;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(i)}
            className={`inline-flex min-h-11 flex-none cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[14px] ${on ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-line bg-surface text-ink hover:bg-paper"}`}
          >
            <span aria-hidden className="inline-block min-w-5 rounded-full text-center text-[12px] font-semibold leading-5" style={{ background: s.fg, color: "var(--surface)", fontFamily: "var(--font-readex), sans-serif" }}>
              {num(i + 1)}
            </span>
            <span translate="no" className="quran max-w-[11rem] truncate" lang={c.claim.language === "ar" ? "ar" : undefined}>{tabLabel(c)}</span>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  post: string;
  claims: ClaimResult[];
  selected: number;
  onSelect: (i: number) => void;
  onOrigin: (query: string) => void;
  onEdit: () => void;
  onNew: () => void;
}

function ClaimMark({ index, state, selected, text, arabic, onClick }: { index: number; state: string; selected: boolean; text: string; arabic: boolean; onClick: () => void }) {
  const { num } = useI18n();
  const s = styleOf(state);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${arabic ? "font-quran" : ""} inline cursor-pointer rounded-md px-1 text-start`}
      style={{
        textDecorationLine: "underline",
        textDecorationThickness: 4,
        textUnderlineOffset: 7,
        textDecorationColor: s.line,
        textDecorationStyle: s.dashed ? "dashed" : "solid",
        background: selected ? s.bg : "transparent",
        color: s.fg,
        font: "inherit",
        fontWeight: 700,
      }}
    >
      {text}
      <span
        aria-hidden
        className="mx-1 inline-block min-w-5 rounded-full text-center align-middle text-[12px] font-semibold leading-5"
        style={{ background: s.fg, color: "var(--surface)", fontFamily: "var(--font-readex), sans-serif" }}
      >
        {num(index + 1)}
      </span>
    </button>
  );
}

/** What the colours under the text mean: one line for each state found in this post, in the order they first appear. */
function Legend({ claims }: { claims: ClaimResult[] }) {
  const { state: label } = useI18n();
  const seen = new Map<string, string>();
  for (const c of claims) {
    const name = label(c.state);
    if (!seen.has(name)) seen.set(name, styleOf(c.state).line);
  }
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted lg:flex-col lg:gap-2.5">
      {[...seen].map(([name, colour]) => (
        <li key={name} className="flex items-center gap-2">
          <span aria-hidden className="h-3.5 w-3.5 flex-none rounded" style={{ background: colour }} />
          {name}
        </li>
      ))}
    </ul>
  );
}

export function ResultsView({ post, claims: found, selected, onSelect, onOrigin, onEdit, onNew }: Props) {
  const { t, count } = useI18n();
  // the verse the user chose for each claim that fits several («هل تقصد؟»); the result follows the choice
  const [picks, setPicks] = useState<Record<number, number>>({});
  const claims = useMemo(() => found.map((c, i) => applyPick(c, picks[i])), [found, picks]);
  const { segments, placed } = useMemo(() => segmentPost(post, claims.map((c) => ({ textAsWritten: c.claim.textAsWritten, arabicSpan: c.claim.arabicSpan, query: c.claim.query }))), [post, claims]);
  const current = claims[selected] ?? claims[0];
  const unplaced = claims.map((c, i) => ({ c, i })).filter(({ i }) => !placed[i]);
  const isOnlyUnplaced = placed.every((p) => !p);
  // An Urdu message with an Arabic quotation in it: the message is set in Nastaliq, only the quotation in Amiri.
  const urdu = /[ٹڈڑںھے]/.test(post);
  const mostlyArabic = !urdu && claims.filter((c) => c.claim.language === "ar").length * 2 >= claims.length;

  const text = (
    <div
      className={`rounded-xl border border-line bg-paper px-3.5 py-3 text-[19px] lg:rounded-[14px] lg:bg-surface lg:p-[22px] lg:text-[24px] ${urdu ? "leading-[2.7]" : "leading-[2.2]"} ${mostlyArabic ? "font-quran" : ""}`}
      style={urdu ? { fontFamily: "var(--font-nastaliq), serif" } : undefined}
      dir="auto"
    >
      {segments.map((seg, i) =>
        seg.claim === null ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <ClaimMark
            key={i}
            index={seg.claim}
            state={claims[seg.claim].state}
            selected={seg.claim === selected}
            text={seg.text}
            arabic={claims[seg.claim].claim.language === "ar"}
            onClick={() => onSelect(seg.claim as number)}
          />
        ),
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:min-h-[calc(100vh-70px)] lg:grid-cols-[1fr_1.25fr]">
      {/* the post as it was pasted, its claims marked in their colours */}
      <div className="mx-auto w-full max-w-3xl space-y-3.5 px-5 pt-5 sm:px-6 lg:max-w-none lg:space-y-5 lg:bg-brand-soft lg:px-12 lg:py-12">
        <div className="flex items-baseline gap-2 lg:hidden">
          <h1 className="text-xl font-bold text-brand-ink">{t("result.title")}</h1>
          <span className="text-[13px] text-muted">{count(claims.length)}</span>
        </div>
        {!isOnlyUnplaced && (
          <>
            <h2 className="hidden text-[15px] font-semibold text-muted lg:block">{t("result.yourText")}</h2>
            {text}
            {claims.length > 1 && <p className="text-[13px] text-muted">{t("result.tap")}</p>}
            <div className="hidden lg:block">
              <Legend claims={claims} />
            </div>
          </>
        )}

        {unplaced.length > 0 && (
          <div className="space-y-2">
            {!isOnlyUnplaced && <p className="text-[13px] font-semibold text-muted">{t("result.unplaced")}</p>}
            <ul className="space-y-2">
              {unplaced.map(({ c, i }) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-pressed={i === selected}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2 text-start cursor-pointer ${i === selected ? "border-brand" : "border-line"}`}
                  >
                    <span translate="no" className="quran text-[18px]">{c.claim.arabicSpan || c.claim.textAsWritten}</span>
                    <StateBadge state={c.state} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* the result of the chosen claim */}
      {current && (
        <div className="mx-auto w-full max-w-3xl space-y-4 px-5 pb-6 pt-3.5 sm:px-6 lg:max-w-[52rem] lg:space-y-5 lg:px-12 lg:py-12">
          <div className="hidden items-baseline gap-2 lg:flex">
            <h1 className="text-xl font-bold text-brand-ink">{t("result.title")}</h1>
            <span className="text-[13px] text-muted">{count(claims.length)}</span>
          </div>
          {claims.length > 1 && <ClaimTabs claims={claims} selected={selected} onSelect={onSelect} />}
          <ClaimDetail result={current} all={claims} index={selected} total={claims.length} onOrigin={onOrigin} onEdit={onEdit} onNew={onNew} onPick={(k) => setPicks((p) => ({ ...p, [selected]: k }))} />
        </div>
      )}
    </div>
  );
}
