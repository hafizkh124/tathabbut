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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0C3B38", color: "#F6F1E4" }}>
        <svg width="190" height="190" viewBox="0 0 128 128">
          <rect x="6" y="6" width="116" height="116" rx="30" fill="#114E49" />
          <line x1="34" y1="88" x2="94" y2="88" stroke="#EBD08A" strokeWidth="2.5" opacity="0.3" strokeLinecap="round" />
          <circle cx="34" cy="88" r="2.6" fill="#EBD08A" opacity="0.5" />
          <path d="M34 62 C42 48 51 48 57 59 C62 49 69 49 76 58 L100 30" fill="none" stroke="#C7A24A" strokeWidth="11.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex", marginTop: 36, fontSize: 108, fontWeight: 700, letterSpacing: 2 }}>Tathabbut</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 40, color: "#C7A24A" }}>Verify Islamic texts and quotes in seconds</div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 28, opacity: 0.75 }}>Quran · Hadith · Circulating sayings · AR / EN / UR</div>
      </div>
    ),
    { ...size },
  );
}
