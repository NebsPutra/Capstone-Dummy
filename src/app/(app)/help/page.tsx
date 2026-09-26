import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { COMPLAINT_CATEGORIES, STATUS_TONE, type Complaint, type ComplaintCategory } from "@/lib/admin";
import { ComplaintForm } from "@/components/help/ComplaintForm";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; user?: string; category?: string }>;
}) {
  const { event, user: relatedUser, category } = await searchParams;
  const supabase = await createClient();
  const { t, lang } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: complaints }, { data: ev }] = await Promise.all([
    supabase
      .from("complaints")
      .select("id, ref, subject, category, status, created_at, last_activity_at")
      .eq("reporter_id", user!.id)
      .order("last_activity_at", { ascending: false }),
    event
      ? supabase.from("events").select("id, title").eq("id", event).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const date = (ts: string) =>
    new Date(ts).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange/10 text-orange-dark">
          <LifeBuoy size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{t("help.title")}</h1>
          <p className="mt-1 text-ink/60">{t("help.subtitle")}</p>
        </div>
      </div>

      <ComplaintForm
        relatedEvent={ev ?? null}
        relatedUserId={relatedUser ?? null}
        defaultCategory={COMPLAINT_CATEGORIES.includes(category as ComplaintCategory) ? (category as ComplaintCategory) : null}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("help.myComplaints")}</h2>
        {(complaints ?? []).length === 0 ? (
          <p className="text-sm text-ink/50">{t("help.none")}</p>
        ) : (
          (complaints as Pick<Complaint, "id" | "ref" | "subject" | "category" | "status" | "created_at" | "last_activity_at">[]).map((c) => (
            <Link
              key={c.id}
              href={`/help/${c.id}`}
              className="card flex flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink/50">
                  {c.ref} · {t(`complaint.category.${c.category}`)}
                </p>
                <p className="truncate font-medium">{c.subject}</p>
                <p className="text-xs text-ink/50">
                  {t("help.submittedOn", { date: date(c.created_at) })} · {t("help.lastUpdate", { date: date(c.last_activity_at) })}
                </p>
              </div>
              <span className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-medium sm:self-center ${STATUS_TONE[c.status]}`}>
                {t(`complaint.status.${c.status}`)}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
