import { describe, expect, it } from "vitest";
import { createTrace } from "./trace";

const clock = () => {
  let t = 1_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("trace", () => {
  it("adds up the time of a stage and gives back the result", async () => {
    const c = clock();
    const tr = createTrace(c.now);
    const v = await tr.time("extract", async () => (c.advance(1_200), "claims"));
    await tr.time("extract", async () => c.advance(300));
    expect(v).toBe("claims");
    expect(tr.summary().stages).toEqual({ extract: 1_500 });
  });

  it("times a stage that throws, and rethrows", async () => {
    const c = clock();
    const tr = createTrace(c.now);
    await expect(tr.time("verify", async () => (c.advance(700), Promise.reject(new Error("x"))))).rejects.toThrow("x");
    expect(tr.summary().stages.verify).toBe(700);
  });

  it("counts each outside call by name, with its total and its slowest", async () => {
    const c = clock();
    const tr = createTrace(c.now);
    const deps = tr.wrap({
      lookupDorar: async (q: string) => (c.advance(q === "slow" ? 6_000 : 800), q.length),
      matchVerses: async () => (c.advance(200), []),
      missing: undefined,
    });
    expect(await deps.lookupDorar?.("fast")).toBe(4);
    await deps.lookupDorar?.("slow");
    await deps.matchVerses?.();
    expect(tr.summary().calls).toEqual({ lookupDorar: [2, 6_800, 6_000], matchVerses: [1, 200, 200] });
    expect("missing" in deps).toBe(false); // only the functions that exist are carried over
  });

  it("times a call that rejects and lets the error through", async () => {
    const c = clock();
    const tr = createTrace(c.now);
    const deps = tr.wrap({ lookupDorar: async () => (c.advance(400), Promise.reject(new Error("down"))) });
    await expect(deps.lookupDorar?.()).rejects.toThrow("down");
    expect(tr.summary().calls.lookupDorar).toEqual([1, 400, 400]);
  });
});
