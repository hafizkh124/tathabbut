import { describe, expect, it } from "vitest";
import { MIN_TOKEN_LENGTH, noteFailure, tokenMatches, tooManyFailures } from "./adminAuth";

const secret = "s".repeat(MIN_TOKEN_LENGTH);

describe("tokenMatches", () => {
  it("accepts the exact bearer token", () => {
    expect(tokenMatches(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("refuses a missing, wrong or differently shaped header", () => {
    expect(tokenMatches(null, secret)).toBe(false);
    expect(tokenMatches("Bearer nope", secret)).toBe(false);
    expect(tokenMatches(secret, secret)).toBe(false);
    expect(tokenMatches(`Bearer ${secret} `, secret)).toBe(false);
  });
  it("is closed when no secret is set or the secret is too short", () => {
    expect(tokenMatches("Bearer ", undefined)).toBe(false);
    expect(tokenMatches("Bearer abc", "abc")).toBe(false);
    expect(tokenMatches("Bearer ", "")).toBe(false);
  });
});

describe("failure limit", () => {
  it("blocks an address after repeated wrong tries and forgets them after a minute", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 8; i++) noteFailure("1.2.3.4", t0 + i);
    expect(tooManyFailures("1.2.3.4", t0 + 10)).toBe(true);
    expect(tooManyFailures("5.6.7.8", t0 + 10)).toBe(false);
    expect(tooManyFailures("1.2.3.4", t0 + 61_000)).toBe(false);
  });
});
