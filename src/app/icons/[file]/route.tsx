// The app's icons for the install prompt, the home screen and the Play Store wrapper (manifest.ts), drawn from the same mark
// as icon.svg. Built once at build time, so no binary files in the repository.
// "maskable": Android crops the icon to its own shape (circle, squircle…), so the mark sits inside the middle 60% on a full
// teal square; "icon": the rounded square as it is; "apple": iOS adds its own corners, so a full square with no transparency.
import { ImageResponse } from "next/og";

const FILES = {
  "icon-192.png": { size: 192, kind: "icon" },
  "icon-512.png": { size: 512, kind: "icon" },
  "maskable-192.png": { size: 192, kind: "maskable" },
  "maskable-512.png": { size: 512, kind: "maskable" },
  "apple-touch-icon.png": { size: 180, kind: "apple" },
} as const;

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(FILES).map((file) => ({ file }));

export async function GET(_: Request, { params }: RouteContext<"/icons/[file]">) {
  const { file } = await params;
  const icon = FILES[file as keyof typeof FILES];
  if (!icon) return new Response("Not found", { status: 404 });
  const { size, kind } = icon;
  const mark = kind === "icon" ? size : Math.round(size * (kind === "maskable" ? 0.6 : 0.78));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: kind === "icon" ? "transparent" : "#0B3D3A" }}>
        <svg width={mark} height={mark} viewBox="0 0 64 64">
          {kind === "icon" && <rect width="64" height="64" rx="16" fill="#0B3D3A" />}
          <circle cx="26" cy="19" r="4.2" fill="#C8A24A" />
          <circle cx="38" cy="19" r="4.2" fill="#C8A24A" />
          <path d="M15 36 L28 48 L49 27" fill="none" stroke="#C8A24A" strokeWidth="6.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
