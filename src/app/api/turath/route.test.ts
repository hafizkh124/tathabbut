import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TurathLookupOutcome } from "@/lib/hadithMatch";
import { lookupTurath } from "@/lib/turath";
import { POST } from "./route";

vi.mock("@/lib/turath", () => ({ lookupTurath: vi.fn() }));
vi.mock("@/lib/turathSign", () => ({ signExcerpt: (t: string) => `sig:${t}` }));

// an in-memory cache in place of Supabase, so the test is hermetic and can see what is remembered
const rows = new Map<string, TurathLookupOutcome>();
vi.mock("@/lib/turathCache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/turathCache")>()),
  supabaseTurathCache: () => ({
    get: async (kind: string, q: string) => rows.get(`${kind}:${q}`) ?? null,
    put: async (kind: string, q: string, o: TurathLookupOutcome) => {
      if (o.status === "success" && !o.partial) rows.set(`${kind}:${q}`, o);
    },
  }),
}));

const reference = { excerpt: "نص من كتاب", citation: "كتاب العلل، ص 12", book: { id: "42", title: "كتاب العلل" }, bookId: "42", url: "https://app.turath.io/book/42/6" };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/turath", { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  rows.clear();
});

describe("POST /api/turath", () => {
  it("returns the references and the patch for a hadith Dorar did not find", async () => {
    const outcome: TurathLookupOutcome = { status: "success", references: [reference] };
    vi.mocked(lookupTurath).mockResolvedValue(outcome);

    const res = await post({ query: "حديث تجريبي", kind: "hadith", state: "لم يُعثر عليه — إحالة", basis: "none", notes: [] });
    const body = (await res.json()) as { turath: TurathLookupOutcome; patch: { state: string; basis: string } | null };

    expect(res.status).toBe(200);
    expect(vi.mocked(lookupTurath)).toHaveBeenCalledWith("حديث تجريبي", "hadith");
    expect(body.turath).toEqual({ status: "success", references: [{ ...reference, sig: `sig:${reference.excerpt}` }] });
    expect(body.patch).toMatchObject({ state: "موجود في كتب التراث", basis: "turath" });
  });

  it("answers a repeated question from the cache without asking Turath again, and signs the excerpts again", async () => {
    vi.mocked(lookupTurath).mockResolvedValue({ status: "success", references: [reference] });
    const ask = () => post({ query: "حديث مكرر", kind: "hadith", state: "ضعيف", basis: "dorar", notes: [] });
    await ask();
    const second = (await (await ask()).json()) as { turath: TurathLookupOutcome };

    expect(vi.mocked(lookupTurath)).toHaveBeenCalledOnce();
    expect(second.turath.references[0]).toMatchObject({ sig: `sig:${reference.excerpt}` });
    expect([...rows.values()].every((o) => o.references.every((r) => !("sig" in r)))).toBe(true); // no signature is stored
  });

  it("does not remember an unavailable lookup", async () => {
    vi.mocked(lookupTurath).mockResolvedValue({ status: "unavailable", references: [] });
    await post({ query: "حديث", kind: "hadith", state: "ضعيف", basis: "dorar", notes: [] });
    await post({ query: "حديث", kind: "hadith", state: "ضعيف", basis: "dorar", notes: [] });
    expect(vi.mocked(lookupTurath)).toHaveBeenCalledTimes(2);
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

  it("takes a fiqh topic, searches it, and never patches the card", async () => {
    vi.mocked(lookupTurath).mockResolvedValue({ status: "success", references: [reference] });
    const res = await post({ query: "طلاق الغضبان", kind: "fiqh", state: "فتوى أو حالة شخصية — إحالة", basis: "kind", notes: [] });
    const body = (await res.json()) as { patch: unknown };
    expect(res.status).toBe(200);
    expect(vi.mocked(lookupTurath)).toHaveBeenCalledWith("طلاق الغضبان", "fiqh");
    expect(body.patch).toBeNull();
  });

  it.each([
    ["a story instead of a topic", { query: "میں نے غصے میں بیوی کو تین طلاقیں دے دیں", kind: "fiqh" }],
    ["a topic with a number", { query: "طلاق ثلاث مرات 3", kind: "fiqh" }],
    ["a long Arabic sentence", { query: "هل يقع الطلاق إذا طلق الرجل زوجته وهو غضبان شديد الغضب", kind: "fiqh" }],
  ])("rejects a fiqh query that is %s", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(vi.mocked(lookupTurath)).not.toHaveBeenCalled();
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
