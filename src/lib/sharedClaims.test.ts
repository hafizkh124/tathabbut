import { describe, expect, it, vi } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { loadSharedClaims, parseShareIds, saveSharedClaims, SHARE_ID, shareIdOf, storedClaim, withShareIds } from "./sharedClaims";

const narration = (n: number) => ({ text: `رواية ${n}`, muhaddith: "الألباني", verdict: "ضعيف" });
const hadith = {
  claim: { kind: "hadith", textAsWritten: "صوموا تصحوا", query: "صوموا تصحوا" },
  state: "ضعيف",
  notes: [],
  dorar: { narrations: Array.from({ length: 15 }, (_, i) => narration(i)) },
  turath: { status: "loading" },
} as unknown as ClaimResult;
const personal = { claim: { kind: "question", scope: "personal", textAsWritten: "أنا مقيم في ألمانيا…" }, state: "إحالة", notes: [] } as unknown as ClaimResult;

describe("shared results", () => {
  it("stores the result without the books' answer and with fewer narrations", () => {
    const s = storedClaim(hadith)!;
    expect(s.turath).toBeUndefined();
    expect(s.dorar?.narrations).toHaveLength(8);
  });

  it("never stores a personal question", () => {
    expect(storedClaim(personal)).toBeNull();
    const { claims, rows } = withShareIds([hadith, personal], "key");
    expect(claims[0].shareId).toMatch(SHARE_ID);
    expect(claims[1].shareId).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].claim.shareId).toBe(rows[0].id);
  });

  it("gives the same result the same id, and an id that depends on the key", () => {
    const json = JSON.stringify(storedClaim(hadith));
    expect(shareIdOf(json, "key")).toBe(shareIdOf(json, "key"));
    expect(shareIdOf(json, "key")).not.toBe(shareIdOf(json, "other"));
    expect(shareIdOf(json, null)).toBeUndefined();
    expect(withShareIds([hadith], null).rows).toHaveLength(0); // no key: no links
  });

  it("reads only well-formed ids from a link, each once", () => {
    expect(parseShareIds("abcDEF123456-abcDEF123456-bad-xyzXYZ987654")).toEqual(["abcDEF123456", "xyzXYZ987654"]);
    expect(parseShareIds("abcDEF123456),id.not.is.null")).toEqual([]);
  });

  it("stores rows once (duplicates ignored) and loads them in the link's order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await saveSharedClaims([{ id: "abcDEF123456", claim: hadith }], { url: "http://db", key: "k" });
    expect(fetchMock.mock.calls[0][1].headers.Prefer).toContain("ignore-duplicates");

    fetchMock.mockResolvedValue(Response.json([{ id: "B00000000000", claim: { state: "b" } }, { id: "A00000000000", claim: { state: "a" } }]));
    const got = await loadSharedClaims(["A00000000000", "C00000000000", "B00000000000"], { url: "http://db", key: "k" });
    expect(got.map((c) => c.state)).toEqual(["a", "b"]);
    vi.unstubAllGlobals();
  });
});
