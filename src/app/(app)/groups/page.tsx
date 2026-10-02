import { getServerT } from "@/lib/i18n/server";
import { Groups } from "@/components/Groups";

export default async function GroupsPage() {
  const { t } = await getServerT();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("groups.title")}</h1>
        <p className="mt-1 text-ink/70">{t("groups.subtitle")}</p>
      </div>
      <Groups />
    </div>
  );
}
