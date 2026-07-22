import { notFound } from "next/navigation";
import { getWhatsappConversationDetail } from "@/lib/whatsapp-chats";
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

  return <ChatView conversation={conversation} />;
}
