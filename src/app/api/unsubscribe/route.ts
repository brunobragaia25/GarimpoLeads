import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

function htmlPage(message: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Descadastro</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #333;">
<h1 style="font-size: 20px;">${message}</h1>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead");
  const token = req.nextUrl.searchParams.get("token");

  if (!leadId || !token || !(await verifyUnsubscribeToken(leadId, token))) {
    return new NextResponse(htmlPage("Link inválido."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { error } = await supabase
    .from("outreach")
    .update({ status: "unsubscribed" })
    .eq("lead_id", leadId);

  if (error) {
    return new NextResponse(htmlPage("Erro ao processar seu pedido. Tente novamente."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(
    htmlPage("Você não receberá mais emails nossos. Pedimos desculpas pelo incômodo."),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

// Gmail/Outlook chamam isso automaticamente (sem UI) quando o usuario clica
// no botao nativo de "cancelar inscricao" ao lado do remetente, seguindo o
// header List-Unsubscribe-Post: List-Unsubscribe=One-Click.
export async function POST(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead");
  const token = req.nextUrl.searchParams.get("token");

  if (!leadId || !token || !(await verifyUnsubscribeToken(leadId, token))) {
    return new NextResponse(null, { status: 400 });
  }

  const { error } = await supabase
    .from("outreach")
    .update({ status: "unsubscribed" })
    .eq("lead_id", leadId);

  if (error) return new NextResponse(null, { status: 500 });

  return new NextResponse(null, { status: 200 });
}
