"use client";
import React, { useId, useMemo, useRef, useState } from "react";
import { markWords } from "@/lib/highlight";
import { cleanWord, pushHistory, replacePiece, stillUnsure } from "@/lib/ocrEdit";
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

const MARK_STYLE: React.CSSProperties = {
  background: "var(--t-weak-bg)",
  textDecorationLine: "underline",
  textDecorationStyle: "dashed",
  textDecorationThickness: 2,
  textUnderlineOffset: 6,
  textDecorationColor: "var(--t-weak-line)",
};

/** After a picture is read: «هل هذا هو النص؟». The reading is shown next to the picture with the unsure words marked;
 *  the person fixes a word by tapping it (or the whole text with «edit»), can undo or go back to the first reading, and
 *  confirms; only then is it checked. Nothing typed here is stored or sent anywhere except to the check itself. */
export function TextConfirm({ text, uncertain, previewUrl, onConfirm, onBack }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [value, setValue] = useState(text);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const before = useRef(text); // the text when the whole-text editor was opened

  const unsureWords = useMemo(() => stillUnsure(uncertain, accepted), [uncertain, accepted]);
  const pieces = useMemo(() => markWords(value, unsureWords), [value, unsureWords]);
  const unsure = pieces.filter((p) => p.flagged);
  const changed = value !== text || accepted.size > 0;

  const change = (next: string) => {
    setHistory((h) => pushHistory(h, value));
    setValue(next);
    setActive(null);
  };

  const openWord = (i: number) => {
    setActive(i);
    setDraft(pieces[i].text);
  };

  const applyWord = (i: number) => {
    const next = cleanWord(draft);
    if (next === pieces[i].text) {
      setAccepted((s) => new Set(s).add(pieces[i].text.trim()));
      setActive(null);
      return;
    }
    change(replacePiece(pieces, i, next));
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (previous === undefined) return;
    setHistory(history.slice(0, -1));
    setValue(previous);
    setActive(null);
  };

  const reset = () => {
    setValue(text);
    setHistory([]);
    setAccepted(new Set());
    setActive(null);
  };

  const openEditor = () => {
    before.current = value;
    setActive(null);
    setEditing(true);
  };

  const closeEditor = () => {
    if (value !== before.current) setHistory((h) => pushHistory(h, before.current));
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-brand-ink">{t("ocr.title")}</h1>
        <p className="text-[14px] text-muted">{t("ocr.sub")}</p>
      </div>

      <div className="space-y-1.5">
        <div className={`overflow-auto rounded-2xl border border-line bg-surface ${zoomed ? "max-h-[70vh]" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL of the user's own picture */}
          <img
            src={previewUrl}
            alt={t("ocr.picture")}
            className={zoomed ? "mx-auto block h-auto w-[200%] max-w-none sm:w-full" : "mx-auto h-auto max-h-44 w-auto max-w-full object-contain"}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed}>
          {zoomed ? t("ocr.zoomOut") : t("ocr.zoomIn")}
        </Button>
      </div>

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
            {pieces.map((p, i) => {
              if (!p.flagged) return <span key={i}>{p.text}</span>;
              if (active === i) {
                return (
                  <span key={i} className="inline-flex items-center gap-1.5 align-middle">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyWord(i);
                        } else if (e.key === "Escape") setActive(null);
                      }}
                      aria-label={t("ocr.wordLabel")}
                      dir="auto"
                      autoFocus
                      size={Math.max(4, draft.length + 1)}
                      className="font-quran min-w-16 max-w-full rounded-lg border-[1.5px] border-brand bg-paper px-2 text-[20px] text-ink focus:outline-none"
                    />
                    <button type="button" onClick={() => applyWord(i)} className="min-h-9 cursor-pointer rounded-full border border-line-strong bg-surface px-3 text-[13px] font-semibold text-brand-ink">
                      {draft.trim() === p.text.trim() ? t("ocr.keepWord") : t("action.done")}
                    </button>
                  </span>
                );
              }
              return (
                <mark key={i} className="rounded-md px-1 text-inherit" style={MARK_STYLE}>
                  <button type="button" onClick={() => openWord(i)} className="cursor-pointer text-inherit" aria-label={`${t("ocr.wordLabel")}: ${p.text}`}>
                    {p.text}
                  </button>
                </mark>
              );
            })}
          </p>
        )}
        {unsure.length > 0 && !editing && (
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--t-weak-fg)" }}>
            <Icon name="bang" size={14} />
            <span>
              {t("ocr.uncertain")}. {t("ocr.tapWord")}
            </span>
          </p>
        )}
      </div>

      {!editing && (history.length > 0 || changed) && (
        <div className="flex flex-wrap gap-2">
          {history.length > 0 && (
            <Button variant="secondary" size="sm" onClick={undo}>
              {t("ocr.undo")}
            </Button>
          )}
          {changed && (
            <Button variant="ghost" size="sm" onClick={reset}>
              {t("ocr.reset")}
            </Button>
          )}
        </div>
      )}

      <p className="text-[12px] text-muted">{t("ocr.privacy")}</p>

      <div className="flex flex-col gap-2.5 border-t border-line pt-3">
        {editing ? (
          <Button size="lg" onClick={closeEditor} disabled={!value.trim()}>
            {t("action.done")}
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={() => onConfirm(value)} disabled={!value.trim()}>
              {t("ocr.confirm")}
            </Button>
            <Button variant="secondary" onClick={openEditor}>
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
