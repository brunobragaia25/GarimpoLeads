import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { COUNTRIES, parseCountry, type Locale } from "@/lib/countries";

type Lang = Locale;

const TEXT: Record<Lang, { lang: string; title: string; invalid: string; question: string; confirm: string; error: string; done: string }> = {
  "pt-BR": {
    lang: "pt-BR",
    title: "Descadastro",
    invalid: "Link inválido.",
    question: "Deseja parar de receber nossos emails?",
    confirm: "Sim, cancelar inscrição",
    error: "Erro ao processar seu pedido. Tente novamente.",
    done: "Você não receberá mais emails nossos. Pedimos desculpas pelo incômodo.",
  },
  "pt-PT": {
    lang: "pt-PT",
    title: "Cancelar subscrição",
    invalid: "Link inválido.",
    question: "Quer deixar de receber os nossos emails?",
    confirm: "Sim, cancelar subscrição",
    error: "Erro ao processar o seu pedido. Tente novamente.",
    done: "Não vai receber mais emails nossos. Pedimos desculpa pelo incómodo.",
  },
  en: {
    lang: "en",
    title: "Unsubscribe",
    invalid: "Invalid link.",
    question: "Want to stop receiving our emails?",
    confirm: "Yes, unsubscribe me",
    error: "Error processing your request. Please try again.",
    done: "You won't receive any more emails from us. Sorry for the inconvenience.",
  },
};

function getLang(req: NextRequest): Lang {
  return COUNTRIES[parseCountry(req.nextUrl.searchParams.get("country"))].locale;
}

function htmlPage(body: string, lang: Lang) {
  return `<!doctype html><html lang="${TEXT[lang].lang}"><head><meta charset="utf-8"/><title>${TEXT[lang].title}</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #333;">
${body}
</body></html>`;
}

function htmlResponse(message: string, lang: Lang, status = 200, extra = "") {
  return new NextResponse(htmlPage(`<h1 style="font-size: 20px;">${message}</h1>${extra}`, lang), {
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
  const lang = getLang(req);
  const leadId = await validLeadId(req);
  if (!leadId) return htmlResponse(TEXT[lang].invalid, lang, 400);

  const country = parseCountry(req.nextUrl.searchParams.get("country"));
  const action = `/api/unsubscribe?lead=${encodeURIComponent(leadId)}&token=${encodeURIComponent(
    req.nextUrl.searchParams.get("token")!
  )}&country=${country}`;

  return htmlResponse(
    TEXT[lang].question,
    lang,
    200,
    `<form method="POST" action="${action}">
<button type="submit" style="margin-top: 16px; padding: 10px 24px; font-size: 15px; cursor: pointer; background: #111; color: #fff; border: none; border-radius: 6px;">${TEXT[lang].confirm}</button>
</form>`
  );
}

// Chamado pelo botão da página acima E automaticamente pelo Gmail/Outlook
// (sem UI) quando o usuário clica no botão nativo de "cancelar inscrição"
// ao lado do remetente, seguindo o header List-Unsubscribe-Post:
// List-Unsubscribe=One-Click. Clientes de email só olham o status HTTP,
// então retornar HTML aqui não atrapalha o one-click.
export async function POST(req: NextRequest) {
  const lang = getLang(req);
  const leadId = await validLeadId(req);
  if (!leadId) return htmlResponse(TEXT[lang].invalid, lang, 400);

  const { error } = await supabase
    .from("outreach")
    .update({ status: "unsubscribed" })
    .eq("lead_id", leadId);

  if (error) return htmlResponse(TEXT[lang].error, lang, 500);
  return htmlResponse(TEXT[lang].done, lang);
}
