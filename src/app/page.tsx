"use client";

import React, { useCallback, useRef, useState } from "react";
import { ErrorView, type ErrorKind } from "@/components/ErrorView";
import { Header } from "@/components/Header";
import { InputPanel } from "@/components/InputPanel";
import { LoadingView } from "@/components/LoadingView";
import { OriginTrackerDrawer } from "@/components/OriginTrackerDrawer";
import { ResultsView } from "@/components/ResultsView";
import { Button } from "@/components/ui/Button";
import type { ClaimResult, VerifyResponse } from "@/lib/clientTypes";
import { useI18n } from "@/lib/i18n/i18n";

type Phase = { name: "input" } | { name: "loading" } | { name: "results"; claims: ClaimResult[] } | { name: "error"; kind: ErrorKind };

export default function Home() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [post, setPost] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "input" });
  const [selected, setSelected] = useState(0);
  const [originQuery, setOriginQuery] = useState<string | null>(null);
  const run = useRef(0);

  const verify = useCallback(async (value: string) => {
    const submitted = value.trim();
    if (!submitted) return;
    const id = ++run.current;
    setPost(submitted);
    setSelected(0);
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
      setPhase({ name: "results", claims: data.claims ?? [] });
    } catch {
      if (id === run.current) setPhase({ name: "error", kind: "network" });
    }
  }, []);

  const toInput = useCallback(() => {
    run.current++;
    setPhase({ name: "input" });
  }, []);
  const toNew = useCallback(() => {
    setText("");
    toInput();
  }, [toInput]);
  const closeOrigin = useCallback(() => setOriginQuery(null), []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header onHome={toNew} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {phase.name === "input" && <InputPanel value={text} onChange={setText} onSubmit={() => verify(text)} />}

        {phase.name === "loading" && <LoadingView text={post} />}

        {phase.name === "error" && <ErrorView kind={phase.kind} text={post} onRetry={() => verify(post)} onEdit={toInput} />}

        {phase.name === "results" &&
          (phase.claims.length === 0 ? (
            <div className="space-y-4">
              <p className="rounded-2xl border border-line bg-surface p-5 text-base">{t("empty.body")}</p>
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

      <footer className="px-4 py-5 text-center text-[12px] text-muted">Islamic AI Challenge 2026</footer>

      <OriginTrackerDrawer open={Boolean(originQuery)} onClose={closeOrigin} claimQuery={originQuery ?? ""} />
    </div>
  );
}
