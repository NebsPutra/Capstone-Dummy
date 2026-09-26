import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { getServerLang } from "@/lib/i18n/server";
import { ToastProvider } from "@/components/Toast";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Komunitas — Find Activities. Meet People. Build Community.",
  description:
    "Discover and create social activities around you based on your interests and location.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getServerLang();
  return (
    <html lang={lang} className={plusJakarta.variable}>
      <body className="font-sans antialiased">
        <LanguageProvider initialLang={lang}>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
