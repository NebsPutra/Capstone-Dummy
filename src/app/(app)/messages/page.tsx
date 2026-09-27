import { getServerT } from "@/lib/i18n/server";
import { MessagesInbox } from "@/components/messages/Messages";

export default async function MessagesPage() {
  const { t } = await getServerT();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("messages.title")}</h1>
        <p className="mt-1 text-sm text-ink/60">{t("messages.subtitle")}</p>
      </div>
      <MessagesInbox />
    </div>
  );
}
