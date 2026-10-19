"use client";
// A newer version of the site while the app is open or installed: the page itself is always fetched fresh when it opens,
// so the only app that can be out of date is one kept open (or in the phone's recent apps) for a long time. When it comes
// back into view, the live deployment's id is compared with the one this page was built from; if they differ the header
// offers «update», which just reloads. Never reloads by itself, so nothing the person has typed is lost.
import { useEffect, useState } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const EVERY_MS = 10 * 60 * 1000;

export function useUpdateAvailable(): boolean {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (BUILD === "dev") return; // local development: nothing to compare with
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < EVERY_MS) return;
      last = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { id } = (await res.json()) as { id?: string };
        if (id && id !== "dev" && id !== BUILD) setStale(true);
      } catch {
        /* offline or blocked: ask again next time the app comes back */
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);
  return stale;
}
