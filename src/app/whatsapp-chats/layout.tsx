import { getWhatsappConversations } from "@/lib/whatsapp-chats";
import { PageHeader } from "../PageHeader";
import { ChatsList } from "./ChatsList";
import { ChatsLayoutShell } from "./ChatsLayoutShell";

export const dynamic = "force-dynamic";

// Layout tipo WhatsApp Web: lista de conversas fixa na esquerda, o chat
// aberto ocupa a direita (via `children` = page.tsx ou [id]/page.tsx). Como
// os dois ficam sob o mesmo layout, o Next mantem a lista montada ao trocar
// de conversa - sem recarregar a pagina inteira a cada clique. No mobile
// (ver ChatsLayoutShell) so uma coluna aparece por vez.
export default async function WhatsappChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const conversations = await getWhatsappConversations();

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/whatsapp-chats" />
      <ChatsLayoutShell sidebar={<ChatsList conversations={conversations} />}>
        {children}
      </ChatsLayoutShell>
    </div>
  );
}
