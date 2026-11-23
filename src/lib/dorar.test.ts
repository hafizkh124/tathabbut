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

describe("searchDorar when Dorar is slow (2026-11-23)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  const page = (result: string) => new Response(JSON.stringify({ ahadith: { result } }), { status: 200 });
  /** a call that never answers until it is cancelled, as a hung Dorar does */
  const hang = (_url: unknown, init: { signal: AbortSignal }) =>
    new Promise<Response>((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));

  it("asks once more beside a call that has not answered in 2.5 s, and takes whichever answers well first", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    const f = vi.fn().mockImplementationOnce(hang).mockImplementationOnce(async () => page(html));
    vi.stubGlobal("fetch", f);
    vi.useFakeTimers();
    let done = false;
    const pending = searchDorar("اطلبوا العلم ولو بالصين").then((r) => ((done = true), r));
    await vi.advanceTimersByTimeAsync(2_400);
    expect(f).toHaveBeenCalledTimes(1); // not yet: the first call still has time
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    const r = await pending;
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.ok && r.results.length).toBe(15);
  });

  it("does not ask twice when the first call answers in time", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    const f = vi.fn().mockImplementation(async () => page(html));
    vi.stubGlobal("fetch", f);
    vi.useFakeTimers();
    const pending = searchDorar("اطلبوا العلم ولو بالصين");
    await vi.runAllTimersAsync();
    expect((await pending).ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("keeps the first call's good answer when it arrives after the second began and the second is still waiting", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    let release: (r: Response) => void = () => {};
    const f = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)))
      .mockImplementationOnce(hang);
    vi.stubGlobal("fetch", f);
    vi.useFakeTimers();
    const pending = searchDorar("اطلبوا العلم ولو بالصين");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(f).toHaveBeenCalledTimes(2);
    release(page(html));
    expect((await pending).ok).toBe(true);
  });

  it("gives up within the overall deadline when Dorar hangs, not after two full waits (the old 17.5 s)", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(hang));
    vi.useFakeTimers();
    const t0 = Date.now();
    let result: unknown;
    const pending = searchDorar("اطلبوا العلم ولو بالصين").then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(9_000);
    await pending;
    expect(Date.now() - t0).toBeLessThanOrEqual(9_000);
    expect(result).toMatchObject({ ok: false, error: "timeout" });
  });
});
