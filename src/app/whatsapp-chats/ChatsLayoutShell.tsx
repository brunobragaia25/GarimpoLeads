"use client";

import { usePathname } from "next/navigation";

// Em telas pequenas so cabe uma coluna por vez, igual WhatsApp mobile: lista
// na rota exata /whatsapp-chats, chat aberto ocupando a tela inteira em
// /whatsapp-chats/[id]. Em telas medias+ (md:) sempre mostra as duas lado a
// lado, independente da rota.
export function ChatsLayoutShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isListRoute = pathname === "/whatsapp-chats";

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside
        className={`w-full shrink-0 flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800 md:flex md:w-full md:max-w-sm ${
          isListRoute ? "flex" : "hidden"
        }`}
      >
        {sidebar}
      </aside>
      <main className={`flex-1 overflow-hidden ${isListRoute ? "hidden md:block" : "block"}`}>
        {children}
      </main>
    </div>
  );
}
