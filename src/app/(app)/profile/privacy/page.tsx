import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BlockedUsers, PrivacyForm } from "@/components/social/ProfileSettings";

export default async function PrivacyPage() {
  const supabase = await createClient();
  const { t } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/profile" className="inline-flex items-center gap-1 text-sm font-medium text-ink/70 hover:text-orange-dark">
          <ArrowLeft size={16} /> {t("security.backToProfile")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("privacy.title")}</h1>
        <p className="mt-1 text-sm text-ink/70">{t("privacy.subtitle")}</p>
      </div>
      <PrivacyForm userId={user!.id} />
      <BlockedUsers />
    </div>
  );
}
