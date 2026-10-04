import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractClaims, type Claim } from "@/lib/claims";
import type { TurathLookupOutcome } from "@/lib/hadithMatch";
import { lookupTurath } from "@/lib/turath";
import { STATES } from "@/lib/verify";
import { POST } from "./route";

vi.mock("@/lib/claims", () => ({ extractClaims: vi.fn() }));
vi.mock("@/lib/dorarCache", () => ({ supabaseDorarCache: vi.fn(() => ({})) }));
vi.mock("@/lib/lookup", () => ({ lookupDorar: vi.fn(async () => ({ ok: true, results: [], origin: "live" })) }));
vi.mock("@/lib/quranCheck", () => ({ matchVerses: vi.fn(async () => []) }));
vi.mock("@/lib/sayingsMatch", () => ({ matchSayings: vi.fn(async () => []) }));
vi.mock("@/lib/turath", () => ({ lookupTurath: vi.fn() }));

const hadithClaim: Claim = {
  kind: "hadith",
  textAsWritten: "حديث تجريبي",
  spanCheck: "exact",
  arabicSpan: "حديث تجريبي",
  query: "حديث تجريبي",
  queryIsTranslation: false,
  language: "ar",
  attributedTo: null,
  citedSource: null,
  warnings: [],
};

const outcomes: Array<{ label: string; outcome: TurathLookupOutcome }> = [
  { label: "passages", outcome: { status: "success", references: [{
    excerpt: "نص من مصدر تراث",
    citation: "كتاب العلل، ص 12",
    book: { id: "42", title: "كتاب العلل" },
    bookId: "42",
    pageLocator: { internalPage: 6, printedPage: 12 },
    url: "https://app.turath.io/book/42/6",
  }] } },
  { label: "no hits", outcome: { status: "success", references: [] } },
  { label: "unavailable", outcome: { status: "unavailable", references: [] } },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(extractClaims).mockResolvedValue({ claims: [hadithClaim], dropped: [], model: "test", ms: 1 });
});

describe("POST /api/verify — Turath response", () => {
  it.each(outcomes)("passes through the $label lookup result separately from the verification state", async ({ outcome }) => {
    vi.mocked(lookupTurath).mockResolvedValue(outcome);
    const response = await POST(new Request("http://localhost/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "حديث تجريبي" }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as { claims: Array<{ state: string; basis: string; turath?: TurathLookupOutcome }> };
    expect(body.claims[0]).toMatchObject({ state: STATES.notFound, basis: "none", turath: outcome });
    expect(vi.mocked(lookupTurath)).toHaveBeenCalledOnce();
    expect(vi.mocked(lookupTurath)).toHaveBeenCalledWith(hadithClaim.query);
  });
});
