import { describe, expect, it, vi } from "vitest";
import type { RetrievedContext } from "nusus";
import type { RetrieveOptions, TurathClient } from "nusus/turath";
import { createTurathLookup, MAX_TURATH_PASSAGES, TURATH_TIMEOUT_MS } from "./turath";

const emptyContext = (query: string): RetrievedContext => ({ passages: [], totalMatches: 0, query });

function clientWith(retrieve: (query: string, options?: RetrieveOptions) => Promise<RetrievedContext>): Pick<TurathClient, "retrieve"> {
  return { retrieve };
}

describe("createTurathLookup", () => {
  it("uses one unfiltered, bounded retrieve and treats zero matches as a successful lookup", async () => {
    const retrieve = vi.fn(async (query: string, options?: RetrieveOptions) => {
      if (options?.signal?.aborted) throw new Error("aborted before retrieval");
      return emptyContext(query);
    });
    const lookup = createTurathLookup(clientWith(retrieve));

    await expect(lookup("نص الحديث")).resolves.toEqual({ status: "success", references: [] });
    expect(retrieve).toHaveBeenCalledOnce();
    expect(MAX_TURATH_PASSAGES).toBe(10);
    expect(retrieve).toHaveBeenCalledWith("نص الحديث", expect.objectContaining({
      maxPassages: 10,
      maxCharsPerPassage: 1_500,
      signal: expect.any(AbortSignal),
    }));
    expect(retrieve.mock.calls[0]?.[1]).not.toHaveProperty("scope");
  });

  it("reports provider errors as unavailable without propagating them", async () => {
    const retrieve = vi.fn(async () => { throw new Error("rate limited"); });
    const lookup = createTurathLookup(clientWith(retrieve));

    await expect(lookup("نص الحديث")).resolves.toEqual({ status: "unavailable", references: [] });
  });

  it("aborts a stalled retrieval at the overall ten-second deadline", async () => {
    vi.useFakeTimers();
    try {
      const retrieve = vi.fn((_query: string, options?: RetrieveOptions) => new Promise<RetrievedContext>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const lookup = createTurathLookup(clientWith(retrieve));
      const pending = lookup("نص الحديث");

      await vi.advanceTimersByTimeAsync(TURATH_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ status: "unavailable", references: [] });
      expect(retrieve).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
