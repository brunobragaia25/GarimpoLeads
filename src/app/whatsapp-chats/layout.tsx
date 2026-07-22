import { getWhatsappConversations } from "@/lib/whatsapp-chats";
import { PageHeader } from "../PageHeader";
import { ChatsList } from "./ChatsList";

export const dynamic = "force-dynamic";

// Layout tipo WhatsApp Web: lista de conversas fixa na esquerda, o chat
// aberto ocupa a direita (via `children` = page.tsx ou [id]/page.tsx). Como
// os dois ficam sob o mesmo layout, o Next mantem a lista montada ao trocar
// de conversa - sem recarregar a pagina inteira a cada clique.
export default async function WhatsappChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const conversations = await getWhatsappConversations();

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/whatsapp-chats" />
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-full max-w-sm shrink-0 flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
          <ChatsList conversations={conversations} />
        </aside>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
