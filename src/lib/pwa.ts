"use client";
// Tathabbut as an installed app: the service worker (public/sw.js), the browser's install prompt, and what another app
// shared to it through the share sheet (manifest.ts).
import { useCallback, useEffect, useState } from "react";
import { SHARE_CACHE, SHARED_IMAGE_KEY, SHARED_TEXT_KEY, sharedText, type SharedFields } from "./sharedInput";

/** Registers public/sw.js, which receives shares. Without it the app still works; only sharing into it falls back to text. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    /* not supported here (private window, an old browser): nothing to do */
  });
}

/** Chrome's install event; not in the DOM types yet. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** The browser's own install prompt, offered when the browser says it can install the app (Android, Chrome and Edge on a
 *  computer). Null elsewhere and once installed: iOS has no such prompt, and an installed app has nothing to offer. */
export function useInstallPrompt(): (() => void) | null {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const offer = (e: Event) => {
      e.preventDefault(); // keep the browser's mini bar away; the button in the header offers it instead
      setEvent(e as InstallPromptEvent);
    };
    const installed = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  const install = useCallback(() => {
    if (!event) return;
    event.prompt().catch(() => {});
    event.userChoice.finally(() => setEvent(null)); // a prompt can be shown only once
  }, [event]);
  return event ? install : null;
}

/** What was shared into the app, taken out of the cache public/sw.js put it in, so it is checked once only. */
export async function takeShared(): Promise<{ text: string; image: File | null }> {
  const none = { text: "", image: null };
  if (!("caches" in window)) return none;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const [textRes, imageRes] = await Promise.all([cache.match(SHARED_TEXT_KEY), cache.match(SHARED_IMAGE_KEY)]);
    await Promise.all([cache.delete(SHARED_TEXT_KEY), cache.delete(SHARED_IMAGE_KEY)]);
    const text = textRes ? sharedText((await textRes.json()) as SharedFields) : "";
    const blob = imageRes ? await imageRes.blob() : null;
    const image = blob ? new File([blob], "shared", { type: blob.type }) : null;
    return { text, image };
  } catch {
    return none;
  }
}
