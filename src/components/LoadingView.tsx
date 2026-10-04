"use client";
import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { Key } from "@/lib/i18n/dict";
import { Icon } from "./ui/Icon";
import { LogoMark } from "./ui/Logo";

const STEPS: Key[] = ["step.read", "step.find", "step.match", "step.fetch"];
/** When each step is shown as done, in ms. The server answers in one go, so these only pace the screen; the last step never finishes before the answer. */
const DONE_AT = [700, 2200, 5200];

function StepIcon({ state }: { state: "done" | "active" | "waiting" }) {
  if (state === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border" style={{ background: "var(--t-accepted-bg)", color: "var(--t-accepted-line)", borderColor: "var(--t-accepted-bd)" }}>
        <Icon name="check" size={12} strokeWidth={2.4} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="var(--brand-ink)" strokeWidth="2" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite" />
        </path>
      </svg>
    );
  }
  return <span className="block h-5 w-5 rounded-full border-[1.5px] border-line-strong" />;
}

export function LoadingView({ text }: { text: string }) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(id);
  }, []);

  const doneCount = DONE_AT.filter((ms) => elapsed >= ms).length;

  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <div className="font-quran max-h-40 overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3 text-[18px] leading-[2.1] text-muted" dir="auto">
        {text}
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <LogoMark size={112} motion="loading" label={t("loading.title")} />
        <p className="text-lg font-semibold text-brand-ink">{t("loading.title")}</p>
      </div>

      <ol className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
        {STEPS.map((k, i) => {
          const state = i < doneCount ? "done" : i === doneCount ? "active" : "waiting";
          return (
            <li key={k} className={`flex min-h-11 items-center gap-3 text-[15px] ${state === "done" ? "text-[color:var(--t-accepted-fg)]" : state === "active" ? "font-semibold text-brand-ink" : "text-muted"}`}>
              <StepIcon state={state} />
              <span>{t(k)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
