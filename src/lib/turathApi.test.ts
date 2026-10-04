import { describe, expect, it, vi } from "vitest";
import { boundExcerpt, searchTurath, searchVariants, TurathError } from "./turathApi";

const QUERY = "اطلبوا العلم ولو بالصين";

const hit = (over: Record<string, unknown> = {}) => ({
  book_id: 2677,
  cat_id: 6,
  author_id: 11,
  meta: JSON.stringify({ headings: [], page_id: 7128, page: 138, vol: "10", book_name: "كنز العمال", author_name: "المتقي الهندي" }),
  snip: "<em>اطلبوا</em> العلم",
  text: `قال: &quot;<em>اطلبوا</em> العلم ولو بالصين&quot;<br>وبعده كلام`,
  ...over,
});

function fetchReturning(...bodies: unknown[]) {
  let i = 0;
  return vi.fn(async () => {
    const body = bodies[Math.min(i++, bodies.length - 1)];
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
}

const urlOf = (f: ReturnType<typeof vi.fn>, call = 0) => (f.mock.calls[call] as unknown as [URL])[0];

describe("searchTurath", () => {
  it("asks api.turath.io for one category, with our User-Agent and no cookies, and reads the hit as a passage", async () => {
    const f = fetchReturning({ count: 37, data: [hit()] });
    const out = await searchTurath(QUERY, { categoryId: "6", maxPassages: 10, maxChars: 1500, fetch: f });

    const url = urlOf(f);
    expect(url.origin + url.pathname).toBe("https://api.turath.io/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: QUERY, ver: "3", page: "1", cat_id: "6" });
    const init = (f.mock.calls[0] as unknown as [URL, { headers: Record<string, string> }])[1];
    expect(init.headers["user-agent"]).toMatch(/^Tathabbut\//);
    expect(out.totalMatches).toBe(37);
    expect(out.passages).toHaveLength(1);
    expect(out.passages[0]).toEqual({
      book: { id: "2677", title: "كنز العمال" },
      author: { id: "11", name: "المتقي الهندي" },
      categoryId: "6",
      location: { internalPage: 7128, printedPage: 138, volume: "10" },
      text: `قال: "اطلبوا العلم ولو بالصين"\nوبعده كلام`,
      url: "https://app.turath.io/book/2677?page=7128",
      citation: "المتقي الهندي، كنز العمال، ج 10، ص 138، صفحة تراث 7128، تراث 2677",
      rank: 0,
      totalMatches: 37,
      truncated: false,
    });
  });

  it("keeps Turath's order and cuts the list at maxPassages", async () => {
    const f = fetchReturning({ count: 3, data: [hit({ book_id: 1 }), hit({ book_id: 2 }), hit({ book_id: 3 })] });
    const out = await searchTurath(QUERY, { categoryId: "6", maxPassages: 2, maxChars: 1500, fetch: f });
    expect(out.passages.map((p) => [p.book.id, p.rank])).toEqual([["1", 0], ["2", 1]]);
  });

  it("skips a hit that lacks what a citation needs, and keeps the others", async () => {
    const f = fetchReturning({ count: 3, data: [hit({ meta: "not json" }), hit({ book_id: "x" }), hit({ book_id: 9 })] });
    const out = await searchTurath(QUERY, { categoryId: "6", maxPassages: 10, maxChars: 1500, fetch: f });
    expect(out.passages.map((p) => p.book.id)).toEqual(["9"]);
  });

  it("tries another spelling only when the asked one finds nothing, and says which one worked", async () => {
    const asked = "إنما الأعمال بالنيات";
    const f = fetchReturning({ count: 0, data: [] }, { count: 5, data: [hit()] });
    const out = await searchTurath(asked, { categoryId: "6", maxPassages: 10, maxChars: 1500, fetch: f });

    expect(f).toHaveBeenCalledTimes(2);
    expect(urlOf(f, 1).searchParams.get("q")).toBe("انما الأعمال بالنيات");
    expect(out.effectiveQuery).toBe("انما الأعمال بالنيات");
    expect(out.passages).toHaveLength(1);
  });

  it("makes one request, and no retry, for a text already spelled plainly that finds nothing", async () => {
    const f = fetchReturning({ count: 0, data: [] });
    const out = await searchTurath("الزرافة تسبح عند طلوع القمر", { categoryId: "6", maxPassages: 10, maxChars: 1500, fetch: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ passages: [], totalMatches: 0 });
  });

  it("throws on an HTTP error, invalid JSON or a malformed answer", async () => {
    const failing = (res: object) => vi.fn(async () => res as unknown as Response);
    const opts = { categoryId: "6", maxPassages: 10, maxChars: 1500 };
    await expect(searchTurath(QUERY, { ...opts, fetch: failing({ ok: false, status: 429 }) })).rejects.toMatchObject({ code: "HTTP_ERROR", status: 429 });
    await expect(searchTurath(QUERY, { ...opts, fetch: failing({ ok: true, json: async () => { throw new Error("x"); } }) })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(searchTurath(QUERY, { ...opts, fetch: failing({ ok: true, json: async () => ({ count: "many" }) }) })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("passes the caller's abort signal on to the request", async () => {
    const f = fetchReturning({ count: 0, data: [] });
    const controller = new AbortController();
    await searchTurath("نص بسيط", { categoryId: "6", maxPassages: 10, maxChars: 1500, signal: controller.signal, fetch: f });
    expect((f.mock.calls[0] as unknown as [URL, { signal: AbortSignal }])[1].signal).toBe(controller.signal);
  });

  it("refuses bad arguments before any request", async () => {
    const f = fetchReturning({ count: 0, data: [] });
    const base = { categoryId: "6", maxPassages: 10, maxChars: 1500, fetch: f };
    await expect(searchTurath("  ", base)).rejects.toBeInstanceOf(TurathError);
    await expect(searchTurath(QUERY, { ...base, categoryId: "6,7" })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(searchTurath(QUERY, { ...base, maxPassages: 21 })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("boundExcerpt", () => {
  const filler = (n: number) => "كلمة ".repeat(n);

  it("returns a short page whole", () => {
    expect(boundExcerpt("نص قصير", 1500, QUERY)).toEqual({ text: "نص قصير", truncated: false });
  });

  it("centres a long page on the asked phrase, so the phrase is inside the cut", () => {
    const page = `${filler(500)}${QUERY} ${filler(500)}`;
    const out = boundExcerpt(page, 600, QUERY);
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(600);
    expect(out.text).toContain(QUERY);
  });

  it("falls back to the first marked word, then to the start of the page", () => {
    const page = `${filler(400)}الصين ${filler(400)}`;
    expect(boundExcerpt(page, 500, "جملة غير موجودة هنا", "كلام <em>الصين</em> آخر").text).toContain("الصين");
    expect(boundExcerpt(page, 500, "جملة غير موجودة هنا").text).toBe(page.slice(0, 500));
  });

  it("never ends on half of a surrogate pair", () => {
    const page = "😀".repeat(400);
    const out = boundExcerpt(page, 501, "لا يوجد");
    expect(out.text.length % 2).toBe(0);
  });
});

describe("searchVariants", () => {
  it("is empty for a text spelled plainly, and offers the plain spelling otherwise", () => {
    expect(searchVariants("اطلبوا العلم")).toEqual([]);
    expect(searchVariants("إنما الأعمال")).toEqual(["انما الأعمال"]); // an alef with hamza above (أ) is kept, as Turath indexes it
  });

  it("adds the hamza forms when the text carries a hamza", () => {
    expect(searchVariants("مسئول")).toEqual(["مسءول", "مسؤول"]); // the spelling asked is not tried twice
  });
});
