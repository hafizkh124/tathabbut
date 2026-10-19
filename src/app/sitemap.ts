// /sitemap.xml: the one page there is to index (the checks happen on it; shared results are not listed).
import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/shareText";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: APP_URL, changeFrequency: "weekly", priority: 1 }];
}
