import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { BUSINESS } from "@/lib/legal/documents";
import { PublicShell } from "@/components/PublicShell";

export const metadata: Metadata = { title: "About · Komunitas" };

// Third-party software, data and fonts shipped with or shown in the app, with
// their licenses. Keep this in sync with package.json and the map/data sources.
const CREDITS: { name: string; license: string; href: string }[] = [
  { name: "OpenStreetMap map data © OpenStreetMap contributors", license: "ODbL 1.0", href: "https://www.openstreetmap.org/copyright" },
  { name: "Leaflet · react-leaflet", license: "BSD-2-Clause · Hippocratic 2.1", href: "https://leafletjs.com" },
  { name: "Plus Jakarta Sans (Tokotype)", license: "SIL Open Font License 1.1", href: "https://fonts.google.com/specimen/Plus+Jakarta+Sans" },
  { name: "Lucide icons", license: "ISC", href: "https://lucide.dev/license" },
  { name: "Indonesian region data (emsifa/api-wilayah-indonesia)", license: "No license stated · attributed", href: "https://github.com/emsifa/api-wilayah-indonesia" },
  { name: "Next.js · React", license: "MIT", href: "https://nextjs.org" },
  { name: "Supabase client libraries", license: "MIT", href: "https://supabase.com" },
  { name: "Tailwind CSS", license: "MIT", href: "https://tailwindcss.com" },
  { name: "Recharts · html-to-image", license: "MIT", href: "https://github.com/recharts/recharts" },
  { name: "qrcode.react", license: "ISC", href: "https://github.com/zpao/qrcode.react" },
];

export default async function AboutPage() {
  const { t } = await getServerT();
  const rows: [string, React.ReactNode][] = [
    [t("about.operator"), `${BUSINESS.operator} · ${BUSINESS.institution}`],
    [
      t("about.email"),
      <a key="e" href={`mailto:${BUSINESS.email}`} className="font-semibold text-orange-dark underline">
        {BUSINESS.email}
      </a>,
    ],
    [t("about.website"), BUSINESS.site.replace("https://", "")],
    [t("about.country"), BUSINESS.country],
  ];

  return (
    <PublicShell>
      <article className="card space-y-8 p-6 md:p-10">
        <header>
          <h1 className="text-3xl font-bold">{t("about.title")}</h1>
          <p className="mt-2 text-ink/75">{t("about.intro")}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("about.whoTitle")}</h2>
          <p className="text-sm leading-relaxed text-ink/80">{t("about.who")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("about.contactTitle")}</h2>
          <p className="text-sm leading-relaxed text-ink/80">{t("about.contactBody")}</p>
          <dl className="grid grid-cols-1 gap-3 rounded-xl bg-cream-warm p-4 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-ink/65">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("about.creditsTitle")}</h2>
          <p className="text-sm text-ink/80">{t("about.creditsIntro")}</p>
          <ul className="divide-y divide-ink/10 text-sm">
            {CREDITS.map((c) => (
              <li key={c.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <a href={c.href} target="_blank" rel="noreferrer" className="font-medium hover:text-orange-dark hover:underline">
                  {c.name}
                </a>
                <span className="text-ink/65">{c.license}</span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </PublicShell>
  );
}
