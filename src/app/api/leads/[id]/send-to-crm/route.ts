import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { sendLeadToCRM, deleteLeadFromCRM } from "@/lib/crm";

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
    const docId = await sendLeadToCRM({ name: lead.name, email: outreach.email, phone: lead.phone });

    await supabase
      .from("leads")
      .update({ crm_synced_at: new Date().toISOString(), crm_doc_id: docId })
      .eq("id", leadId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Desfaz o envio: apaga o documento no Firestore do GestãoDevz E limpa o
// rastreamento local, pra poder reenviar depois se precisar.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;

  const { data: lead } = await supabase
    .from("leads")
    .select("crm_doc_id")
    .eq("id", leadId)
    .single();

  if (lead?.crm_doc_id) {
    try {
      await deleteLeadFromCRM(lead.crm_doc_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      return NextResponse.json({ error: `Erro ao apagar no CRM: ${message}` }, { status: 500 });
    }
  }

  const { error } = await supabase
    .from("leads")
    .update({ crm_synced_at: null, crm_doc_id: null })
    .eq("id", leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
