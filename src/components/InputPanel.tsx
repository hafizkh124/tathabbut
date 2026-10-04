"use client";
import React, { useId } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { Key } from "@/lib/i18n/dict";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

export const MAX_TEXT = 5_000;

const EXAMPLES: Array<{ key: Key; text: string }> = [
  { key: "example.verse", text: "قال الله تعالى: إن الله مع الصابرون" },
  { key: "example.hadith", text: "قال النبي ﷺ: اطلبوا العلم ولو بالصين" },
  { key: "example.saying", text: "روي أن النبي ﷺ قال: لولاك لما خلقت الأفلاك" },
  { key: "example.question", text: "هل يقع الطلاق في حالة الغضب؟" },
];

function Soon({ label }: { label: string }) {
  return <span className="rounded-full bg-line px-2 py-px text-[11px] font-medium leading-5">{label}</span>;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
}

export function InputPanel({ value, onChange, onSubmit, busy }: Props) {
  const { t, num, dir } = useI18n();
  const id = useId();
  const tooLong = value.length > MAX_TEXT;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-brand-ink">{t("home.title")}</h1>
        <p className="text-[14px] text-muted">{t("home.sub")}</p>
      </div>

      <div className="space-y-2 rounded-2xl border-2 border-brand bg-surface px-4 pb-3 pt-3">
        <label htmlFor={id} className="text-[12px] font-semibold text-brand-ink">
          {t("home.label")}
        </label>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit();
          }}
          placeholder={t("home.placeholder")}
          rows={4}
          dir={value ? "auto" : dir}
          className="font-quran block w-full resize-none bg-transparent text-[20px] leading-[2.1] text-ink placeholder:text-muted focus:outline-none"
        />
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>{t("home.hint")}</span>
          <span className={tooLong ? "font-semibold text-[color:var(--t-veryWeak-line)]" : ""} aria-live="polite">
            {num(value.length)} / {num(MAX_TEXT)}
          </span>
        </div>
      </div>

      <div className="flex gap-2.5">
        <Button variant="secondary" full disabled title={t("home.soon")}>
          <span>{t("home.image")}</span>
          <Icon name="image" size={18} />
          <Soon label={t("home.soon")} />
        </Button>
        <Button variant="secondary" full disabled title={t("home.soon")}>
          <span>{t("home.voice")}</span>
          <Icon name="mic" size={18} />
          <Soon label={t("home.soon")} />
        </Button>
      </div>

      <Button size="lg" full onClick={onSubmit} disabled={busy || !value.trim() || tooLong}>
        {t("home.verify")}
      </Button>

      <div className="space-y-2">
        <p className="text-[13px] text-muted">{t("home.examples")}</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => onChange(e.text)}
              className="nastaliq-pad min-h-10 cursor-pointer rounded-full border-[1.5px] border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-paper"
            >
              {t(e.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <span className="inline-flex min-h-11 items-center gap-2 text-[13px] text-muted">
          <Icon name="history" size={16} />
          <span>{t("home.history")}</span>
          <Soon label={t("home.soon")} />
        </span>
      </div>
    </div>
  );
}
