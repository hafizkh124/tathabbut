import type { Metadata, Viewport } from "next";
import { Amiri, Noto_Nastaliq_Urdu, Readex_Pro } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/i18n";
import { APP_URL } from "@/lib/shareText";
import "./globals.css";

// UI (Arabic, English): Readex Pro, the same family the challenge's own site uses.
const readex = Readex_Pro({ variable: "--font-readex", subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"] });
// The words of the Quran and hadith.
const amiri = Amiri({ variable: "--font-amiri", subsets: ["arabic", "latin"], weight: ["400", "700"] });
// Urdu interface: Readex Pro lacks some Urdu letters, so Urdu is set in Nastaliq.
const nastaliq = Noto_Nastaliq_Urdu({ variable: "--font-nastaliq", subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"] });

const DESCRIPTION = "ذكاء اصطناعي ينقل من مصادر إسلامية معتبرة للتحقق من الآيات والأحاديث والأقوال المتداولة.";

/** What a search engine shows as the page's name: the brand, then what it does, in the three languages people search in. */
const TITLE = "تَثَبُّت · Tathabbut — تحقّق من الأحاديث والآيات المتداولة";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: TITLE, template: "%s · تَثَبُّت" },
  description: DESCRIPTION,
  applicationName: "تَثَبُّت · Tathabbut",
  keywords: ["تحقق من الحديث", "صحة الحديث", "حديث ضعيف", "حديث موضوع", "الدرر السنية", "تخريج الأحاديث", "حدیث کی تحقیق", "کیا یہ حدیث صحیح ہے", "ضعیف حدیث", "hadith checker", "is this hadith authentic", "fake hadith", "Quran verse check"],
  authors: [{ name: "العلماء · Alulama", url: "https://alulama.org" }],
  publisher: "العلماء · Alulama",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  // Search Console (URL-prefix property for tathabbut.alulama.org): the meta tag it asks for, so no DNS record is needed
  verification: { google: "p9_hDF2g1MJKo5eURagOSF1MCNsyN0HGJZpec8dZSQE" },
  openGraph: { title: "تَثَبُّت · Tathabbut", description: DESCRIPTION, type: "website", locale: "ar", siteName: "تَثَبُّت" },
  twitter: { card: "summary_large_image", title: "تَثَبُّت · Tathabbut", description: DESCRIPTION },
  // the tab and search results: app/favicon.ico (the brand mark at 16-48 px; Google wants a multiple of 48) is linked by
  // Next itself; the SVG keeps tabs sharp. Installed on an iPhone (Share → Add to Home Screen), iOS reads the apple icon.
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "تَثَبُّت", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c3b38" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1716" },
  ],
};

/** For search engines: what the site is (a free web app) and who publishes it. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "تَثَبُّت · Tathabbut",
  url: APP_URL,
  description: DESCRIPTION,
  applicationCategory: "ReferenceApplication",
  operatingSystem: "Web, Android, iOS",
  inLanguage: ["ar", "ur", "en"],
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: "العلماء · Alulama", url: "https://alulama.org" },
};

/** Runs before the first paint: the theme the person chose (kept on this device), or else the device's own, so the page never
 *  flashes the other one. ThemeToggle (Header.tsx) changes it afterwards. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("tathabbut.theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${amiri.variable} ${nastaliq.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
