import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { friendlyErrorKey } from "@/lib/errors";
import { Alert } from "@/components/ui";

/**
 * Target of the organizer's check-in QR (/activities/<id>/checkin?c=CODE).
 * Signed-in only (the proxy sends guests to sign in and back). check_in()
 * validates the code, the time window and that you're an approved participant;
 * checking in twice is harmless.
 */
export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { id } = await params;
  const { c } = await searchParams;
  const supabase = await createClient();
  const { t } = await getServerT();

  const { error } = await supabase.rpc("check_in", { p_event: id, p_code: c ?? "" });

  return (
    <div className="mx-auto max-w-md space-y-5 pt-6 text-center">
      <h1 className="text-2xl font-bold">{t("checkin.title")}</h1>
      {error ? (
        <Alert>{t(friendlyErrorKey(error, "check_in"))}</Alert>
      ) : (
        <div className="card space-y-3 p-6">
          <CheckCircle2 size={48} className="mx-auto text-success" aria-hidden />
          <p className="font-semibold">{t("checkin.done")}</p>
        </div>
      )}
      <Link href={`/activities/${id}`} className="inline-block text-sm font-semibold text-orange-dark hover:underline">
        {t("checkin.back")}
      </Link>
    </div>
  );
}
