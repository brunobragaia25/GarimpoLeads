import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";
import {
  getLeadsWithDetails,
  isPriorityProspect,
  matchesEmailFilter,
  toBrasiliaDateStr,
  type EmailFilter,
} from "@/lib/leads";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  if (!(await isValidSessionCookie(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const category = params.get("category") ?? "";
  const status = (params.get("status") as EmailFilter) ?? "all";
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const priorityOnly = params.get("priority") === "1";
  const siteFilter = params.get("site") ?? "";
  const sentDate = params.get("sentDate") ?? "";

  const allLeads = await getLeadsWithDetails();

  const filtered = allLeads.filter((lead) => {
    if (category && lead.category !== category) return false;
    if (!matchesEmailFilter(lead, status)) return false;
    if (search && !lead.name.toLowerCase().includes(search)) return false;
    if (priorityOnly && !isPriorityProspect(lead)) return false;
    if (siteFilter === "with" && !lead.website) return false;
    if (siteFilter === "without" && lead.website) return false;
    if (
      sentDate &&
      toBrasiliaDateStr(lead.contacted_at) !== sentDate &&
      toBrasiliaDateStr(lead.follow_up_sent_at) !== sentDate
    )
      return false;
    return true;
  });

  const header = [
    "nome",
    "categoria",
    "telefone",
    "endereco",
    "site",
    "wordpress",
    "performance",
    "email",
    "status_envio",
    "data_envio",
  ];

  const rows = filtered.map((lead) =>
    [
      lead.name,
      lead.category,
      lead.phone ?? "",
      lead.address ?? "",
      lead.website ?? "",
      lead.is_wordpress === null ? "" : lead.is_wordpress ? "sim" : "não",
      lead.performance_score?.toString() ?? "",
      lead.email ?? "",
      lead.outreach_status ?? "",
      lead.contacted_at ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="garimpoleads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
