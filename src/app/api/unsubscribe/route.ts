import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

function htmlPage(body: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Descadastro</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #333;">
${body}
</body></html>`;
}

function htmlResponse(body: string, status = 200) {
  return new NextResponse(htmlPage(body), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function validLeadId(req: NextRequest): Promise<string | null> {
  const leadId = req.nextUrl.searchParams.get("lead");
  const token = req.nextUrl.searchParams.get("token");
  if (!leadId || !token || !(await verifyUnsubscribeToken(leadId, token))) {
    return null;
  }
  return leadId;
}

// O GET só mostra a página de confirmação, sem mudar nada no banco:
// scanners de email (Outlook SafeLinks, antivírus corporativo) seguem
// GETs automaticamente ao escanear a mensagem, então descadastrar direto
// aqui geraria descadastros falsos. O clique no botão faz o POST real.
export async function GET(req: NextRequest) {
  const leadId = await validLeadId(req);
  if (!leadId) {
    return htmlResponse(`<h1 style="font-size: 20px;">Link inválido.</h1>`, 400);
  }

  const action = `/api/unsubscribe?lead=${encodeURIComponent(leadId)}&token=${encodeURIComponent(
    req.nextUrl.searchParams.get("token")!
  )}`;

  return htmlResponse(
    `<h1 style="font-size: 20px;">Deseja parar de receber nossos emails?</h1>
<form method="POST" action="${action}">
<button type="submit" style="margin-top: 16px; padding: 10px 24px; font-size: 15px; cursor: pointer; background: #111; color: #fff; border: none; border-radius: 6px;">Sim, cancelar inscrição</button>
</form>`
  );
}

// Chamado pelo botão da página acima E automaticamente pelo Gmail/Outlook
// (sem UI) quando o usuário clica no botão nativo de "cancelar inscrição"
// ao lado do remetente, seguindo o header List-Unsubscribe-Post:
// List-Unsubscribe=One-Click. Clientes de email só olham o status HTTP,
// então retornar HTML aqui não atrapalha o one-click.
export async function POST(req: NextRequest) {
  const leadId = await validLeadId(req);
  if (!leadId) {
    return htmlResponse(`<h1 style="font-size: 20px;">Link inválido.</h1>`, 400);
  }

  const { error } = await supabase
    .from("outreach")
    .update({ status: "unsubscribed" })
    .eq("lead_id", leadId);

  if (error) {
    return htmlResponse(
      `<h1 style="font-size: 20px;">Erro ao processar seu pedido. Tente novamente.</h1>`,
      500
    );
  }

  return htmlResponse(
    `<h1 style="font-size: 20px;">Você não receberá mais emails nossos. Pedimos desculpas pelo incômodo.</h1>`
  );
}
