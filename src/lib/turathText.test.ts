import { describe, expect, it } from "vitest";
import { cleanTurathText, findClosest, findPhrase } from "./turathText";

describe("cleanTurathText", () => {
  it("decodes the entities seen in Turath's text", () => {
    expect(cleanTurathText("قال: &quot;قيمة كل رجل&quot; &amp; &#1575; &#x627;")).toBe('قال: "قيمة كل رجل" & ا ا');
  });

  it("removes tags first, so an escaped «<» stays text", () => {
    expect(cleanTurathText("<span class='x'>نص</span> &lt;b&gt;")).toBe("نص <b>");
  });

  it("leaves an unknown entity and a bad code as they are", () => {
    expect(cleanTurathText("&foo; &#99999999;")).toBe("&foo; &#99999999;");
  });
});

describe("findPhrase", () => {
  const text = "قَالَ عَلِيٌّ: «قِيمَةُ كُلِّ امْرِئٍ مَا يُحْسِنُهُ» وَهَذَا قَوْلٌ مَشْهُورٌ";

  it("finds the phrase through diacritics and punctuation and returns its exact range", () => {
    const r = findPhrase(text, "قيمة كل امرئ ما يحسنه");
    expect(r).not.toBeNull();
    expect(text.slice(r![0], r![1]).replace(/[«»]/g, "")).toBe("قِيمَةُ كُلِّ امْرِئٍ مَا يُحْسِنُهُ");
  });

  it("is null when the phrase is not there whole, or empty", () => {
    expect(findPhrase(text, "قيمة كل رجل ما يحسنه")).toBeNull();
    expect(findPhrase(text, "")).toBeNull();
    expect(findPhrase("", "قيمة")).toBeNull();
  });
});

describe("findClosest", () => {
  it("prefers the whole phrase", () => {
    const text = "وقال: قِيمَةُ كُلِّ امْرِئٍ مَا يُحْسِنُهُ.";
    expect(findClosest(text, "قيمة كل امرئ ما يحسنه")).toEqual(findPhrase(text, "قيمة كل امرئ ما يحسنه"));
  });

  it("marks the stretch that holds most of the words when the wording differs", () => {
    const text = "باب فضل العلم. حدثنا فلان عن أنس قال: اطلبوا العلم ولو كان بالصين فإن طلبه فريضة. وفي الباب عن غيره.";
    const r = findClosest(text, "اطلبوا العلم ولو بالصين")!;
    expect(text.slice(r[0], r[1])).toBe("اطلبوا العلم ولو كان بالصين");
  });

  it("does not mark a passage that shares only a word or two of little words", () => {
    expect(findClosest("قال في الباب من حديث آخر", "من قال في الصمت حكمة")).toBeNull();
  });
});
