import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { STATES } from "./states";
import { applyTurath, fetchTurath, turathKindOf } from "./turathClient";

const claim = (over: Partial<ClaimResult["claim"]> = {}, rest: Partial<ClaimResult> = {}): ClaimResult => ({
  claim: { kind: "hadith", textAsWritten: "نص", spanCheck: "exact", arabicSpan: "نص عربي", query: "نص عربي", queryIsTranslation: false, language: "ar", attributedTo: null, citedSource: null, warnings: [], ...over },
  state: STATES.notFound,
  basis: "none",
  notes: ["لا رواية مطابقة في الدرر"],
  ...rest,
});

afterEach(() => vi.unstubAllGlobals());

describe("turathKindOf", () => {
  it("asks for a hadith and for a scholar's saying written in Arabic", () => {
    expect(turathKindOf(claim())).toBe("hadith");
    expect(turathKindOf(claim({ kind: "scholar_quote" }))).toBe("scholar_quote");
  });

  it("does not ask for a verse, a question, another kind, or text without Arabic letters", () => {
    expect(turathKindOf(claim({}, { basis: "quran", state: STATES.verseOk }))).toBeNull();
    expect(turathKindOf(claim({ kind: "question" }, { basis: "kind", state: STATES.fatwa }))).toBeNull();
    expect(turathKindOf(claim({ kind: "quran" }))).toBeNull();
    expect(turathKindOf(claim({ query: "only english words" }))).toBeNull();
  });
});

describe("applyTurath", () => {
  const found = { status: "success" as const, references: [] };

  it("keeps the claim and records the references when there is no patch", () => {
    const c = claim({}, { state: "ضعيف", basis: "dorar" });
    expect(applyTurath(c, found, null)).toEqual({ ...c, turath: found });
  });

  it("changes the state when Turath patches it", () => {
    const out = applyTurath(claim(), found, { state: STATES.turathFound, basis: "turath", notes: ["ورد النص في كتب التراث"] });
    expect(out).toMatchObject({ state: STATES.turathFound, basis: "turath" });
    expect(out.notes).toHaveLength(2);
  });
});

describe("fetchTurath", () => {
  it("posts the claim's query, kind and result and returns the answer", async () => {
    const answer = { turath: { status: "success", references: [] }, patch: null };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => answer }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTurath(claim(), "hadith")).resolves.toEqual(answer);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe("/api/turath");
    expect(JSON.parse(init.body)).toMatchObject({ query: "نص عربي", kind: "hadith", state: STATES.notFound, basis: "none" });
  });

  it("is «unavailable» on a failed request or a network error, never a throw", async () => {
    const unavailable = { turath: { status: "unavailable", references: [] }, patch: null };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await expect(fetchTurath(claim(), "hadith")).resolves.toEqual(unavailable);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(fetchTurath(claim(), "hadith")).resolves.toEqual(unavailable);
  });
});
