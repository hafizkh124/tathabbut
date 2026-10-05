import { beforeEach, describe, expect, it, vi } from "vitest";
import { translateExcerpt } from "@/lib/translate";
import { POST } from "./route";

vi.mock("@/lib/translate", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/translate")>()), translateExcerpt: vi.fn() }));
vi.mock("@/lib/turathCache", () => ({ supabaseTranslationCache: () => ({}) }));
// the signature check is the real one, with a fixed key
vi.mock("@/lib/turathSign", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/turathSign")>();
  return { ...real, verifyExcerpt: (t: string, s: unknown) => real.verifyExcerpt(t, s, "test-key") };
});
import { signExcerpt } from "@/lib/turathSign";

const TEXT = "باب سجود السهو";
const sig = signExcerpt(TEXT, "test-key");
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/translate", () => {
  it("translates a signed excerpt", async () => {
    vi.mocked(translateExcerpt).mockResolvedValue({ translation: "Chapter on the prostration of forgetfulness", cached: false });
    const res = await post({ text: TEXT, sig, to: "en" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "Chapter on the prostration of forgetfulness", cached: false });
    expect(vi.mocked(translateExcerpt)).toHaveBeenCalledWith(TEXT, "en", expect.anything());
  });

  it("refuses a text with no signature, a wrong one, or a signature of another text", async () => {
    for (const body of [{ text: TEXT, to: "en" }, { text: TEXT, sig: "0".repeat(64), to: "en" }, { text: `${TEXT} وزيادة`, sig, to: "en" }]) {
      expect((await post(body)).status).toBe(403);
    }
    expect(vi.mocked(translateExcerpt)).not.toHaveBeenCalled();
  });

  it.each([
    ["not json", "{"],
    ["empty text", { text: " ", sig, to: "en" }],
    ["a language that is not offered", { text: TEXT, sig, to: "fr" }],
    ["too long a text", { text: "ا".repeat(1_700), sig, to: "en" }],
  ])("rejects %s", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(vi.mocked(translateExcerpt)).not.toHaveBeenCalled();
  });

  it("answers 502 without exposing provider errors or private excerpt text", async () => {
    vi.mocked(translateExcerpt).mockRejectedValue(new Error("api-key=secret; private excerpt"));
    const res = await post({ text: TEXT, sig, to: "ur" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "could not translate" });
  });
});
