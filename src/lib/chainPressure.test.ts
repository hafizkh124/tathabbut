import { describe, expect, it } from "vitest";
import { hasPressure, stripPressure } from "./chainPressure";

describe("hasPressure", () => {
  it.each([
    "اس پیغام کو دس لوگوں کو بھیجیں: صفائی نصف ایمان ہے",
    "یہ پیغام دس لوگوں کو بھیجو، جنت ملے گی۔",
    "صيام يوم 27 رجب يعدل صيام ستين شهرا. انشرها ولك الأجر",
    "قال ﷺ: ... أمانة في رقبتك",
    "اسے آگے شیئر کریں",
    "کم از کم 10 لوگوں کو فارورڈ کریں",
    "Please share this with everyone",
    "send this to 10 people or bad luck",
  ])("finds the request in %s", (t) => expect(hasPressure(t)).toBe(true));

  it.each([
    "من نشرها دخل الجنة",
    "جو اس کو آگے بھیجے گا اس کے لیے جنت ہے",
    "إنما الأعمال بالنيات",
    "نبی ﷺ نے فرمایا: صفائی نصف ایمان ہے",
    "نشر العلم صدقة",
    "How to share the knowledge of the Quran",
  ])("leaves a claim or a promise alone: %s", (t) => expect(hasPressure(t)).toBe(false));
});

describe("stripPressure", () => {
  it("removes a leading request and the separator that held it", () => {
    expect(stripPressure("اس پیغام کو دس لوگوں کو بھیجیں: صفائی نصف ایمان ہے")).toBe("صفائی نصف ایمان ہے");
    expect(stripPressure("یہ پیغام دس لوگوں کو بھیجو، جنت ملے گی")).toBe("جنت ملے گی");
  });

  it("removes a trailing request", () => {
    expect(stripPressure("صيام يوم 27 رجب يعدل صيام ستين شهرا. انشرها ولك الأجر، أمانة في رقبتك")).toBe("صيام يوم 27 رجب يعدل صيام ستين شهرا.");
  });

  it("is empty when the text is nothing but the request", () => {
    expect(stripPressure("اس پیغام کو آگے شیئر کریں")).toBe("");
    expect(stripPressure("انشرها ولك الأجر")).toBe("");
  });

  it("leaves a text without a request as it is", () => {
    expect(stripPressure("  إنما الأعمال بالنيات ")).toBe("إنما الأعمال بالنيات");
    expect(stripPressure("من نشرها دخل الجنة")).toBe("من نشرها دخل الجنة");
  });

  it("keeps what is on both sides of a request in the middle", () => {
    expect(stripPressure("الطهور شطر الإيمان انشرها ولك الأجر والحمد لله تملأ الميزان")).toBe("الطهور شطر الإيمان والحمد لله تملأ الميزان");
  });
});
