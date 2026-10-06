"use client";
import React, { useSyncExternalStore } from "react";
import { LOCALES, type Locale } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/i18n";
import { LogoMark, Wordmark, type LogoMotion } from "./ui/Logo";
import { Icon } from "./ui/Icon";

type Theme = "light" | "dark";
const THEME_KEY = "tathabbut.theme";
const THEME_COLOR: Record<Theme, string> = { light: "#0c3b38", dark: "#0e1716" };

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
/** Each name in its own script's font, whatever the page's language, nudged so the letters (not the font's line box) sit in
 *  the middle: Readex leaves room above for Latin capitals that ع does not use, and Nastaliq sits low on its line. */
const NAME_STYLE: Record<Locale, React.CSSProperties> = {
  ar: { fontFamily: "var(--font-readex), sans-serif", transform: "translateY(-4.5px)" },
  en: { fontFamily: "var(--font-readex), sans-serif" },
  ur: { fontFamily: "var(--font-nastaliq), serif", transform: "translateY(-2.5px)" },
};

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
          } ${l === "ur" ? "text-xs" : ""}`}
          style={{ fontFamily: NAME_STYLE[l].fontFamily }}
        >
          <span style={{ transform: NAME_STYLE[l].transform }}>{NAMES[l]}</span>
        </button>
      ))}
    </div>
  );
}

export function Header({ motion = "none", onHome }: { motion?: LogoMotion; onHome?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:h-[70px] lg:px-10">
        <button type="button" onClick={onHome} className="flex items-center gap-2.5 cursor-pointer lg:gap-3" aria-label="تَثَبُّت" translate="no">
          <LogoMark size={38} motion={motion} label="" />
          <Wordmark size={24} />
        </button>
        <div className="flex items-center gap-1" translate="no">
          <ThemeToggle />
          <LangSwitch />
        </div>
      </div>
    </header>
  );
}
