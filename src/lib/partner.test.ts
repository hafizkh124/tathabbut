import { describe, expect, it } from "vitest";
import { MAX_SKEW_SECONDS, MIN_PARTNER_SECRET, PARTNER_ID_HEADER, PARTNER_SIG_HEADER, PARTNER_TS_HEADER, partnerPerson, signPartner } from "./partner";

const secret = "k".repeat(MIN_PARTNER_SECRET);
const id = "a1b2c3d4e5f60718";
const now = 1_800_000_000_000;
const url = "https://tathabbut.alulama.org/api/verify";

function req(over: { id?: string; ts?: string; sig?: string; method?: string; url?: string } = {}, signWith = secret) {
  const ts = over.ts ?? String(now / 1000);
  const theId = over.id ?? id;
  const method = over.method ?? "POST";
  const u = over.url ?? url;
  const sig = over.sig ?? signPartner(signWith, ts, theId, method, new URL(u).pathname);
  return new Request(u, { method, headers: { [PARTNER_ID_HEADER]: theId, [PARTNER_TS_HEADER]: ts, [PARTNER_SIG_HEADER]: sig } });
}

describe("partnerPerson", () => {
  it("accepts a correctly signed, fresh request and names the person", () => {
    expect(partnerPerson(req(), secret, now)).toBe(id);
  });
  it("accepts a small clock difference either way", () => {
    expect(partnerPerson(req({ ts: String(now / 1000 - MAX_SKEW_SECONDS + 1) }), secret, now)).toBe(id);
    expect(partnerPerson(req({ ts: String(now / 1000 + MAX_SKEW_SECONDS - 1) }), secret, now)).toBe(id);
  });
  it("refuses an old or future request (a copied header cannot be used later)", () => {
    expect(partnerPerson(req({ ts: String(now / 1000 - MAX_SKEW_SECONDS - 5) }), secret, now)).toBeNull();
    expect(partnerPerson(req({ ts: String(now / 1000 + MAX_SKEW_SECONDS + 5) }), secret, now)).toBeNull();
  });
  it("refuses a signature made with another secret or for another person, method or path", () => {
    expect(partnerPerson(req({}, "z".repeat(MIN_PARTNER_SECRET)), secret, now)).toBeNull();
    const r = req();
    const swapped = new Request(url, { method: "POST", headers: { [PARTNER_ID_HEADER]: "ffffffffffffffff", [PARTNER_TS_HEADER]: r.headers.get(PARTNER_TS_HEADER)!, [PARTNER_SIG_HEADER]: r.headers.get(PARTNER_SIG_HEADER)! } });
    expect(partnerPerson(swapped, secret, now)).toBeNull();
    const signedForGet = signPartner(secret, String(now / 1000), id, "GET", "/api/verify");
    expect(partnerPerson(req({ sig: signedForGet }), secret, now)).toBeNull();
    const signedForOther = signPartner(secret, String(now / 1000), id, "POST", "/api/ocr");
    expect(partnerPerson(req({ sig: signedForOther }), secret, now)).toBeNull();
  });
  it("is off when the server has no secret or a short one", () => {
    expect(partnerPerson(req(), null, now)).toBeNull();
  });
  it("refuses malformed headers", () => {
    expect(partnerPerson(req({ id: "+98 300 1234567" }), secret, now)).toBeNull(); // a phone number is never an id
    expect(partnerPerson(req({ ts: "soon" }), secret, now)).toBeNull();
    expect(partnerPerson(req({ sig: "abc" }), secret, now)).toBeNull();
    expect(partnerPerson(new Request(url, { method: "POST" }), secret, now)).toBeNull();
  });
});

// The same input is signed by Ateed's Python (ateed/tools/tathabbut_tool.py, tests/unit/test_tathabbut_whatsapp.py): if either
// side changes the format, one of the two tests fails.
describe("signature agreement with Ateed", () => {
  it("signs a fixed request to the exact value Ateed's code produces", () => {
    expect(signPartner("k".repeat(32), "1800000000", "a1b2c3d4e5f60718", "POST", "/api/verify")).toBe("fc92046cdb759c7d4fe9e26387edf458713fa7356b26b907f595de3ef508f688");
  });
});
