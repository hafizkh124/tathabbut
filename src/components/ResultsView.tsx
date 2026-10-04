"use client";
import React, { useMemo, useState } from "react";
import type { ClaimResult } from "@/lib/clientTypes";
import { applyPick } from "@/lib/candidates";
import { segmentPost } from "@/lib/highlight";
import { styleOf } from "@/lib/gradeStyle";
import { useI18n } from "@/lib/i18n/i18n";
import { ClaimDetail } from "./ClaimDetail";
import { Button } from "./ui/Button";
import { StateBadge } from "./ui/Badge";

interface Props {
  post: string;
  claims: ClaimResult[];
  selected: number;
  onSelect: (i: number) => void;
  onOrigin: (query: string) => void;
  onEdit: () => void;
  onNew: () => void;
}

/** Counts per state, in the order they first appear: «مقبول 1 · ضعيف 1». */
function summarize(claims: ClaimResult[]) {
  const map = new Map<string, number>();
  for (const c of claims) map.set(c.state, (map.get(c.state) ?? 0) + 1);
  return Array.from(map, ([state, n]) => ({ state, n }));
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
        color: "inherit",
        font: "inherit",
      }}
    >
      {text}
      <span
        aria-hidden
        className="mx-1 inline-block min-w-5 rounded-full text-center align-middle text-[12px] font-semibold leading-5 text-white"
        style={{ background: s.line, fontFamily: "var(--font-readex), sans-serif" }}
      >
        {num(index + 1)}
      </span>
    </button>
  );
}

export function ResultsView({ post, claims: found, selected, onSelect, onOrigin, onEdit, onNew }: Props) {
  const { t, count, num } = useI18n();
  // the verse the user chose for each claim that fits several («هل تقصد؟»); the result follows the choice
  const [picks, setPicks] = useState<Record<number, number>>({});
  const claims = useMemo(() => found.map((c, i) => applyPick(c, picks[i])), [found, picks]);
  const { segments, placed } = useMemo(() => segmentPost(post, claims.map((c) => ({ textAsWritten: c.claim.textAsWritten, arabicSpan: c.claim.arabicSpan, query: c.claim.query }))), [post, claims]);
  const summary = useMemo(() => summarize(claims), [claims]);
  const current = claims[selected] ?? claims[0];
  const unplaced = claims.map((c, i) => ({ c, i })).filter(({ i }) => !placed[i]);
  const isOnlyUnplaced = placed.every((p) => !p);
  // An Urdu message with an Arabic quotation in it: the message is set in Nastaliq, only the quotation in Amiri.
  const urdu = /[ٹڈڑںھے]/.test(post);
  const mostlyArabic = !urdu && claims.filter((c) => c.claim.language === "ar").length * 2 >= claims.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold text-brand-ink">{t("result.title")}</h1>
          <span className="text-[13px] text-muted">{count(claims.length)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {claims.length > 1 && summary.map(({ state, n }) => (
            <span key={state} className="inline-flex items-center gap-1">
              <StateBadge state={state} size="sm" />
              {n > 1 && <span className="text-[12px] text-muted">×{num(n)}</span>}
            </span>
          ))}
        </div>
      </div>

      {!isOnlyUnplaced && (
        <>
          <div className={`rounded-2xl border border-line bg-surface px-4 py-3 text-[20px] ${urdu ? "leading-[2.7]" : "leading-[2.3]"} ${mostlyArabic ? "font-quran" : ""}`}
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
          {claims.length > 1 && <p className="text-[13px] text-muted">{t("result.tap")}</p>}
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
                  <span className="quran text-[18px]">{c.claim.arabicSpan || c.claim.textAsWritten}</span>
                  <StateBadge state={c.state} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detail: a sheet at the bottom on phones, a card under the text on larger screens */}
      {current && (
        <>
          <div
            className="sticky bottom-0 z-20 -mx-4 max-h-[62vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pb-4 pt-2.5 sm:static sm:mx-0 sm:max-h-none sm:rounded-2xl sm:border sm:px-5 sm:py-4"
            style={{ boxShadow: "var(--shadow-sheet)" }}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
            <ClaimDetail result={current} index={selected} total={claims.length} onOrigin={onOrigin} onEdit={onEdit} onPick={(k) => setPicks((p) => ({ ...p, [selected]: k }))} />
          </div>
        </>
      )}

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={onNew}>
          {t("result.new")}
        </Button>
      </div>
    </div>
  );
}

