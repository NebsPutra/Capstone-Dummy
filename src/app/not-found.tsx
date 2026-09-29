import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function NotFound() {
  const { t } = await getServerT();
  // Dashboard and help need a session; send signed-out visitors to the landing page instead.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="ambient-gradient flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="card max-w-md space-y-3 p-8 text-center">
        <p className="text-4xl">🔍</p>
        <h1 className="text-xl font-bold">{t("notFound.title")}</h1>
        <p className="text-sm text-ink/70">{t("notFound.desc")}</p>
        <Link
          href={user ? "/dashboard" : "/"}
          className="inline-block rounded-full bg-orange-deep px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-deeper"
        >
          {user ? t("notFound.home") : t("notFound.landing")}
        </Link>
        {user && (
          <Link href="/help" className="block text-sm font-medium text-ink/65 hover:text-orange-dark">
            {t("help.needHelp")}
          </Link>
        )}
      </div>
    </main>
  );
}
