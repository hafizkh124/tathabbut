"use client";
import React, { useSyncExternalStore } from "react";
import { LOCALES, type Locale } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/i18n";
import { LogoMark, Wordmark, type LogoMotion } from "./ui/Logo";
import { Icon } from "./ui/Icon";

type Theme = "light" | "dark";
const THEME_KEY = "tathabbut.theme";
const THEME_COLOR: Record<Theme, string> = { light: "#0b3d3a", dark: "#0e1716" };

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[theme]));
}

/** The theme on <html>, kept current: the person's pick (this button), or the device's setting while they have not picked. */
function subscribeTheme(cb: () => void) {
  const m = window.matchMedia("(prefers-color-scheme: dark)");
  const follow = () => {
    let chosen: string | null = null;
    try {
      chosen = localStorage.getItem(THEME_KEY);
    } catch {
      /* storage unavailable: follow the device */
    }
    if (!chosen) applyTheme(m.matches ? "dark" : "light");
  };
  const watch = new MutationObserver(cb);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  m.addEventListener("change", follow);
  return () => {
    watch.disconnect();
    m.removeEventListener("change", follow);
  };
}
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Light or dark, whatever the device says: until the person picks one the page follows the device, then keeps their pick. */
export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          /* storage unavailable: the choice lasts for this visit */
        }
      }}
      aria-label={t(next === "dark" ? "theme.toDark" : "theme.toLight")}
      title={t(next === "dark" ? "theme.toDark" : "theme.toLight")}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-line"
    >
      {theme && <Icon name={theme === "dark" ? "sun" : "moon"} size={18} strokeWidth={1.7} />}
    </button>
  );
}

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
        <button type="button" onClick={onHome} className="flex items-center gap-2.5 cursor-pointer" aria-label="تَثَبُّت" translate="no">
          <LogoMark size={36} motion={motion} label="" />
          <Wordmark size={24} />
        </button>
        <div className="flex items-center gap-1" translate="no">
          <ThemeToggle />
          <LangSwitch />
        </div>
      </div>
      <AiNotice />
    </header>
  );
}
