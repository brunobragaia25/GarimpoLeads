import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;
  const { phone } = await req.json().catch(() => ({}));

  if (typeof phone !== "string") {
    return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("leads")
    .update({ phone: phone.trim() || null })
    .eq("id", leadId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;

  // Apaga na mao em vez de confiar em ON DELETE CASCADE (nao garantido no
  // schema), pra nao deixar registro orfao em outreach/site_analysis.
  await supabase.from("outreach").delete().eq("lead_id", leadId);
  await supabase.from("site_analysis").delete().eq("lead_id", leadId);

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
