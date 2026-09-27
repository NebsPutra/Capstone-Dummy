import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatThread, MessagesInbox, type ChatMessage, type ConversationCard } from "@/components/messages/Messages";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: card, error }, { data: messages }] = await Promise.all([
    supabase.rpc("conversation_detail", { p_conversation: id }),
    supabase.rpc("conversation_messages", { p_conversation: id, p_before: null, p_limit: 50 }),
  ]);
  if (error || !card) notFound();

  return (
    <div className="mx-auto grid h-[calc(100dvh-11.5rem)] max-w-5xl gap-4 md:h-[calc(100dvh-7.5rem)] lg:grid-cols-[20rem_1fr]">
      <div className="hidden min-h-0 lg:block">
        <MessagesInbox activeId={id} compact />
      </div>
      <div className="min-h-0">
        <ChatThread key={id} initial={card as ConversationCard} initialMessages={(messages ?? []) as ChatMessage[]} />
      </div>
    </div>
  );
}
