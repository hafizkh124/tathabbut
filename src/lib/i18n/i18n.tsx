"use client";
// The user's language: Arabic by default, then English and Urdu. It sets lang/dir on <html> and is remembered in the browser.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, DIR, LOCALES, countLabel, digits, stateLabel, translate, type Key, type Locale } from "./dict";

const STORAGE_KEY = "tathabbut.locale";

interface I18n {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (l: Locale) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
  state: (state: string, long?: boolean) => string;
  count: (n: number) => string;
  num: (n: number | string) => string;
}

const Ctx = createContext<I18n | null>(null);

// The choice lives in localStorage; useSyncExternalStore reads it without a flash and keeps tabs in step.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
let chosen: Locale | null = null; // also holds the choice when localStorage is blocked
function readLocale(): Locale {
  if (chosen) return chosen;
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    return saved && LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = DIR[locale];
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    chosen = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* private mode: the choice lasts until the page is closed */
    }
    listeners.forEach((cb) => cb());
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      dir: DIR[locale],
      setLocale,
      t: (key, params) => translate(locale, key, params),
      state: (s, long) => stateLabel(s, locale, long),
      count: (n) => countLabel(locale, n),
      num: (n) => digits(locale, n),
    }),
    [locale, setLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <LocaleProvider>");
  return v;
}
