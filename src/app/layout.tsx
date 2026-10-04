import type { Metadata, Viewport } from "next";
import { Amiri, Noto_Nastaliq_Urdu, Readex_Pro } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/i18n";
import "./globals.css";

// UI (Arabic, English): Readex Pro, the same family the challenge's own site uses.
const readex = Readex_Pro({ variable: "--font-readex", subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"] });
// The words of the Quran and hadith.
const amiri = Amiri({ variable: "--font-amiri", subsets: ["arabic", "latin"], weight: ["400", "700"] });
// Urdu interface: Readex Pro lacks some Urdu letters, so Urdu is set in Nastaliq.
const nastaliq = Noto_Nastaliq_Urdu({ variable: "--font-nastaliq", subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "تَثَبُّت",
  description: "﴿فَتَثَبَّتُوا﴾ (قراءة حمزة والكسائي وخلف) — ذكاء اصطناعي ينقل من مصادر إسلامية معتبرة للتحقق من الآيات والأحاديث والأقوال المتداولة.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b3d3a" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1716" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${amiri.variable} ${nastaliq.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
