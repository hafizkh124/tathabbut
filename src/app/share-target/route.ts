// The share sheet's fallback (manifest.ts → share_target). Normally public/sw.js answers the POST in the browser and this route
// is never reached; when the service worker is not running yet, the share lands here. The text is passed on in the address
// (the page checks it, src/app/page.tsx); a picture cannot travel that way, so it is dropped and the home screen opens.
import { sharedText } from "@/lib/sharedInput";

export const dynamic = "force-dynamic";

const MAX_TEXT = 5_000; // as in InputPanel; one character over, so the page shows its own "too long" message

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : null;
};

export async function POST(request: Request) {
  let text = "";
  try {
    const form = await request.formData();
    text = sharedText({ title: field(form, "title"), text: field(form, "text"), url: field(form, "url") }).slice(0, MAX_TEXT + 1);
  } catch {
    /* not a form: open the home screen */
  }
  const to = new URL(text ? `/?text=${encodeURIComponent(text)}` : "/", request.url);
  return Response.redirect(to, 303);
}

export function GET(request: Request) {
  return Response.redirect(new URL("/", request.url), 303);
}
