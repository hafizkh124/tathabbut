import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeArabic } from "./arabic";
import { parseDorarHtml, searchDorar } from "./dorar";

// A real dorar.net response for «اطلبوا العلم ولو بالصين», saved 2026-10-02.
const html = readFileSync(join(__dirname, "__fixtures__", "dorar_talab_al_ilm.html"), "utf-8");

describe("parseDorarHtml", () => {
  const results = parseDorarHtml(html);

  it("reads every narration in the response", () => {
    expect(results.length).toBe(15);
    expect(results.map((r) => r.rank)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("keeps the muhaddith's fields verbatim", () => {
    expect(results[1]).toMatchObject({
      rawi: "أنس بن مالك",
      muhaddith: "ابن حبان",
      source: "المجروحين",
      reference: "1/489",
      verdict: "باطل لا أصل له",
    });
  });

  it("does not leak one label into another field", () => {
    expect(results[0].verdict).toBe("[فيه] أبو العاتكة لا يعرف، وليس لهذا الحديث أصل");
    for (const r of results) {
      for (const v of [r.rawi, r.muhaddith, r.source, r.reference, r.verdict]) {
        expect(v ?? "").not.toMatch(/المحدث:|المصدر:|الراوي:/);
      }
    }
  });

  it("strips the running number and markup from the matn", () => {
    // Dorar's mark order (shadda/kasra) may differ from typed text, so compare normalized.
    expect(normalizeArabic(results[0].matn)).toBe("اطلبوا العلم ولو بالصين.");
    expect(results[0].matn).not.toMatch(/<|span/);
  });

  it("returns nothing for empty input", () => {
    expect(parseDorarHtml("")).toEqual([]);
  });
});

describe("searchDorar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  const page = (result: string) => new Response(JSON.stringify({ ahadith: { result } }), { status: 200 });

  it("asks again when Dorar sends an empty page, which it never does for a real query (2026-10-19)", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    const f = vi.fn().mockResolvedValueOnce(page("")).mockResolvedValueOnce(page(html));
    vi.stubGlobal("fetch", f);
    vi.useFakeTimers();
    const pending = searchDorar("اطلبوا العلم ولو بالصين");
    await vi.runAllTimersAsync();
    const r = await pending;
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.ok && r.results.length).toBe(15);
  });

  it("reports an empty page that stays empty as such", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => page("")));
    vi.useFakeTimers();
    const pending = searchDorar("x y z");
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ ok: false, error: "empty" });
  });
});
