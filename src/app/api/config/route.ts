import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { getProspectionConfig, saveProspectionConfig } from "@/config/prospection";
import type { Country } from "@/lib/types";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}

function parseCountry(value: string | null): Country {
  return value === "US" ? "US" : "BR";
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const country = parseCountry(req.nextUrl.searchParams.get("country"));
  const config = await getProspectionConfig(country);
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categories, cities, country } = await req.json();
  if (!Array.isArray(categories) || !Array.isArray(cities)) {
    return NextResponse.json(
      { error: "categories e cities precisam ser arrays" },
      { status: 400 }
    );
  }

  try {
    await saveProspectionConfig(
      parseCountry(typeof country === "string" ? country : null),
      categories.filter((c) => typeof c === "string" && c.trim()),
      cities.filter((c) => typeof c === "string" && c.trim())
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
