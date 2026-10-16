import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import { getProspectionConfig, saveProspectionConfig } from "@/config/prospection";
import { parseCountry } from "@/lib/countries";
import { getActiveProspectionFocus, saveProspectionFocus } from "@/lib/app-settings";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  return isValidSessionCookie(session);
}


export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const country = parseCountry(req.nextUrl.searchParams.get("country"));
  const config = await getProspectionConfig(country);
  const focus = await getActiveProspectionFocus(country);
  return NextResponse.json({ ...config, focus });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categories, cities, country, focus } = await req.json();
  if (!Array.isArray(categories) || !Array.isArray(cities)) {
    return NextResponse.json(
      { error: "categories e cities precisam ser arrays" },
      { status: 400 }
    );
  }

  try {
    const parsedCountry = parseCountry(typeof country === "string" ? country : null);
    await saveProspectionConfig(
      parsedCountry,
      categories.filter((c) => typeof c === "string" && c.trim()),
      cities.filter((c) => typeof c === "string" && c.trim())
    );
    // `focus` ausente = nao mexe; null = desliga; objeto = liga/atualiza.
    if (focus === null) {
      await saveProspectionFocus(parsedCountry, null);
    } else if (focus && Array.isArray(focus.categories) && !Number.isNaN(new Date(focus.until).getTime())) {
      const focusCategories = focus.categories.filter((c: unknown) => typeof c === "string" && c.trim());
      await saveProspectionFocus(
        parsedCountry,
        focusCategories.length > 0 ? { categories: focusCategories, until: new Date(focus.until).toISOString() } : null
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
