import { getServerT } from "@/lib/i18n/server";
import { ActivityForm } from "@/components/ActivityForm";

export default async function CreateActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; title?: string; category?: string; group?: string }>;
}) {
  const { t } = await getServerT();
  // From "Find players" (/create?request=<id>&title=…&category=<id>) or a group page (/create?group=<id>).
  const { request, title, category, group } = await searchParams;
  const fromRequest = request ? { id: request, title: title ?? "", categoryId: category ?? "" } : undefined;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("create.title")}</h1>
        <p className="mt-1 text-ink/70">{t("create.subtitle")}</p>
      </div>
      <ActivityForm fromRequest={fromRequest} groupId={group} />
    </div>
  );
}
