import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TurathLookupOutcome } from "@/lib/hadithMatch";
import { lookupTurath } from "@/lib/turath";
import { POST } from "./route";

vi.mock("@/lib/turath", () => ({ lookupTurath: vi.fn() }));

const reference = { excerpt: "نص من كتاب", citation: "كتاب العلل، ص 12", book: { id: "42", title: "كتاب العلل" }, bookId: "42", url: "https://app.turath.io/book/42/6" };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/turath", { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/turath", () => {
  it("returns the references and the patch for a hadith Dorar did not find", async () => {
    const outcome: TurathLookupOutcome = { status: "success", references: [reference] };
    vi.mocked(lookupTurath).mockResolvedValue(outcome);

    const res = await post({ query: "حديث تجريبي", kind: "hadith", state: "لم يُعثر عليه — إحالة", basis: "none", notes: [] });
    const body = (await res.json()) as { turath: TurathLookupOutcome; patch: { state: string; basis: string } | null };

    expect(res.status).toBe(200);
    expect(vi.mocked(lookupTurath)).toHaveBeenCalledWith("حديث تجريبي", "hadith");
    expect(body.turath).toEqual(outcome);
    expect(body.patch).toMatchObject({ state: "غير حاسم", basis: "turath", reason: "no-ruling" });
  });

  it("returns no patch when Dorar already gave a verdict, and still returns the references", async () => {
    vi.mocked(lookupTurath).mockResolvedValue({ status: "success", references: [reference] });

    const res = await post({ query: "حديث", kind: "hadith", state: "ضعيف", basis: "dorar", notes: [] });
    const body = (await res.json()) as { turath: TurathLookupOutcome; patch: unknown };

    expect(body.patch).toBeNull();
    expect(body.turath.references).toHaveLength(1);
  });

  it("passes an unavailable lookup through without a patch", async () => {
    vi.mocked(lookupTurath).mockResolvedValue({ status: "unavailable", references: [] });

    const res = await post({ query: "حديث", kind: "scholar_quote", state: "لم يُعثر عليه — إحالة", basis: "none" });
    expect(await res.json()).toEqual({ turath: { status: "unavailable", references: [] }, patch: null });
  });

  it.each([
    ["not json", "{"],
    ["empty query", { query: "  ", kind: "hadith" }],
    ["too long", { query: "ا".repeat(1_001), kind: "hadith" }],
    ["unknown kind", { query: "حديث", kind: "quran" }],
    ["missing kind", { query: "حديث" }],
  ])("rejects %s", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(vi.mocked(lookupTurath)).not.toHaveBeenCalled();
  });
});
