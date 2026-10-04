"use client";
import React from "react";
import { LOCALES, type Locale } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/i18n";
import { LogoMark, Wordmark, type LogoMotion } from "./ui/Logo";

const NAMES: Record<Locale, string> = { ar: "ع", en: "EN", ur: "اردو" };
const LONG: Record<Locale, string> = { ar: "العربية", en: "English", ur: "اردو" };

export function LangSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t("lang.label")} className="flex rounded-full bg-line p-0.5">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={LONG[l]}
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          className={`flex h-10 w-11 items-center justify-center rounded-full text-sm font-semibold cursor-pointer transition-colors ${
            locale === l ? "bg-brand text-on-brand" : "text-ink hover:bg-paper"
          } ${l === "ur" ? "pt-2 text-xs" : ""}`}
          style={l === "ur" ? { fontFamily: "var(--font-nastaliq), serif" } : undefined}
        >
          {NAMES[l]}
        </button>
      ))}
    </div>
  );
}

export function AiNotice() {
  const { t } = useI18n();
  return (
    <div className="nastaliq-pad flex items-center justify-center gap-2 bg-brand-soft px-4 py-2 text-center text-xs text-brand-ink" role="note">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none" }} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6">
        <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />
        <path d="M8 7.2 V11.2 M8 4.8 V4.9" />
      </svg>
      <span>{t("notice")}</span>
    </div>
  );
}

export function Header({ motion = "none", onHome }: { motion?: LogoMotion; onHome?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-3xl items-center justify-between px-4">
        <button type="button" onClick={onHome} className="flex items-center gap-2.5 cursor-pointer" aria-label="تَثَبُّت">
          <LogoMark size={36} motion={motion} label="" />
          <Wordmark size={24} />
        </button>
        <LangSwitch />
      </div>
      <AiNotice />
    </header>
  );
}
