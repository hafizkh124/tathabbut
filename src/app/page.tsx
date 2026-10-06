"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ErrorView, type ErrorKind } from "@/components/ErrorView";
import { AboutDialog } from "@/components/AboutDialog";
import { Header } from "@/components/Header";
import { InputPanel, MAX_TEXT } from "@/components/InputPanel";
import { LoadingView } from "@/components/LoadingView";
import { OriginTrackerDrawer } from "@/components/OriginTrackerDrawer";
import { ResultsView } from "@/components/ResultsView";
import { TextConfirm } from "@/components/TextConfirm";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import type { ClaimResult, VerifyResponse } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n/i18n";
import { prepareImage } from "@/lib/image";
import { applyTurath, fetchTurath, turathKindOf } from "@/lib/turathClient";

type Phase =
  | { name: "input" }
  | { name: "reading" }
  | { name: "confirm"; text: string; uncertain: string[]; previewUrl: string }
  | { name: "loading" }
  | { name: "results"; claims: ClaimResult[] }
  | { name: "error"; kind: ErrorKind };

export default function Home() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [post, setPost] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "input" });
  const [selected, setSelected] = useState(0);
  const [originQuery, setOriginQuery] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const run = useRef(0);
  const preview = useRef<string | null>(null);

  // the picture's object URL is released when it is replaced and when the page closes
  const keepPreview = useCallback((url: string | null) => {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = url;
  }, []);
  useEffect(() => () => keepPreview(null), [keepPreview]);

  /** The books are asked after the cards are on screen; each answer lands on its own claim, and only if the run is still current. */
  const askTurath = useCallback((id: number, claims: ClaimResult[]) => {
    claims.forEach((c, i) => {
      const kind = turathKindOf(c);
      if (!kind) return;
      fetchTurath(c, kind).then(({ turath, patch }) => {
        if (id !== run.current) return;
        setPhase((p) => (p.name === "results" ? { ...p, claims: p.claims.map((x, j) => (j === i ? applyTurath(x, turath, patch) : x)) } : p));
      });
    });
  }, []);

  const verify = useCallback(
    async (value: string) => {
      const submitted = value.trim();
      if (!submitted) return;
      const id = ++run.current;
      keepPreview(null);
      setPost(submitted);
      setSelected(0);
      if (submitted.length > MAX_TEXT) {
        setPhase({ name: "error", kind: "tooLong" });
        return;
      }
      setPhase({ name: "loading" });
      window.scrollTo({ top: 0 });

      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: submitted }),
        });
        const data = (await res.json()) as VerifyResponse;
        if (id !== run.current) return;
        if (!res.ok) {
          setPhase({ name: "error", kind: res.status === 400 && /longer/.test(data.error ?? "") ? "tooLong" : "read" });
          return;
        }
        const claims = (data.claims ?? []).map((c) => (turathKindOf(c) ? { ...c, turath: { status: "loading" as const } } : c));
        setPhase({ name: "results", claims });
        askTurath(id, claims);
      } catch {
        if (id === run.current) setPhase({ name: "error", kind: "network" });
      }
    },
    [keepPreview, askTurath],
  );

  /** A picture: shrink it, read it, and let the person confirm the reading before anything is checked. */
  const readPicture = useCallback(
    async (file: File) => {
      const id = ++run.current;
      setPhase({ name: "reading" });
      window.scrollTo({ top: 0 });
      let prepared;
      try {
        prepared = await prepareImage(file);
      } catch {
        if (id === run.current) setPhase({ name: "error", kind: "badImage" });
        return;
      }
      try {
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: prepared.data, mimeType: prepared.mimeType }),
        });
        const data = (await res.json()) as { text?: string; uncertain?: string[] };
        if (id !== run.current) {
          URL.revokeObjectURL(prepared.previewUrl);
          return;
        }
        if (!res.ok) {
          URL.revokeObjectURL(prepared.previewUrl);
          setPhase({ name: "error", kind: res.status === 400 || res.status === 413 ? "badImage" : "ocr" });
          return;
        }
        if (!data.text?.trim()) {
          URL.revokeObjectURL(prepared.previewUrl);
          setPhase({ name: "error", kind: "noText" });
          return;
        }
        keepPreview(prepared.previewUrl);
        setPhase({ name: "confirm", text: data.text, uncertain: data.uncertain ?? [], previewUrl: prepared.previewUrl });
      } catch {
        URL.revokeObjectURL(prepared.previewUrl);
        if (id === run.current) setPhase({ name: "error", kind: "pictureNetwork" });
      }
    },
    [keepPreview],
  );

  const toInput = useCallback(() => {
    run.current++;
    keepPreview(null);
    setPhase({ name: "input" });
  }, [keepPreview]);
  const toNew = useCallback(() => {
    setText("");
    toInput();
  }, [toInput]);
  const closeOrigin = useCallback(() => setOriginQuery(null), []);

  const wide = phase.name === "input" || (phase.name === "results" && phase.claims.length > 0);

  return (
    <div className="flex min-h-screen flex-col">
      <Header onHome={toNew} />

      {/* the home and result screens lay out their own columns across the page; the others sit in one narrow column */}
      <main className={wide ? "w-full flex-1" : "mx-auto w-full max-w-3xl flex-1 px-4 py-6"}>
        {phase.name === "input" && <InputPanel value={text} onChange={setText} onSubmit={() => verify(text)} onImage={readPicture} />}

        {phase.name === "reading" && (
          <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
            <LogoMark size={112} motion="loading" label={t("ocr.reading")} />
            <p className="text-lg font-semibold text-brand-ink">{t("ocr.reading")}</p>
          </div>
        )}

        {phase.name === "confirm" && (
          <TextConfirm
            key={phase.previewUrl}
            text={phase.text}
            uncertain={phase.uncertain}
            previewUrl={phase.previewUrl}
            onConfirm={(confirmed) => {
              setText(confirmed);
              verify(confirmed);
            }}
            onBack={toInput}
          />
        )}

        {phase.name === "loading" && <LoadingView text={post} />}

        {phase.name === "error" && <ErrorView kind={phase.kind} text={post} onRetry={() => verify(post)} onEdit={toInput} />}

        {phase.name === "results" &&
          (phase.claims.length === 0 ? (
            <div className="space-y-4">
              <h1 className="rounded-2xl border border-line bg-surface p-5 text-base font-normal">{t("empty.body")}</h1>
              <div className="flex flex-col gap-2.5">
                <Button size="lg" onClick={toInput}>
                  {t("action.edit")}
                </Button>
              </div>
            </div>
          ) : (
            <ResultsView post={post} claims={phase.claims} selected={selected} onSelect={setSelected} onOrigin={setOriginQuery} onEdit={toInput} onNew={toNew} />
          ))}
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-2 border-t border-line px-4 py-2 text-[12px] text-muted">
        <button type="button" onClick={() => setAboutOpen(true)} className="nastaliq-pad min-h-11 cursor-pointer text-[13px] font-medium text-brand-ink underline underline-offset-4">
          {t("about.link")}
        </button>
        <span aria-hidden>·</span>
        <span>Islamic AI Challenge 2026</span>
      </footer>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <OriginTrackerDrawer open={Boolean(originQuery)} onClose={closeOrigin} claimQuery={originQuery ?? ""} />
    </div>
  );
}
