import { describe, expect, it, vi } from "vitest";
import type { TurathPassage, TurathSearchOptions, TurathSearchResult } from "./turathApi";
import { createTurathLookup, MAX_TURATH_PASSAGES, TURATH_TIMEOUT_MS } from "./turath";

const QUERY = "اطلبوا العلم ولو بالصين";

function passage(text: string, bookId: string, page: number, rank = 0): TurathPassage {
  return {
    book: { id: bookId, title: `كتاب ${bookId}` },
    location: { internalPage: page },
    text,
    url: `https://app.turath.io/book/${bookId}?page=${page}`,
    citation: `كتاب ${bookId}، ${page}`,
    rank,
    totalMatches: 1,
    truncated: false,
  };
}

const found = (passages: TurathPassage[]): TurathSearchResult => ({ passages, totalMatches: passages.length });
const categoryOf = (o?: TurathSearchOptions) => o?.categoryId;

describe("createTurathLookup", () => {
  it("searches a hadith in the Sunnah books only, bounded, and labels each passage with that category", async () => {
    const search = vi.fn(async () => found([passage(`قال: ${QUERY}`, "10", 5)]));
    const out = await createTurathLookup(search)(QUERY, "hadith");

    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith(QUERY, expect.objectContaining({ categoryId: "6", maxPassages: MAX_TURATH_PASSAGES, maxChars: 1_500, signal: expect.any(AbortSignal) }));
    expect(out).toMatchObject({ status: "success", references: [{ bookId: "10", category: { id: "6", title: "كتب السنة" } }] });
  });

  it("keeps only the passages that hold the asked text", async () => {
    const search = vi.fn(async () => found([passage("كلام عن العلم والصين بلا الحديث", "11", 1), passage(`ورد ${QUERY} في الباب`, "12", 2)]));
    const out = await createTurathLookup(search)(QUERY, "hadith");

    expect(out.status === "success" && out.references.map((r) => r.bookId)).toEqual(["12"]);
  });

  it("treats zero matches as a successful lookup with no references", async () => {
    const out = await createTurathLookup(vi.fn(async () => found([])))(QUERY, "hadith");
    expect(out).toEqual({ status: "success", references: [] });
  });

  it("searches a scholar's saying in four categories in parallel and merges them in scope order without repeats", async () => {
    const search = vi.fn(async (_q: string, o: TurathSearchOptions) => {
      const id = categoryOf(o);
      if (id === "6") return found([passage(QUERY, "10", 1)]);
      if (id === "23") return found([passage(QUERY, "20", 3), passage(QUERY, "10", 1)]); // the same page again
      if (id === "26") return found([passage(QUERY, "30", 7)]);
      return found([]);
    });
    const out = await createTurathLookup(search)(QUERY, "scholar_quote");

    expect(search.mock.calls.map((c) => categoryOf(c[1]))).toEqual(["6", "23", "26", "25"]);
    expect(out.status === "success" && out.references.map((r) => [r.bookId, r.category?.id])).toEqual([
      ["10", "6"],
      ["20", "23"],
      ["30", "26"],
    ]);
  });

  it("caps the merged references", async () => {
    const many = Array.from({ length: 10 }, (_, i) => passage(QUERY, String(100 + i), 1, i));
    const search = vi.fn(async (_q: string, o: TurathSearchOptions) => found(categoryOf(o) === "6" ? many : many.map((p) => ({ ...p, book: { id: `x${p.book.id}`, title: "x" }, location: { internalPage: 2 } }))));
    const out = await createTurathLookup(search)(QUERY, "scholar_quote");

    expect(out.status === "success" && out.references).toHaveLength(MAX_TURATH_PASSAGES);
  });

  it("is unavailable when every search fails, and partial when only some do", async () => {
    const failing = createTurathLookup(vi.fn(async () => { throw new Error("rate limited"); }));
    await expect(failing(QUERY, "scholar_quote")).resolves.toEqual({ status: "unavailable", references: [] });

    const some = createTurathLookup(vi.fn(async (_q: string, o: TurathSearchOptions) => {
      if (categoryOf(o) === "23") throw new Error("boom");
      return found(categoryOf(o) === "6" ? [passage(QUERY, "10", 1)] : []);
    }));
    await expect(some(QUERY, "scholar_quote")).resolves.toMatchObject({ status: "success", partial: true, references: [{ bookId: "10" }] });
  });

  it("aborts stalled searches at the overall five-second deadline", async () => {
    expect(TURATH_TIMEOUT_MS).toBe(5_000);
    vi.useFakeTimers();
    try {
      const search = vi.fn((_q: string, o: TurathSearchOptions) => new Promise<TurathSearchResult>((_resolve, reject) => {
        o.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const pending = createTurathLookup(search)(QUERY, "scholar_quote");

      await vi.advanceTimersByTimeAsync(TURATH_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ status: "unavailable", references: [] });
      expect(search).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
