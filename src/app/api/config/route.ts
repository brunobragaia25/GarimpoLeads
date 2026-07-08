import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { getProspectionConfig, saveProspectionConfig } from "@/config/prospection";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getProspectionConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categories, cities } = await req.json();
  if (!Array.isArray(categories) || !Array.isArray(cities)) {
    return NextResponse.json(
      { error: "categories e cities precisam ser arrays" },
      { status: 400 }
    );
  }

  try {
    await saveProspectionConfig(
      categories.filter((c) => typeof c === "string" && c.trim()),
      cities.filter((c) => typeof c === "string" && c.trim())
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
