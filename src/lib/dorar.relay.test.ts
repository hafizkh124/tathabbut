import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchDorar } from "./dorar";

const fixture = readFileSync(join(__dirname, "__fixtures__", "dorar_talab_al_ilm.html"), "utf-8");
const dorarJson = JSON.stringify({ ahadith: { result: fixture } });

describe("searchDorar relay setting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls the relay with the shared key when both settings are present, and still parses Dorar's JSON", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "https://relay.example/");
    vi.stubEnv("DORAR_RELAY_KEY", "secret-key");
    const fetchMock = vi.fn().mockImplementation(async () => new Response(dorarJson));
    vi.stubGlobal("fetch", fetchMock);

    const r = await searchDorar("اطلبوا العلم");

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe(`https://relay.example/dorar?skey=${encodeURIComponent("اطلبوا العلم")}`);
    expect(init.headers).toEqual({ "x-relay-key": "secret-key" });
    expect(r.ok && r.results.length).toBe(15);
  });

  it("goes to dorar.net directly, with our own User-Agent, when no relay is set", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    vi.stubEnv("DORAR_RELAY_KEY", "");
    const fetchMock = vi.fn().mockImplementation(async () => new Response(dorarJson));
    vi.stubGlobal("fetch", fetchMock);

    await searchDorar("x");

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toMatch(/^https:\/\/dorar\.net\/dorar_api\.json\?skey=/);
    expect(init.headers["User-Agent"]).toMatch(/^Tathabbut\//);
  });

  it("does not use a relay URL without its key", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "https://relay.example");
    vi.stubEnv("DORAR_RELAY_KEY", "");
    const fetchMock = vi.fn().mockImplementation(async () => new Response(dorarJson));
    vi.stubGlobal("fetch", fetchMock);

    await searchDorar("x");

    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toMatch(/^https:\/\/dorar\.net\//);
  });

  it("retries a 500 and gives up on a 403", async () => {
    vi.stubEnv("DORAR_RELAY_URL", "");
    vi.stubEnv("DORAR_RELAY_KEY", "");
    vi.useFakeTimers();
    const flaky = vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })).mockResolvedValue(new Response(dorarJson));
    vi.stubGlobal("fetch", flaky);
    const pending = searchDorar("x");
    await vi.runAllTimersAsync();
    expect((await pending).ok).toBe(true);
    expect(flaky).toHaveBeenCalledTimes(2);

    const blocked = vi.fn().mockImplementation(async () => new Response("denied", { status: 403 }));
    vi.stubGlobal("fetch", blocked);
    const r = await searchDorar("y");
    expect(r).toMatchObject({ ok: false, error: "http", detail: "403" });
    expect(blocked).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
