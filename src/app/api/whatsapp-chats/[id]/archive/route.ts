import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { setConversationArchived } from "@/lib/whatsapp-chats";

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
  const { archived } = await req.json().catch(() => ({}));

  if (typeof archived !== "boolean") {
    return NextResponse.json({ error: "'archived' precisa ser true ou false" }, { status: 400 });
  }

  await setConversationArchived(id, archived);

  return NextResponse.json({ ok: true });
}
