import { describe, expect, it } from "vitest";
import { similarNarrations } from "./similarExpressions";

describe("similar expressions", () => {
  it("returns retrieved text and its own verdict, rejecting unrelated and duplicate results", () => {
    const query = "من صلى ركعتين في ليلة من رجب كتب له حسنات مائة سنة";
    const matn = "من صلى في ليلة من رجب اثنتي عشرة ركعة كتب له حسنات مائة سنة";
    const r = { matn, rank: 1, source: "تبيين العجب", reference: "43", verdict: "إسناده ضعيف" };
    const similar = similarNarrations(query, [r, { ...r, rank: 2 }, { ...r, matn: "إنما الأعمال بالنيات" }]);
    expect(similar).toHaveLength(1);
    expect(similar[0]).toMatchObject({ text: matn, state: "ضعيف", reference: "43", scope: "isnad" });
  });
});
