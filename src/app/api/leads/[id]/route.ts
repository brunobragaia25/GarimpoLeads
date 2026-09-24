import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { blockPhone } from "@/lib/blocklist";

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
  const { phone, email } = await req.json().catch(() => ({}));

  // E-mail achado na mao (lead sem site, onde a raspagem nao acha nada):
  // grava/atualiza a linha de outreach do lead. Vazio limpa o e-mail.
  if (typeof email === "string") {
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("outreach")
      .select("id")
      .eq("lead_id", leadId)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("outreach").update({ email: trimmed || null }).eq("id", existing.id)
      : await supabase.from("outreach").insert({
          lead_id: leadId,
          email: trimmed || null,
          status: "pending",
          notes: "Fonte: manual",
        });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

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

  // Bloqueia o telefone pra sempre antes de apagar - sem isso, um scraping
  // futuro da mesma categoria/regiao acha o mesmo negocio "novo" (o dedup
  // so compara contra leads que ainda existem) e o WhatsApp automatico
  // manda o mesmo template de novo pra quem ja foi excluido.
  const { data: lead } = await supabase.from("leads").select("phone").eq("id", leadId).maybeSingle();
  await blockPhone(lead?.phone);

  // Apaga na mao em vez de confiar em ON DELETE CASCADE (nao garantido no
  // schema), pra nao deixar registro orfao em outreach/site_analysis.
  await supabase.from("outreach").delete().eq("lead_id", leadId);
  await supabase.from("site_analysis").delete().eq("lead_id", leadId);

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
