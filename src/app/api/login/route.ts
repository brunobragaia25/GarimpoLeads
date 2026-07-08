import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, createSessionCookieValue, isValidPassword } from "@/lib/auth";
import { checkLock, recordFailedAttempt, resetAttempts, getClientIp } from "@/lib/login-rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const lock = await checkLock(ip);
  if (lock.locked) {
    return NextResponse.json(
      { error: `Muitas tentativas erradas. Tente de novo em ${Math.ceil((lock.retryAfterSeconds ?? 0) / 60)} min.` },
      { status: 429 }
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));

  if (!isValidPassword(password ?? "")) {
    await recordFailedAttempt(ip);
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  await resetAttempts(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, await createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
