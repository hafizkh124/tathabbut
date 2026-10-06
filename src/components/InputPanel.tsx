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

/** How it works: a short line each on a phone, a line and its explanation in the side panel on a computer. */
const STEPS: Array<{ title: Key; desc: Key }> = [
  { title: "home.step1", desc: "home.step1Desc" },
  { title: "home.step2", desc: "home.step2Desc" },
  { title: "home.step3", desc: "home.step3Desc" },
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
  const cannotCheck = busy || !value.trim() || tooLong;
  const checkLabel = (
    <>
      <Icon name="check" size={20} strokeWidth={2.2} />
      <span>{t("home.verify")}</span>
    </>
  );
  // the image, camera and voice buttons share their row equally, with Check under them
  const side = "min-w-0 flex-1 rounded-[14px] px-2! lg:min-h-[52px]";

  return (
    <div
      className="relative lg:grid lg:min-h-[calc(100vh-70px)] lg:grid-cols-[1.15fr_0.85fr]"
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
          className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-3xl border-[3px] border-dashed border-brand bg-brand-soft/90 text-lg font-bold text-brand-ink"
          role="status"
        >
          {t("home.drop")}
        </div>
      )}

      {/* the form: the whole page on a phone, the wider side on a computer */}
      <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-5 sm:px-6 lg:flex lg:max-w-[46rem] lg:flex-col lg:justify-center lg:gap-6 lg:space-y-0 lg:px-14 lg:py-14">
        {/* how it works: three tinted steps at the top on a phone; on a computer they are in the side panel */}
        <ol aria-label={t("home.stepsLabel")} className="grid grid-cols-3 gap-2.5 lg:hidden">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col items-center gap-1.5 rounded-xl bg-brand-soft px-2 py-2.5 text-center">
              <span aria-hidden className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gold text-[11px] font-bold text-[#3a2e0b]">
                {num(i + 1)}
              </span>
              <span className="nastaliq-pad text-[12px] leading-snug text-muted">{t(s.title)}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-1.5 lg:space-y-4">
          <p className="nastaliq-pad hidden text-[13px] font-semibold uppercase tracking-wide text-gold-ink lg:block">{t("home.eyebrow")}</p>
          <h1 className="text-[25px] font-bold leading-snug text-brand-ink lg:text-[46px] lg:leading-tight">{t("home.title")}</h1>
          <p className="text-[14px] text-muted lg:max-w-[46ch] lg:text-[17px]">{t("home.sub")}</p>
        </div>

        <div className="space-y-2 rounded-[18px] border-2 border-line-strong bg-surface px-4 pb-3.5 pt-4 transition-colors focus-within:border-brand lg:border-brand lg:p-[22px]">
          <label htmlFor={id} className="block pb-1 text-[12px] font-semibold text-brand-ink lg:text-brand">
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
            className="font-quran block w-full resize-none bg-transparent text-[20px] leading-[2.1] text-ink placeholder:text-muted focus:outline-none focus-visible:outline-none lg:text-[22px]"
          />
          <div className="flex items-center justify-between border-t border-line pt-3 text-[12px] text-muted">
            <span>{t("home.hint")}</span>
            <span className={tooLong ? "font-semibold text-[color:var(--t-veryWeak-line)]" : ""} aria-live="polite">
              {num(value.length)} / {num(MAX_TEXT)}
            </span>
          </div>
        </div>

        {/* the picture from the files or the gallery; the camera (phones); both read the same way */}
        <input ref={files} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" tabIndex={-1} onChange={choose} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={choose} />

        <div className="space-y-2">
          <div className="flex items-center gap-2.5 lg:gap-3">
            <Button variant="secondary" className={side} disabled={busy} onClick={() => files.current?.click()}>
              <span className="truncate">{t("home.image")}</span>
              <Icon name="image" size={19} />
            </Button>
            {touch && (
              <Button variant="secondary" className={side} disabled={busy} onClick={() => camera.current?.click()}>
                <span className="truncate">{t("home.camera")}</span>
                <Icon name="camera" size={19} />
              </Button>
            )}
            {/* not ready yet: said on the button itself, since a phone shows no tooltip and a faded button looks broken */}
            <Button
              variant="secondary"
              className={`${side} relative border-dashed text-muted disabled:cursor-default disabled:opacity-100`}
              disabled
              aria-label={`${t("home.voice")} · ${t("home.soon")}`}
            >
              <span className="truncate">{t("home.voice")}</span>
              <Icon name="mic" size={19} />
              <span className="absolute -top-2.5 end-2 rounded-full border border-line-strong bg-surface px-2 py-1 text-[11px] font-semibold leading-none text-brand-ink">{t("home.soon")}</span>
            </Button>
          </div>
          {!touch && <p className="text-center text-[12px] text-muted">{t("home.imageHint")}</p>}
        </div>

        <Button size="lg" full className="min-h-14 rounded-2xl" onClick={onSubmit} disabled={cannotCheck}>
          {checkLabel}
        </Button>
        {/* FR-44: an AI tool that does not issue fatwas, said where the person presses Check */}
        <p className="nastaliq-pad -mt-2 text-center text-[12px] text-muted lg:-mt-3.5" role="note">{t("notice")}</p>

        <div className="space-y-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2.5 lg:space-y-0">
          <p className="text-[13px] text-muted lg:me-1.5">{t("home.examples")}</p>
          <div className="flex flex-wrap gap-2 lg:contents">
            {EXAMPLES.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => onChange(e.text)}
                className="nastaliq-pad min-h-10 cursor-pointer rounded-full border-[1.5px] border-line-strong bg-surface px-4 text-center text-[13px] font-medium text-ink hover:bg-paper"
              >
                {t(e.key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* how it works, beside the form on a computer */}
      <aside className="hidden flex-col justify-center gap-8 border-s border-panel-line bg-panel px-12 py-14 text-on-panel lg:flex">
        <h2 className="text-[20px] font-bold text-gold-soft">{t("about.s2.h")}</h2>
        <ol aria-label={t("home.stepsLabel")} className="flex flex-col gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-4">
              <span aria-hidden className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-gold text-[15px] font-bold text-[#3a2e0b]">
                {num(i + 1)}
              </span>
              <div>
                <p className="text-[15px] font-semibold">{t(s.title)}</p>
                <p className="mt-0.5 text-[13px] text-on-panel-muted">{t(s.desc)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="border-t border-panel-line pt-5 text-[13px] text-on-panel-muted">{t("home.disclaimer")}</p>
      </aside>
    </div>
  );
}
