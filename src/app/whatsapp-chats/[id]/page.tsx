import { redirect } from "next/navigation";
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
  // Cai aqui se o id nao existe OU se a conversa foi apagada (deleted_at) -
  // acontece, por exemplo, quando a propria conversa aberta na tela e
  // apagada em outra aba/pela selecao em massa, e o refresh automatico do
  // chat tenta recarregar ela. Volta pra lista em vez de mostrar 404.
  if (!conversation) redirect("/whatsapp-chats");

  return <ChatView conversation={conversation} />;
}
