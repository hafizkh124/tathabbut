import { describe, expect, it } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { MIN_PARTNER_SECRET, PARTNER_ID_HEADER, PARTNER_SIG_HEADER, PARTNER_TS_HEADER, signPartner } from "./partner";
import { partnerLocale, whatsappTextFor } from "./partnerReply";

const plain = new Request("https://tathabbut.alulama.org/api/verify", { method: "POST" });

describe("partnerLocale", () => {
  it("takes ar, en or ur and otherwise Urdu", () => {
    expect(partnerLocale("ar")).toBe("ar");
    expect(partnerLocale("en")).toBe("en");
    expect(partnerLocale("fr")).toBe("ur");
    expect(partnerLocale(undefined)).toBe("ur");
  });
});

describe("whatsappTextFor", () => {
  it("adds nothing for an ordinary visitor", () => {
    expect(whatsappTextFor(plain, [{} as ClaimResult], "ur")).toBeUndefined();
  });
  it("adds nothing when there are no results, even for a signed partner", () => {
    const secret = "p".repeat(MIN_PARTNER_SECRET);
    process.env.TATHABBUT_PARTNER_SECRET = secret;
    try {
      const ts = String(Math.floor(Date.now() / 1000));
      const id = "00112233445566778899";
      const signed = new Request(plain.url, { method: "POST", headers: { [PARTNER_ID_HEADER]: id, [PARTNER_TS_HEADER]: ts, [PARTNER_SIG_HEADER]: signPartner(secret, ts, id, "POST", "/api/verify") } });
      expect(whatsappTextFor(signed, [], "ur")).toBeUndefined();
    } finally {
      delete process.env.TATHABBUT_PARTNER_SECRET;
    }
  });
  it("never throws: a result the formatter cannot read gives no text, not an error", () => {
    const secret = "p".repeat(MIN_PARTNER_SECRET);
    process.env.TATHABBUT_PARTNER_SECRET = secret;
    try {
      const ts = String(Math.floor(Date.now() / 1000));
      const id = "00112233445566778899";
      const signed = new Request(plain.url, { method: "POST", headers: { [PARTNER_ID_HEADER]: id, [PARTNER_TS_HEADER]: ts, [PARTNER_SIG_HEADER]: signPartner(secret, ts, id, "POST", "/api/verify") } });
      expect(() => whatsappTextFor(signed, [{} as ClaimResult], "ur")).not.toThrow();
    } finally {
      delete process.env.TATHABBUT_PARTNER_SECRET;
    }
  });
});
