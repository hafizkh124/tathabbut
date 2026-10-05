import { describe, expect, it } from "vitest";
import { quranpediaUrl, shamelaPageUrl, splitReferenceUrl } from "./viaLinks";

describe("via links", () => {
  it("opens the verse's own page on quranpedia", () => {
    expect(quranpediaUrl(2, 153)).toBe("https://quranpedia.net/surah/1/2/153");
  });

  it("opens the same book page on Shamela as on Turath", () => {
    expect(shamelaPageUrl("2677", 7128)).toBe("https://shamela.ws/book/2677/7128");
  });

  it("moves a reference's web address to «Via» and names the site", () => {
    const r = splitReferenceUrl("حافظ خضر حیات، «باحوالہ لیکن غیر مستند اقوال»، موقع العلماء، 26 يوليو 2023، https://alulama.org/ba-hawalh-lekin-gher-mustanad-aqwal/");
    expect(r.url).toBe("https://alulama.org/ba-hawalh-lekin-gher-mustanad-aqwal/");
    expect(r.site).toBe("via.alulama");
    expect(r.text).toBe("حافظ خضر حیات، «باحوالہ لیکن غیر مستند اقوال»، موقع العلماء، 26 يوليو 2023");
  });

  it("leaves a reference without an address as it is", () => {
    expect(splitReferenceUrl("الموضوعات للصغاني، 52")).toEqual({ text: "الموضوعات للصغاني، 52" });
  });
});
