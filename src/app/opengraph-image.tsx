// The picture shown when the link is shared (WhatsApp, Telegram, the challenge platform). The mark is the same as
// icon.svg. Arabic text is left out on purpose: the image renderer does not shape Arabic, and a broken word is worse
// than none; the Arabic title and description travel in the page's text tags.
import { ImageResponse } from "next/og";

export const alt = "Tathabbut — verify Islamic texts and quotes in seconds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0B3D3A", color: "#F6F1E4" }}>
        <svg width="190" height="190" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="16" fill="#12504C" />
          <circle cx="26" cy="19" r="4.2" fill="#C8A24A" />
          <circle cx="38" cy="19" r="4.2" fill="#C8A24A" />
          <path d="M15 36 L28 48 L49 27" fill="none" stroke="#C8A24A" strokeWidth="6.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex", marginTop: 36, fontSize: 108, fontWeight: 700, letterSpacing: 2 }}>Tathabbut</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 40, color: "#C8A24A" }}>Verify Islamic texts and quotes in seconds</div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 28, opacity: 0.75 }}>Quran · Hadith · Circulating sayings · AR / EN / UR</div>
      </div>
    ),
    { ...size },
  );
}
