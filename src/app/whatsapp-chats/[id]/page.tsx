import { notFound } from "next/navigation";
import { getWhatsappConversationDetail } from "@/lib/whatsapp-chats";
import { PageHeader } from "../../PageHeader";
import { ChatView } from "./ChatView";

export const dynamic = "force-dynamic";

export default async function WhatsappChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getWhatsappConversationDetail(id);
  if (!conversation) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/whatsapp-chats" />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <ChatView conversation={conversation} />
      </main>
    </div>
  );
}
