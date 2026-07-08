import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyResendWebhook } from "@/lib/resend-webhook";

interface ResendWebhookPayload {
  type: string;
  data: {
    to?: string[];
    email_id?: string;
  };
}

export async function POST(req: NextRequest) {
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

  let newStatus: string | null = null;
  if (payload.type === "email.bounced") newStatus = "bounced";
  if (payload.type === "email.complained") newStatus = "unsubscribed";

  if (newStatus) {
    await supabase
      .from("outreach")
      .update({ status: newStatus, notes: `Evento Resend: ${payload.type}` })
      .eq("email", recipient)
      .eq("status", "contacted");
  }

  return NextResponse.json({ ok: true });
}
