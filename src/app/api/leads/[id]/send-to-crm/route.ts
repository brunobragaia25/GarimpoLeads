import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { sendLeadToCRM } from "@/lib/crm";

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

  const { id: leadId } = await params;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name, phone, crm_synced_at")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  if (lead.crm_synced_at) {
    return NextResponse.json({ error: "Esse lead já foi enviado pro CRM" }, { status: 400 });
  }

  const { data: outreach } = await supabase
    .from("outreach")
    .select("email")
    .eq("lead_id", leadId)
    .not("email", "is", null)
    .maybeSingle();

  if (!outreach?.email) {
    return NextResponse.json({ error: "Esse lead não tem email encontrado" }, { status: 400 });
  }

  try {
    await sendLeadToCRM({ name: lead.name, email: outreach.email, phone: lead.phone });

    await supabase
      .from("leads")
      .update({ crm_synced_at: new Date().toISOString() })
      .eq("id", leadId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
