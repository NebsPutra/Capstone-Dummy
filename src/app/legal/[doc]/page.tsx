import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { BUSINESS, LEGAL, LEGAL_DOCS, LEGAL_UPDATED, type LegalDocKey } from "@/lib/legal/documents";
import { PublicShell } from "@/components/PublicShell";

const isDoc = (d: string): d is LegalDocKey => (LEGAL_DOCS as readonly string[]).includes(d);

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const { lang } = await getServerT();
  return { title: `${LEGAL[lang][doc].title} · Komunitas`, description: LEGAL[lang][doc].summary };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const { t, lang } = await getServerT();
  const d = LEGAL[lang][doc];
  const updated = new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <PublicShell>
      <article className="card space-y-6 p-6 md:p-10">
        <header>
          <h1 className="text-3xl font-bold">{d.title}</h1>
          <p className="mt-2 text-ink/70">{d.summary}</p>
          <p className="mt-2 text-xs text-ink/65">{t("legal.updated", { date: updated })}</p>
        </header>
        {d.sections.map((s) => (
          <section key={s.heading} className="space-y-2">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            {s.body.map((b, i) =>
              Array.isArray(b) ? (
                <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/80">
                  {b.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i} className="text-sm leading-relaxed text-ink/80">
                  {b}
                </p>
              )
            )}
          </section>
        ))}
        <p className="border-t border-ink/10 pt-4 text-sm text-ink/70">
          {t("legal.questions")}{" "}
          <a href={`mailto:${BUSINESS.email}`} className="font-semibold text-orange-dark underline">
            {BUSINESS.email}
          </a>
        </p>
      </article>
      <nav aria-label={t("legal.onThisPage")} className="mt-6 flex flex-wrap gap-2">
        {LEGAL_DOCS.filter((k) => k !== doc).map((k) => (
          <Link key={k} href={`/legal/${k}`} className="rounded-full border border-ink/10 bg-surface px-4 py-2 text-sm font-medium hover:bg-cream-warm">
            {LEGAL[lang][k].title}
          </Link>
        ))}
      </nav>
    </PublicShell>
  );
}
