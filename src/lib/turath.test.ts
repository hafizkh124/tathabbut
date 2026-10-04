import { describe, expect, it, vi } from "vitest";
import type { Passage, RetrievedContext } from "nusus";
import type { RetrieveOptions, TurathClient } from "nusus/turath";
import { createTurathLookup, MAX_TURATH_PASSAGES, TURATH_TIMEOUT_MS } from "./turath";

vi.mock("../data/turathRulingBooks.json", () => ({ default: ["900"] }));

const QUERY = "اطلبوا العلم ولو بالصين";

function passage(text: string, bookId: string, page: number, rank = 0): Passage {
  return {
    provider: "turath",
    book: { id: bookId, title: `كتاب ${bookId}` },
    location: { internalPage: page },
    text,
    headings: [],
    url: `https://app.turath.io/book/${bookId}/${page}`,
    citation: `كتاب ${bookId}، ${page}`,
    provenance: { query: QUERY, rank, totalMatches: 1, truncated: false, contextPages: { before: 0, after: 0 }, retrievedVia: "search-hit" },
  };
}

const context = (passages: Passage[]): RetrievedContext => ({ passages, totalMatches: passages.length, query: QUERY });
const clientWith = (retrieve: (q: string, o?: RetrieveOptions) => Promise<RetrievedContext>): Pick<TurathClient, "retrieve"> => ({ retrieve });
const categoryOf = (o?: RetrieveOptions) => o?.scope?.categoryIds?.[0];

describe("createTurathLookup", () => {
  it("searches a hadith in the Sunnah books only, bounded, and labels each passage with that category", async () => {
    const retrieve = vi.fn(async () => context([passage(`قال: ${QUERY}`, "10", 5)]));
    const out = await createTurathLookup(clientWith(retrieve))(QUERY, "hadith");

    expect(retrieve).toHaveBeenCalledOnce();
    expect(retrieve).toHaveBeenCalledWith(QUERY, expect.objectContaining({ maxPassages: MAX_TURATH_PASSAGES, maxCharsPerPassage: 1_500, scope: { categoryIds: ["6"] }, signal: expect.any(AbortSignal) }));
    expect(out).toMatchObject({ status: "success", references: [{ bookId: "10", category: { id: "6", title: "كتب السنة" } }] });
  });

  it("keeps only the passages that hold the asked text", async () => {
    const retrieve = vi.fn(async () => context([passage("كلام عن العلم والصين بلا الحديث", "11", 1), passage(`ورد ${QUERY} في الباب`, "12", 2)]));
    const out = await createTurathLookup(clientWith(retrieve))(QUERY, "hadith");

    expect(out.status === "success" && out.references.map((r) => r.bookId)).toEqual(["12"]);
  });

  it("treats zero matches as a successful lookup with no references", async () => {
    const out = await createTurathLookup(clientWith(vi.fn(async () => context([]))))(QUERY, "hadith");
    expect(out).toEqual({ status: "success", references: [] });
  });

  it("searches a scholar's saying in four categories in parallel and merges them in scope order without repeats", async () => {
    const retrieve = vi.fn(async (_q: string, o?: RetrieveOptions) => {
      const id = categoryOf(o);
      if (id === "6") return context([passage(QUERY, "10", 1)]);
      if (id === "23") return context([passage(QUERY, "20", 3), passage(QUERY, "10", 1)]); // the same page again
      if (id === "26") return context([passage(QUERY, "30", 7)]);
      return context([]);
    });
    const out = await createTurathLookup(clientWith(retrieve))(QUERY, "scholar_quote");

    expect(retrieve.mock.calls.map((c) => categoryOf(c[1]))).toEqual(["6", "23", "26", "25"]);
    expect(out.status === "success" && out.references.map((r) => [r.bookId, r.category?.id])).toEqual([
      ["10", "6"],
      ["20", "23"],
      ["30", "26"],
    ]);
  });

  it("caps the merged references", async () => {
    const many = Array.from({ length: 10 }, (_, i) => passage(QUERY, String(100 + i), 1, i));
    const retrieve = vi.fn(async (_q: string, o?: RetrieveOptions) => context(categoryOf(o) === "6" ? many : many.map((p) => ({ ...p, book: { id: `x${p.book.id}`, title: "x" }, location: { internalPage: 2 } }))));
    const out = await createTurathLookup(clientWith(retrieve))(QUERY, "scholar_quote");

    expect(out.status === "success" && out.references).toHaveLength(MAX_TURATH_PASSAGES);
  });

  it("tags a passage from a book that judges hadith", async () => {
    const retrieve = vi.fn(async () => context([passage(QUERY, "900", 1), passage(QUERY, "10", 1)]));
    const out = await createTurathLookup(clientWith(retrieve))(QUERY, "hadith");

    expect(out.status === "success" && out.references.map((r) => [r.bookId, r.rulingBook])).toEqual([["900", true], ["10", undefined]]);
  });

  it("is unavailable when every search fails, and partial when only some do", async () => {
    const failing = createTurathLookup(clientWith(vi.fn(async () => { throw new Error("rate limited"); })));
    await expect(failing(QUERY, "scholar_quote")).resolves.toEqual({ status: "unavailable", references: [] });

    const some = createTurathLookup(clientWith(vi.fn(async (_q: string, o?: RetrieveOptions) => {
      if (categoryOf(o) === "23") throw new Error("boom");
      return context(categoryOf(o) === "6" ? [passage(QUERY, "10", 1)] : []);
    })));
    await expect(some(QUERY, "scholar_quote")).resolves.toMatchObject({ status: "success", partial: true, references: [{ bookId: "10" }] });
  });

  it("aborts stalled searches at the overall ten-second deadline", async () => {
    vi.useFakeTimers();
    try {
      const retrieve = vi.fn((_q: string, o?: RetrieveOptions) => new Promise<RetrievedContext>((_resolve, reject) => {
        o?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const pending = createTurathLookup(clientWith(retrieve))(QUERY, "scholar_quote");

      await vi.advanceTimersByTimeAsync(TURATH_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ status: "unavailable", references: [] });
      expect(retrieve).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
