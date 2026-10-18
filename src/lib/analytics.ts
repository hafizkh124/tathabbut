"use client";
// Usage analytics in the page: a random id for this browser (there are no accounts, so a device stands for a person), how
// the page was opened, and the few events worth counting. Sent to /api/event, or as headers on the check itself
// (src/lib/events.ts keeps them). Nothing here may ever break a check: every step is allowed to fail silently.

import { DEVICE_HEADER, LOCALE_HEADER, SOURCE_HEADER } from "./events";

const DEVICE_KEY = "tathabbut.device";
const SOURCE_KEY = "tathabbut.source";

export type Source = "direct" | "pwa" | "share_target" | "link";

let device: string | null | undefined;
/** This browser's random id, made on its first visit and kept; null when the browser keeps nothing (private mode). */
export function deviceId(): string | null {
  if (device !== undefined) return device;
  try {
    device = localStorage.getItem(DEVICE_KEY);
    if (!device) {
      device = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, device);
    }
  } catch {
    device = null;
  }
  return device;
}

let source: Source | null = null;
/** How this visit began, read once from the first address (before the page cleans it) and kept for the visit. */
export function rememberSource(path = window.location.pathname, search = window.location.search): Source {
  try {
    const kept = sessionStorage.getItem(SOURCE_KEY) as Source | null;
    if (kept) return (source = kept);
  } catch {
    /* no session storage: decide from this address */
  }
  const params = new URLSearchParams(search);
  const standalone = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  source = path.startsWith("/r/") ? "link" : params.has("shared") || params.has("text") ? "share_target" : params.get("source") === "pwa" || standalone ? "pwa" : "direct";
  try {
    sessionStorage.setItem(SOURCE_KEY, source);
  } catch {
    /* kept in memory for this page */
  }
  return source;
}

const locale = (): string | null => {
  try {
    return localStorage.getItem("tathabbut.locale") || "ar";
  } catch {
    return null;
  }
};

/** The page's details as headers, for /api/verify and /api/ocr to log the check against this device. */
export function analyticsHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const id = deviceId();
  if (id) h[DEVICE_HEADER] = id;
  h[SOURCE_HEADER] = source ?? rememberSource();
  const l = locale();
  if (l) h[LOCALE_HEADER] = l;
  return h;
}

/** Counts one event: a visit, a share or copy, the install prompt's answer, an install. */
export function track(event: "visit" | "share" | "copy" | "install_prompt" | "installed", data?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ event, device: deviceId(), source: source ?? rememberSource(), locale: locale(), referrer: document.referrer || null, data: { path: window.location.pathname, ...data } });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/event", blob)) fetch("/api/event", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    /* never in the way */
  }
}
