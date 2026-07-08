import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyResendWebhook } from "@/lib/resend-webhook";
import { notifyTelegram } from "@/lib/telegram";

interface ResendWebhookPayload {
  type: string;
  data: {
    to?: string[];
    email_id?: string;
  };
}

async function findActiveOutreach(email: string) {
  const { data } = await supabase
    .from("outreach")
    .select("id, opened_at, clicked_at, leads(name)")
    .eq("email", email)
    .eq("status", "contacted")
    .maybeSingle();
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
    }

    const isValid = await verifyResendWebhook(svixId, svixTimestamp, svixSignature, body);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload: ResendWebhookPayload = JSON.parse(body);
    const recipient = payload.data.to?.[0];

    if (!recipient) {
      return NextResponse.json({ ok: true });
    }

    if (payload.type === "email.bounced" || payload.type === "email.complained") {
      const newStatus = payload.type === "email.bounced" ? "bounced" : "unsubscribed";
      await supabase
        .from("outreach")
        .update({ status: newStatus, notes: `Evento Resend: ${payload.type}` })
        .eq("email", recipient)
        .eq("status", "contacted");
      return NextResponse.json({ ok: true });
    }

    if (payload.type === "email.opened" || payload.type === "email.clicked") {
      const outreach = await findActiveOutreach(recipient);
      if (!outreach) return NextResponse.json({ ok: true });

      const lead = Array.isArray(outreach.leads) ? outreach.leads[0] : outreach.leads;
      const leadName = lead?.name ?? recipient;

      if (payload.type === "email.opened" && !outreach.opened_at) {
        await supabase
          .from("outreach")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", outreach.id);
        await notifyTelegram(`👀 ${leadName} abriu seu email.`);
      }

      if (payload.type === "email.clicked" && !outreach.clicked_at) {
        await supabase
          .from("outreach")
          .update({ clicked_at: new Date().toISOString() })
          .eq("id", outreach.id);
        await notifyTelegram(`🔗 ${leadName} clicou num link do seu email!`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Webhook error:", message, stack);
    // DEBUG temporário: expõe o erro real na resposta pra diagnosticar o 500.
    return NextResponse.json({ debug_error: message, debug_stack: stack }, { status: 500 });
  }
}
