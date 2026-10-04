"use client";
import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { Key } from "@/lib/i18n/dict";
import { imageFromClipboard, imageFromDrop } from "@/lib/pickImage";
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
        <Button variant="secondary" className="min-w-0 flex-1" style={{ paddingInline: 8 }} disabled title={`${t("home.voice")} · ${t("home.soon")}`}>
          <span className="truncate">{t("home.voice")}</span>
          <Icon name="mic" size={18} />
        </Button>
      </div>
      {!touch && <p className="-mt-2 text-center text-[12px] text-muted">{t("home.imageHint")}</p>}

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
