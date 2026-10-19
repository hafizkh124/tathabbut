"use client";
import React from "react";
import { levelOf } from "@/lib/levels";
import { useI18n } from "@/lib/i18n/i18n";

/** The content level of a result (أ–د) as a small round mark; its sentence is the tooltip and the screen-reader label. */
export function LevelBadge({ state }: { state: string }) {
  const { t } = useI18n();
  const level = levelOf(state);
  const title = `${t("level.label")} ${t(`level.${level}`)}: ${t(`level.${level}.desc`)}`;
  return (
    <span
      title={title}
      aria-label={title}
      role="img"
      className="nastaliq-pad inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-line bg-surface px-2 text-[13px] font-semibold text-ink"
    >
      {t(`level.${level}`)}
    </span>
  );
}
