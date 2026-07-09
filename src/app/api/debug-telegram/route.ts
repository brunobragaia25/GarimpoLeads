import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecretConfigured = !!process.env.CRON_SECRET;
  const cronSecretMatches = auth === `Bearer ${process.env.CRON_SECRET}`;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: "🔧 Teste de debug do GarimpoLeads" }),
  });

  const body = await res.text();

  const cronSecret = process.env.CRON_SECRET;
  return NextResponse.json({
    cron_secret_configured: cronSecretConfigured,
    cron_secret_matches: cronSecretMatches,
    cron_secret_length: cronSecret?.length ?? 0,
    cron_secret_preview: cronSecret ? `${cronSecret.slice(0, 6)}...${cronSecret.slice(-4)}` : null,
    token_length: token?.length ?? 0,
    token_preview: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : null,
    chat_id: chatId,
    telegram_status: res.status,
    telegram_response: body,
  });
}
