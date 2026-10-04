// The screen's side of Turath: it is asked for AFTER /api/verify has answered, so a card never waits for the books.
import type { ClaimResult, TurathView } from "./clientTypes";
import type { TurathLookupOutcome } from "./hadithMatch";
import type { TurathPatch } from "./turathFallback";
import type { TurathLookupKind } from "./turathScope";

const hasArabic = (s: string) => /[ء-ي]/.test(s);

/** The kind of lookup a claim needs, or null: hadith and scholars' sayings written in Arabic, and not a verse. */
export function turathKindOf(c: ClaimResult): TurathLookupKind | null {
  const kind = c.claim.kind;
  if (kind !== "hadith" && kind !== "scholar_quote") return null;
  if (c.basis === "quran" || c.basis === "kind") return null;
  return hasArabic(c.claim.query) ? kind : null;
}

/** A claim as it reads once the books answered: the references are kept, and the patch (if any) changes its state. */
export function applyTurath(c: ClaimResult, turath: TurathView, patch: TurathPatch | null): ClaimResult {
  if (!patch) return { ...c, turath };
  return { ...c, turath, state: patch.state, basis: patch.basis, notes: [...c.notes, ...patch.notes], turathReason: patch.reason };
}

const UNAVAILABLE: TurathLookupOutcome = { status: "unavailable", references: [] };

/** Never throws: a failure is «unavailable», and the card stays as /api/verify left it. */
export async function fetchTurath(c: ClaimResult, kind: TurathLookupKind): Promise<{ turath: TurathLookupOutcome; patch: TurathPatch | null }> {
  try {
    const res = await fetch("/api/turath", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: c.claim.query, kind, state: c.state, basis: c.basis, notes: c.notes }),
    });
    if (!res.ok) return { turath: UNAVAILABLE, patch: null };
    const data = (await res.json()) as { turath?: TurathLookupOutcome; patch?: TurathPatch | null };
    return { turath: data.turath ?? UNAVAILABLE, patch: data.patch ?? null };
  } catch {
    return { turath: UNAVAILABLE, patch: null };
  }
}
