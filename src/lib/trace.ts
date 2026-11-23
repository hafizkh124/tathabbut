// Where the time of one check goes. A stage (the cache read, the rate-limit call, the AI, the verification) and every
// outside call inside the verification (Dorar, each Supabase search) is timed, so a slow check can be taken apart in the
// usage figures instead of guessed at (2026-11-23: a first guess put 17 s on Dorar, and the next measurement showed the
// same slow checks had Dorar answering from its cache in under a second). Counts and milliseconds only, nothing else.

export interface Trace {
  /** Runs `fn`, adds its time to the stage `name`, and gives back its result (or its error, after timing it). */
  time<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /** The same functions, each timed under its own name as a call of the verification. */
  wrap<D extends Record<string, ((...args: never[]) => Promise<unknown>) | undefined>>(deps: D): D;
  /** `{ stages: { cache, limit, extract, verify }, calls: { lookupDorar: [count, totalMs, slowestMs] } }` */
  summary(): { stages: Record<string, number>; calls: Record<string, [number, number, number]> };
}

export function createTrace(now: () => number = Date.now): Trace {
  const stages: Record<string, number> = {};
  const calls: Record<string, [number, number, number]> = {};
  const record = (name: string, ms: number, into: "stage" | "call") => {
    if (into === "stage") stages[name] = (stages[name] ?? 0) + ms;
    else {
      const c = (calls[name] ??= [0, 0, 0]);
      c[0] += 1;
      c[1] += ms;
      c[2] = Math.max(c[2], ms);
    }
  };
  return {
    async time(name, fn) {
      const start = now();
      try {
        return await fn();
      } finally {
        record(name, now() - start, "stage");
      }
    },
    wrap(deps) {
      const out: Record<string, unknown> = {};
      for (const [name, fn] of Object.entries(deps)) {
        if (typeof fn !== "function") continue;
        out[name] = async (...args: never[]) => {
          const start = now();
          try {
            return await (fn as (...a: never[]) => Promise<unknown>)(...args);
          } finally {
            record(name, now() - start, "call");
          }
        };
      }
      return out as typeof deps;
    },
    summary: () => ({ stages: { ...stages }, calls: Object.fromEntries(Object.entries(calls).map(([k, v]) => [k, [...v] as [number, number, number]])) }),
  };
}
