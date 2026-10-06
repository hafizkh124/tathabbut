"use client";
import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { Key } from "@/lib/i18n/dict";
import { Icon } from "./ui/Icon";
import { LoadingMark } from "./ui/Logo";

const STEPS: Key[] = ["step.read", "step.find", "step.match", "step.fetch"];
/** When each step is shown as done, in ms. The server answers in one go, so these only pace the screen; the last step never finishes before the answer. */
const DONE_AT = [700, 2200, 5200];

function StepIcon({ state }: { state: "done" | "active" | "waiting" }) {
  if (state === "done") {
    return (
      <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-white" style={{ background: "var(--t-accepted-line)" }}>
        <Icon name="check" size={14} strokeWidth={2.4} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" style={{ flex: "none" }}>
        <circle cx="13" cy="13" r="11" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <path d="M13 2 A11 11 0 1 1 2 13" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 13 13" to="360 13 13" dur="0.9s" repeatCount="indefinite" />
        </path>
      </svg>
    );
  }
  return <span className="block h-[26px] w-[26px] flex-none rounded-full border-2 border-line-strong" />;
}

export function LoadingView() {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(id);
  }, []);

  const doneCount = DONE_AT.filter((ms) => elapsed >= ms).length;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-7 py-8 sm:gap-8" role="status" aria-live="polite">
      <span className="sm:hidden">
        <LoadingMark size={92} label={t("loading.title")} />
      </span>
      <span className="hidden sm:block">
        <LoadingMark size={120} label={t("loading.title")} />
      </span>
      <h1 className="text-[15px] font-normal text-muted sm:text-[17px]">{t("loading.title")}</h1>

      <ol className="w-full max-w-[300px] divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface sm:max-w-[460px] sm:rounded-[18px]">
        {STEPS.map((k, i) => {
          const state = i < doneCount ? "done" : i === doneCount ? "active" : "waiting";
          return (
            <li
              key={k}
              className={`flex items-center gap-3 px-4 py-3.5 text-[14px] sm:gap-3.5 sm:px-6 sm:py-[18px] sm:text-[16px] ${state === "done" ? "text-[color:var(--t-accepted-line)]" : state === "active" ? "font-bold text-ink" : "text-muted"}`}
            >
              <StepIcon state={state} />
              <span>{t(k)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
