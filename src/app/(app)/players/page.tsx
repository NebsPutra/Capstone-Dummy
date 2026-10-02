import { getServerT } from "@/lib/i18n/server";
import { PlayRequests } from "@/components/PlayRequests";

export default async function PlayersPage() {
  const { t } = await getServerT();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("players.title")}</h1>
        <p className="mt-1 text-ink/70">{t("players.subtitle")}</p>
      </div>
      <PlayRequests />
    </div>
  );
}
