import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { deleteWhatsappConversations } from "@/lib/whatsapp-chats";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

// Exclusao em lote de conversas inteiras - usado pelo modo de selecao
// multipla na lista de chats.
export async function DELETE(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationIds } = await req.json().catch(() => ({}));

  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    return NextResponse.json(
      { error: "'conversationIds' precisa ser uma lista não vazia" },
      { status: 400 }
    );
  }

  await deleteWhatsappConversations(conversationIds);

  return NextResponse.json({ ok: true });
}
