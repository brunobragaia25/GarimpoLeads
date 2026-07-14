import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { sendWhatsappText } from "@/lib/whatsapp";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

// Envio manual pela tela de chat - pausa a IA nessa conversa (ai_enabled =
// false) pra ela nao responder por cima de uma intervenção manual sua.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const { message } = await req.json().catch(() => ({}));

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  try {
    const waMessageId = await sendWhatsappText(conversation.phone, message.trim());

    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body: message.trim(),
      wa_message_id: waMessageId,
    });

    await supabase
      .from("whatsapp_conversations")
      .update({
        last_outbound_at: new Date().toISOString(),
        status: "open",
        ai_enabled: false,
      })
      .eq("id", conversation.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
