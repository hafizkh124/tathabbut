"use client";
import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { Key } from "@/lib/i18n/dict";
import { imageFromClipboard, imageFromDrop } from "@/lib/pickImage";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

export const MAX_TEXT = 5_000;

/** One example for each case the tool handles, all from the final test set (eval 2026-10-06) with the expected result. */
const EXAMPLES: Array<{ key: Key; text: string }> = [
  { key: "example.verse", text: "إن الله مع الصابرون" }, // T027: a misquoted verse
  { key: "example.sahih", text: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى" }, // T001: accepted, al-Bukhari 1
  { key: "example.weak", text: "صوموا تصحوا" }, // T011: weak
  { key: "example.hadith", text: "اطلبوا العلم ولو بالصين" }, // T013: very weak or baseless
  { key: "example.fabricated", text: "من صلى ركعتين يوم الخميس بعد العصر غفر الله له ذنوب أربعين سنة" }, // T034: not found
  { key: "example.question", text: "أنا مقيم في ألمانيا، هل يجوز لي الجمع بين الظهر والعصر بسبب العمل؟" }, // T037: referred to scholars
];

/** A phone or tablet (touch first): the camera button is shown there; on a computer it would only open the file dialog. */
function useTouchFirst(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(pointer: coarse)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** a picture was added: chosen from the device, taken with the camera, dropped here or pasted */
  onImage: (file: File) => void;
  busy?: boolean;
}

export function InputPanel({ value, onChange, onSubmit, onImage, busy }: Props) {
  const { t, num, dir } = useI18n();
  const id = useId();
  const tooLong = value.length > MAX_TEXT;
  const files = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const touch = useTouchFirst();
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0); // dragenter/dragleave also fire for every child, so they are counted

  // a picture copied anywhere (a screenshot, an image from a page) can be pasted straight in; pasted text is left alone
  useEffect(() => {
    if (busy) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromClipboard(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      onImage(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [busy, onImage]);

  const choose = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // the same picture can be chosen again
      if (file) onImage(file);
    },
    [onImage],
  );

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className="relative space-y-4"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault(); // without this the browser would open the file instead
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        const file = imageFromDrop(e.dataTransfer);
        if (file && !busy) onImage(file);
      }}
    >
      {dragging && (
        <div
          className="pointer-events-none absolute -inset-2 z-10 flex items-center justify-center rounded-3xl border-[3px] border-dashed border-brand bg-brand-soft/90 text-lg font-bold text-brand-ink"
          role="status"
        >
          {t("home.drop")}
        </div>
      )}

      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-brand-ink">{t("home.title")}</h1>
        <p className="text-[14px] text-muted">{t("home.sub")}</p>
      </div>

      <div className="space-y-2 rounded-2xl border-[1.5px] border-line-strong bg-surface px-5 pb-3.5 pt-4 transition-colors focus-within:border-brand">
        <label htmlFor={id} className="block pb-1 text-[12px] font-semibold text-brand-ink">
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
          className="font-quran block w-full resize-none bg-transparent text-[20px] leading-[2.1] text-ink placeholder:text-muted focus:outline-none focus-visible:outline-none"
        />
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>{t("home.hint")}</span>
          <span className={tooLong ? "font-semibold text-[color:var(--t-veryWeak-line)]" : ""} aria-live="polite">
            {num(value.length)} / {num(MAX_TEXT)}
          </span>
        </div>
      </div>

      {/* the picture from the files or the gallery; the camera (phones); both read the same way */}
      <input ref={files} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" tabIndex={-1} onChange={choose} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={choose} />

      <div className="flex gap-2">
        <Button variant="secondary" className="min-w-0 flex-1" style={{ paddingInline: 8 }} disabled={busy} onClick={() => files.current?.click()}>
          <span className="truncate">{t("home.image")}</span>
          <Icon name="image" size={18} />
        </Button>
        {touch && (
          <Button variant="secondary" className="min-w-0 flex-1" style={{ paddingInline: 8 }} disabled={busy} onClick={() => camera.current?.click()}>
            <span className="truncate">{t("home.camera")}</span>
            <Icon name="camera" size={18} />
          </Button>
        )}
        {/* not ready yet: said on the button itself, since a phone shows no tooltip and a faded button looks broken */}
        <Button
          variant="secondary"
          className="relative min-w-0 flex-1 border-dashed text-muted disabled:cursor-default disabled:opacity-100"
          style={{ paddingInline: 8 }}
          disabled
          aria-label={`${t("home.voice")} · ${t("home.soon")}`}
        >
          <span className="truncate">{t("home.voice")}</span>
          <Icon name="mic" size={18} />
          <span className="absolute -top-2.5 end-2 rounded-full border border-line-strong bg-surface px-2 py-1 text-[11px] font-semibold leading-none text-brand-ink">{t("home.soon")}</span>
        </Button>
      </div>
      {!touch && <p className="-mt-2 text-center text-[12px] text-muted">{t("home.imageHint")}</p>}

      <Button size="lg" full onClick={onSubmit} disabled={busy || !value.trim() || tooLong}>
        {t("home.verify")}
      </Button>

      <ol aria-label={t("home.stepsLabel")} className="grid grid-cols-3 gap-2">
        {(["home.step1", "home.step2", "home.step3"] as const).map((k, i) => (
          <li key={k} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-2.5 text-center">
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[12px] font-bold text-[#0a1413]">
              {num(i + 1)}
            </span>
            <span className="nastaliq-pad text-[12px] leading-snug text-ink">{t(k)}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <p className="text-[13px] text-muted">{t("home.examples")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EXAMPLES.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => onChange(e.text)}
              className="nastaliq-pad min-h-10 w-full cursor-pointer rounded-full border-[1.5px] border-line-strong bg-surface px-3 text-center text-[13px] font-medium text-ink hover:bg-paper"
            >
              {t(e.key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
