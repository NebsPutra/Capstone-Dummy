import { redirect } from "next/navigation";

/** Alias: /event/<id> -> /activities/<id> */
export default async function EventByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/activities/${encodeURIComponent(id)}`);
}
