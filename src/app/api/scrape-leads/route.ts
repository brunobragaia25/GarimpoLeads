import { NextRequest, NextResponse } from "next/server";
import { scrapeLeadsForQuery } from "@/lib/pipeline";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, location } = await req.json();
  if (!category || !location) {
    return NextResponse.json(
      { error: "category e location são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const result = await scrapeLeadsForQuery(category, location);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
