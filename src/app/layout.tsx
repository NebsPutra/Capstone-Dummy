import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { getServerLang } from "@/lib/i18n/server";
import { ThemeProvider } from "@/lib/theme";
import { THEME_BOOT_SCRIPT, THEME_COOKIE, isThemePref } from "@/lib/theme-shared";
import { ToastProvider } from "@/components/Toast";
import { CookieNotice } from "@/components/CookieNotice";
import { SITE_URL } from "@/lib/site";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const DESCRIPTION =
  "Discover and create social activities around you based on your interests and location. " +
  "Temukan dan buat aktivitas sosial di sekitarmu.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Komunitas | Find Activities. Meet People. Build Community.",
  description: DESCRIPTION,
  applicationName: "Komunitas",
  keywords: [
    "Komunitas", "local activities", "community events", "group run", "book club", "badminton",
    "cycling", "aktivitas sosial", "komunitas lari", "klub buku", "cari teman olahraga", "acara komunitas",
  ],
  openGraph: {
    type: "website",
    siteName: "Komunitas",
    url: "/",
    title: "Komunitas | Find Activities. Meet People. Build Community.",
    description: DESCRIPTION,
    locale: "id_ID",
    alternateLocale: ["en_US"],
  },
  twitter: { card: "summary_large_image" },
  // Google Search Console ownership check (HTML tag method). Set the env var in Vercel.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8ED" },
    { media: "(prefers-color-scheme: dark)", color: "#171310" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getServerLang();
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const themePref = isThemePref(saved) ? saved : "system";

  return (
    // The boot script sets the `dark` class before paint; React may see a
    // different class than the server rendered, which is expected.
    <html lang={lang} className={`${plusJakarta.variable} ${themePref === "dark" ? "dark" : ""}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider initialPref={themePref}>
          <LanguageProvider initialLang={lang}>
            <ToastProvider>
              {children}
              <CookieNotice />
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
