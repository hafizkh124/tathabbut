"use client";
import React, { useId, useMemo, useState } from "react";
import { markWords } from "@/lib/highlight";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

interface Props {
  text: string;
  uncertain: string[];
  /** the shrunk picture the text was read from, shown beside the reading so it can be compared */
  previewUrl: string;
  onConfirm: (text: string) => void;
  onBack: () => void;
}

/** After a picture is read: «هل هذا هو النص؟». The reading is shown next to the picture with the unsure words marked;
 *  the person fixes it if needed and confirms, and only then is it checked. */
export function TextConfirm({ text, uncertain, previewUrl, onConfirm, onBack }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [value, setValue] = useState(text);
  const [editing, setEditing] = useState(false);
  const pieces = useMemo(() => markWords(value, value === text ? uncertain : []), [value, text, uncertain]);
  const unsure = pieces.filter((p) => p.flagged);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-brand-ink">{t("ocr.title")}</h1>
        <p className="text-[14px] text-muted">{t("ocr.sub")}</p>
      </div>

      <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-line bg-surface" title={t("ocr.picture")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL of the user's own picture */}
        <img src={previewUrl} alt={t("ocr.picture")} className="mx-auto h-auto max-h-44 w-auto max-w-full object-contain" />
      </a>

      <div className="space-y-2 rounded-2xl border-[1.5px] border-line-strong bg-surface px-5 pb-3.5 pt-4 transition-colors focus-within:border-brand">
        <label htmlFor={id} className="block pb-1 text-[12px] font-semibold text-brand-ink">
          {t("ocr.label")}
        </label>
        {editing ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            dir="auto"
            autoFocus
            className="font-quran block w-full resize-none bg-transparent text-[20px] leading-[2.1] text-ink focus:outline-none focus-visible:outline-none"
          />
        ) : (
          <p id={id} className="font-quran whitespace-pre-line text-[20px] leading-[2.2] text-ink" dir="auto">
            {pieces.map((p, i) =>
              p.flagged ? (
                <mark key={i} className="rounded-md px-1 text-inherit" style={{ background: "var(--t-weak-bg)", textDecorationLine: "underline", textDecorationStyle: "dashed", textDecorationThickness: 2, textUnderlineOffset: 6, textDecorationColor: "var(--t-weak-line)" }}>
                  {p.text}
                </mark>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </p>
        )}
        {unsure.length > 0 && !editing && (
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--t-weak-fg)" }}>
            <Icon name="bang" size={14} />
            <span>{t("ocr.uncertain")}</span>
          </p>
        )}
      </div>

      <p className="text-[12px] text-muted">{t("ocr.privacy")}</p>

      <div className="flex flex-col gap-2.5 border-t border-line pt-3">
        {editing ? (
          <Button size="lg" onClick={() => setEditing(false)} disabled={!value.trim()}>
            {t("action.done")}
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={() => onConfirm(value)} disabled={!value.trim()}>
              {t("ocr.confirm")}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t("action.edit")}
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t("action.back")}
        </Button>
      </div>
    </div>
  );
}
