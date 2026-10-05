import { describe, expect, it } from "vitest";
import { isDorarAddition, sahihAttribution } from "./sahihAttribution";

describe("specialist-approved Sahihayn attribution", () => {
  it.each([
    ["صحيح البخاري", "البخاري", "امام بخاری نے اپنی صحیح میں روایت کیا ہے۔"],
    ["صحيح مسلم", "مسلم", "امام مسلم نے اپنی صحیح میں روایت کیا ہے۔"],
  ])("attributes inclusion in %s, not a spoken grading", (source, muhaddith, wording) => {
    expect(sahihAttribution({ source, muhaddith }, "ur")).toBe(wording);
    expect(sahihAttribution({ source, muhaddith }, "ar")).toContain("في صحيحه");
    expect(sahihAttribution({ source, muhaddith }, "en")).toContain("in his Sahih");
  });
  it("preserves another scholar's judgement and does not treat commentary as the Sahih itself", () => {
    expect(sahihAttribution({ source: "صحيح البخاري", muhaddith: "ابن حجر" }, "ur")).toBeNull();
    expect(sahihAttribution({ source: "شرح صحيح مسلم", muhaddith: "مسلم" }, "ur")).toBeNull();
    expect(sahihAttribution({}, "ur")).toBeNull();
  });
  it("identifies an entire bracketed addition without labelling mixed scholarly wording as one", () => {
    expect(isDorarAddition("[صحيح]")).toBe(true);
    expect(isDorarAddition("خطأ [في إسناده]")).toBe(false);
  });
});
