import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const session = req.cookies.get(COOKIE_NAME)?.value;

  if (await isValidSessionCookie(session)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

// As rotas /api/* têm sua própria autenticação via Bearer CRON_SECRET
// (usada pelo cron e chamadas manuais), então ficam fora deste middleware.
export const config = {
  matcher: ["/((?!login|api|_next|favicon.ico|icon|apple-icon).*)"],
};
