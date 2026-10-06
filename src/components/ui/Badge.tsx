"use client";
import React from "react";
import { styleOf } from "@/lib/gradeStyle";
import { useI18n } from "@/lib/i18n/i18n";
import { Icon } from "./Icon";

const SIZES = {
  sm: { pad: "px-2.5 py-0.5 text-[13px]", icon: 13 },
  md: { pad: "px-3.5 py-1 text-[15px]", icon: 16 },
  lg: { pad: "px-4 py-1.5 text-lg", icon: 20 },
} as const;

/** A state as a pill: the word first, then its icon («ضعيف !»). The colour comes from the state, never from the caller.
 *  `solid` fills the pill with the state's text colour (the line colour is too light for text on it): the verdict at the head
 *  of a result. */
export function StateBadge({ state, size = "md", long = false, caution = false, solid = false }: { state: string; size?: keyof typeof SIZES; long?: boolean; caution?: boolean; solid?: boolean }) {
  const { state: label } = useI18n();
  const s = styleOf(state);
  const z = SIZES[size];
  return (
    <span
      className={`nastaliq-pad inline-flex items-center gap-2 rounded-full border-[1.5px] font-semibold leading-snug ${z.pad}`}
      style={solid ? { background: s.fg, color: "var(--surface)", borderColor: s.fg } : { background: s.bg, color: s.fg, borderColor: s.bd, borderStyle: s.dashed ? "dashed" : "solid" }}
    >
      <span>{label(state, long)}</span>
      {caution && <span aria-hidden>*</span>}
      <Icon name={s.icon} size={z.icon} strokeWidth={2.2} />
    </span>
  );
}
