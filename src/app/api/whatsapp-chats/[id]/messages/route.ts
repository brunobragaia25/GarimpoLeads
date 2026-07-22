import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { deleteWhatsappMessages } from "@/lib/whatsapp-chats";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

// Exclusao em lote - usado pelo modo de selecionar varias mensagens de uma
// vez na tela de chat, em vez de precisar apagar uma por uma.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { messageIds } = await req.json().catch(() => ({}));

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return NextResponse.json({ error: "'messageIds' precisa ser uma lista não vazia" }, { status: 400 });
  }

  await deleteWhatsappMessages(id, messageIds);

  return NextResponse.json({ ok: true });
}
