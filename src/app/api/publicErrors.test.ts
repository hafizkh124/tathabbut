import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractClaims } from "@/lib/claims";
import { readImage } from "@/lib/ocr";
import { trackClaimOrigin } from "@/lib/originTracker";
import { lookupDorar } from "@/lib/lookup";
import { POST as verify } from "./verify/route";
import { POST as ocr } from "./ocr/route";
import { POST as origin } from "./origin/route";
import { GET as lookup } from "./lookup/route";

vi.mock("@/lib/claims", () => ({ extractClaims: vi.fn() }));
vi.mock("@/lib/ocr", async (original) => ({ ...(await original<typeof import("@/lib/ocr")>()), readImage: vi.fn() }));
vi.mock("@/lib/originTracker", () => ({ trackClaimOrigin: vi.fn() }));
vi.mock("@/lib/lookup", () => ({ lookupDorar: vi.fn() }));
vi.mock("@/lib/dorarCache", () => ({ supabaseDorarCache: () => null }));

const post = (path: string, body: object) => new Request(`http://localhost/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const privateError = new Error("provider response: api-key=secret; private question text");

beforeEach(() => vi.clearAllMocks());

describe("public failure responses", () => {
  it("does not expose extraction provider messages", async () => {
    vi.mocked(extractClaims).mockRejectedValue(privateError);
    const r = await verify(post("verify", { text: "عبارة تجريبية" }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "could not read the post" });
  });
  it("does not expose image provider messages", async () => {
    vi.mocked(readImage).mockRejectedValue(privateError);
    const r = await ocr(post("ocr", { image: "YWJj", mimeType: "image/png" }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "could not read the image" });
  });
  it("does not expose origin provider messages", async () => {
    vi.mocked(trackClaimOrigin).mockRejectedValue(privateError);
    const r = await origin(post("origin", { text: "عبارة تجريبية" }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "could not investigate origin" });
  });
  it("does not expose lookup network details", async () => {
    vi.mocked(lookupDorar).mockResolvedValue({ ok: false, error: "network", detail: privateError.message });
    const r = await lookup(new Request("http://localhost/api/lookup?q=test"));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "network" });
  });
  it("rejects long input before contacting extraction", async () => {
    const r = await verify(post("verify", { text: "ا".repeat(5001) }));
    expect(r.status).toBe(400);
    expect(extractClaims).not.toHaveBeenCalled();
  });
});
