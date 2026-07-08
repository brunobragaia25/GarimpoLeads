import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { getTemplate, saveTemplate, listTemplates } from "@/lib/template";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get("category");

  if (req.nextUrl.searchParams.get("list") === "1") {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  }

  const template = await getTemplate(category);
  return NextResponse.json(template);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subject, body, category } = await req.json();
  if (typeof subject !== "string" || typeof body !== "string") {
    return NextResponse.json({ error: "subject e body são obrigatórios" }, { status: 400 });
  }

  try {
    await saveTemplate(subject, body, category || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
