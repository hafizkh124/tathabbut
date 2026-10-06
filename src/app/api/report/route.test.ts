import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: object, ip = "203.0.113.1") =>
  new Request("http://localhost/api/report", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const good = { text: "اطلبوا العلم ولو بالصين", query: "اطلبوا العلم ولو بالصين", state: "veryWeak", locale: "ur" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/report", () => {
  it("stores the report with the service key and says so", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await POST(post(good, "203.0.113.10"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/rest/v1/reports");
    expect(init.headers.apikey).toBe("sb_secret_test");
    expect(JSON.parse(init.body)).toEqual(good);
  });

  it("refuses a report without text, state or a known language", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await POST(post({ ...good, text: " " }, "203.0.113.11"))).status).toBe(400);
    expect((await POST(post({ ...good, state: "" }, "203.0.113.11"))).status).toBe(400);
    expect((await POST(post({ ...good, locale: "fr" }, "203.0.113.11"))).status).toBe(400);
  });

  it("does not pretend a report was saved when the database refuses it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 401 })));
    const r = await POST(post(good, "203.0.113.12"));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "could not save the report" });
  });

  it("stops a loop of reports from one address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await POST(post(good, "203.0.113.13"))).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
