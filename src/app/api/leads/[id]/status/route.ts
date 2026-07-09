import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

const ALLOWED_STATUSES = [
  "pending",
  "contacted",
  "responded",
  "meeting_scheduled",
  "proposal_sent",
  "closed_won",
  "closed_lost",
  "ignored",
  "unsubscribed",
  "bounced",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;
  const { status } = await req.json().catch(() => ({}));

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("outreach")
    .select("id, contacted_at")
    .eq("lead_id", leadId)
    .maybeSingle();

  // Envio automatico por email ja grava contacted_at na hora do envio; aqui
  // so preenchemos se ainda nao tiver (ex: contato manual via WhatsApp).
  const contactedAtUpdate =
    status === "contacted" && !existing?.contacted_at
      ? { contacted_at: new Date().toISOString() }
      : {};

  if (existing) {
    const { error } = await supabase
      .from("outreach")
      .update({ status, ...contactedAtUpdate })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("outreach")
      .insert({ lead_id: leadId, status, ...contactedAtUpdate });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
