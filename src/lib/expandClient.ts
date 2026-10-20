// The screen's side of the second look at a topic that found nothing (src/app/api/expand/route.ts). Never throws.
import type { Expansion } from "./expand";
import type { ClaimResult } from "./clientTypes";

/** Other names for the claim's topic, or null when none could be had (the card then says so plainly). */
export async function fetchExpansion(c: ClaimResult, f: typeof fetch = fetch): Promise<Expansion | null> {
  const { topicUr, topic, topicEn } = c.claim;
  if (!topicUr && !topic && !topicEn) return null;
  try {
    const res = await f("/api/expand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ur: topicUr ?? undefined, ar: topic ?? undefined, en: topicEn ?? undefined }) });
    if (!res.ok) return null;
    const x = (await res.json()) as Partial<Expansion>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
    return { ur: list(x.ur), ar: list(x.ar), en: list(x.en) };
  } catch {
    return null;
  }
}
