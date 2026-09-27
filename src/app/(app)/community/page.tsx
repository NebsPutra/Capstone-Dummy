import { getServerT } from "@/lib/i18n/server";
import { CommunityHub } from "@/components/social/People";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("community.title")}</h1>
        <p className="mt-1 text-ink/60">{t("social.hubSubtitle")}</p>
      </div>
      <CommunityHub initialTab={tab} />
    </div>
  );
}
