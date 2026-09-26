import { getServerT } from "@/lib/i18n/server";
import { ActivityForm } from "@/components/ActivityForm";

export default async function CreateActivityPage() {
  const { t } = await getServerT();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("create.title")}</h1>
        <p className="mt-1 text-ink/60">{t("create.subtitle")}</p>
      </div>
      <ActivityForm />
    </div>
  );
}
