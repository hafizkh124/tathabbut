// The web app manifest: Tathabbut can be installed on a phone like an app, and once installed it appears in the share sheet,
// so a message or screenshot from WhatsApp goes straight to it (share_target; public/sw.js receives it, share-target/route.ts
// is the fallback). The same manifest is what the Play Store wrapper (a Trusted Web Activity) is built from.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "تَثَبُّت · Tathabbut",
    short_name: "تَثَبُّت",
    description: "تحقّق فوري من الأحاديث والآيات المتداولة: مصدرها وحكمها، منسوباً إلى قائله — من العلماء.",
    lang: "ar",
    dir: "rtl",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B3D3A",
    theme_color: "#0c3b38",
    categories: ["education", "books", "reference"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "image", accept: ["image/jpeg", "image/png", "image/webp", "image/*"] }],
      },
    },
  };
}
