// /r/<id> or /r/<id>-<id>…: results opened from a shared link (src/lib/sharedClaims.ts). The page's title and description
// carry the result, so WhatsApp's preview already says it: «اطلبوا العلم ولو بالصين» — ضعيف جدًّا.
import type { Metadata } from "next";
import { cache } from "react";
import { SharedView } from "@/components/SharedView";
import { stateLabel } from "@/lib/i18n/dict";
import { loadSharedClaims, parseShareIds } from "@/lib/sharedClaims";
import { sourceLine } from "@/lib/shareText";

// one read per request, for both the metadata and the page
const load = cache(async (path: string) => {
  try {
    return await loadSharedClaims(parseShareIds(path));
  } catch {
    return [];
  }
});

const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Tathabbut" };
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function generateMetadata({ params }: PageProps<"/r/[ids]">): Promise<Metadata> {
  const claims = await load((await params).ids);
  const first = claims[0];
  // results people shared are theirs to pass on, not pages for search engines
  const robots = { index: false, follow: true };
  if (!first) return { title: "تَثَبُّت", robots };
  const quote = first.claim.arabicSpan || first.claim.textAsWritten;
  const title = `«${short(quote, 70)}» — ${stateLabel(first.state, "ar", true)}`;
  const more = claims.length > 1 ? ` (+${claims.length - 1})` : "";
  const description = `${sourceLine(first, "ar") ?? "تَثَبُّت"}${more} · تحقّق من النصوص قبل نشرها`;
  return {
    title: `${title} · تَثَبُّت`,
    description,
    robots,
    // the site's own picture (app/opengraph-image.tsx): setting openGraph here would otherwise leave the preview without one
    openGraph: { title, description, type: "article", locale: "ar", siteName: "تَثَبُّت", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

export default async function SharedResult({ params }: PageProps<"/r/[ids]">) {
  const claims = await load((await params).ids);
  return <SharedView claims={claims} />;
}
