import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { getServerLang } from "@/lib/i18n/server";
import { ThemeProvider } from "@/lib/theme";
import { THEME_BOOT_SCRIPT, THEME_COOKIE, isThemePref } from "@/lib/theme-shared";
import { ToastProvider } from "@/components/Toast";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Komunitas — Find Activities. Meet People. Build Community.",
  description: "Discover and create social activities around you based on your interests and location.",
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
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
