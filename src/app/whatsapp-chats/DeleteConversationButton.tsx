"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteConversationButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    // Impede que o clique tambem dispare a navegacao do <a> que envolve a
    // linha inteira da conversa na lista.
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    const res = await fetch(`/api/whatsapp-chats/${id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      alert("Erro ao excluir conversa");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title={`Excluir conversa com ${name}`}
      className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
