// /robots.txt: the site is open to search engines except the API and the share sheet's landing. Shared results (/r/…, each
// one person's check) stay crawlable so link previews (WhatsApp and the like) can read them; their own noindex keeps
// them out of search results.
import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/shareText";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/share-target"] },
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
