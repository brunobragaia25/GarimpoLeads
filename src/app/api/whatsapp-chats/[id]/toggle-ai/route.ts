import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const { enabled } = await req.json().catch(() => ({}));

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "'enabled' precisa ser true ou false" }, { status: 400 });
  }

  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ ai_enabled: enabled })
    .eq("id", conversationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
