import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ActivityForm } from "@/components/ActivityForm";
import type { EventRecord } from "@/types";

export default async function CreateActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; title?: string; category?: string; group?: string; from?: string }>;
}) {
  const { t } = await getServerT();
  // From "Find players" (/create?request=<id>&title=…&category=<id>), a group page
  // (/create?group=<id>) or "Duplicate" on one of your own activities (/create?from=<id>).
  const { request, title, category, group, from } = await searchParams;
  const fromRequest = request ? { id: request, title: title ?? "", categoryId: category ?? "" } : undefined;

  let template: EventRecord | undefined;
  let contactWhatsapp: string | null = null;
  if (from) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [{ data }, { data: contact }] = await Promise.all([
      supabase.from("events").select("*").eq("id", from).eq("creator_id", user!.id).maybeSingle(),
      supabase.from("event_contacts").select("pic_whatsapp").eq("event_id", from).maybeSingle(),
    ]);
    template = (data as EventRecord | null) ?? undefined; // only your own activities
    if (template) contactWhatsapp = contact?.pic_whatsapp ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("create.title")}</h1>
        <p className="mt-1 text-ink/70">{template ? t("create.duplicating", { title: template.title }) : t("create.subtitle")}</p>
      </div>
      <ActivityForm fromRequest={fromRequest} groupId={group} template={template} contactWhatsapp={contactWhatsapp} />
    </div>
  );
}
