import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { setConversationPinned } from "@/lib/whatsapp-chats";

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

  const { id } = await params;
  const { pinned } = await req.json().catch(() => ({}));

  if (typeof pinned !== "boolean") {
    return NextResponse.json({ error: "'pinned' precisa ser true ou false" }, { status: 400 });
  }

  await setConversationPinned(id, pinned);

  return NextResponse.json({ ok: true });
}
