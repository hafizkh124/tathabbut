// Tathabbut's service worker. One job: receive what another app shares to Tathabbut (manifest.ts → share_target) and hand it
// to the page. The share arrives as a POST to /share-target; the text and the picture are kept in a cache and the page is
// opened at /?shared=1, where it reads them and checks them straight away (src/app/page.tsx). Nothing else is cached or
// intercepted: every check needs the sources online anyway.
// The cache name and keys are the same as in src/lib/sharedInput.ts.
const SHARE_CACHE = "tathabbut-share";
const SHARED_TEXT_KEY = "/__shared/text";
const SHARED_IMAGE_KEY = "/__shared/image";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin || url.pathname !== "/share-target") return;
  event.respondWith(receiveShare(event.request));
});

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    await cache.delete(SHARED_TEXT_KEY);
    await cache.delete(SHARED_IMAGE_KEY);
    const field = (name) => (typeof form.get(name) === "string" ? form.get(name) : "");
    const fields = { title: field("title"), text: field("text"), url: field("url") };
    await cache.put(SHARED_TEXT_KEY, new Response(JSON.stringify(fields), { headers: { "Content-Type": "application/json" } }));
    const image = form.getAll("image").find((f) => typeof f !== "string" && f.type.startsWith("image/"));
    if (image) await cache.put(SHARED_IMAGE_KEY, new Response(image, { headers: { "Content-Type": image.type } }));
  } catch {
    // an unreadable share opens the empty home screen
    return Response.redirect("/", 303);
  }
  return Response.redirect("/?shared=1", 303);
}
