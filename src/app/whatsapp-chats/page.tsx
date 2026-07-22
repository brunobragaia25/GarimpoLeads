import { redirect } from "next/navigation";
import { getWhatsappConversations } from "@/lib/whatsapp-chats";
import { MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// Abre a primeira conversa (mais recente) automaticamente, igual o
// WhatsApp Web - so mostra o placeholder abaixo se nao existir nenhuma
// conversa ainda.
export default async function WhatsappChatsPage() {
  const conversations = await getWhatsappConversations();

  if (conversations.length > 0) {
    redirect(`/whatsapp-chats/${conversations[0].id}`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-zinc-400 dark:text-zinc-500">
      <MessageCircle className="h-10 w-10" />
      <p className="text-sm">Nenhuma conversa de WhatsApp ainda.</p>
    </div>
  );
}
