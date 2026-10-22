import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getWhatsappConversations } from "@/lib/whatsapp-chats";
import { MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// Deteccao simples de mobile pelo User-Agent - no celular a lista de
// conversas E a tela util da rota raiz (igual WhatsApp mobile: abre na
// lista, so entra num chat especifico ao tocar nele). No desktop, como as
// duas colunas ja ficam lado a lado o tempo todo, faz mais sentido abrir
// direto na conversa mais recente em vez de mostrar um painel vazio.
function isMobileUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
}

export default async function WhatsappChatsPage() {
  const conversations = await getWhatsappConversations();
  const userAgent = (await headers()).get("user-agent");

  if (conversations.length > 0 && !isMobileUserAgent(userAgent)) {
    redirect(`/whatsapp-chats/${conversations[0].id}`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-zinc-400 dark:text-zinc-500">
      <MessageCircle className="h-10 w-10" />
      <p className="text-sm">
        {conversations.length > 0 ? "Selecione uma conversa na lista ao lado" : "Nenhuma conversa de WhatsApp ainda."}
      </p>
    </div>
  );
}
