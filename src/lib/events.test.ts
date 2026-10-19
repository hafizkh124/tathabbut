import { describe, expect, it } from "vitest";
import { eventRow } from "./events";

describe("events", () => {
  it("takes the page's details from the headers, and the place from Vercel's geo headers", () => {
    const req = new Request("http://x/api/verify", {
      headers: { "x-tathabbut-device": "d-1", "x-tathabbut-source": "link", "x-tathabbut-locale": "ur", "x-vercel-ip-country": "PK", "x-vercel-ip-city": "Lahore%20Cantt" },
    });
    expect(eventRow(req, "verify", { claims: 1 })).toMatchObject({ device: "d-1", source: "link", locale: "ur", country: "PK", city: "Lahore Cantt", event: "verify", data: { claims: 1 } });
  });

  it("prefers what the page sent in the body, and cuts long values", () => {
    const req = new Request("http://x/api/event", { headers: { "x-tathabbut-device": "header" } });
    const row = eventRow(req, "visit", null, { device: "body", referrer: "https://wa.me/" + "x".repeat(400) });
    expect(row.device).toBe("body");
    expect(row.referrer).toHaveLength(300);
    expect(row.country).toBeNull();
  });
});
