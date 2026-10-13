import { NextResponse } from "next/server";
import { authEnabled, checkPassword, COOKIE, makeToken, rateLimited } from "@/lib/auth";

export async function POST(req: Request) {
  if (!authEnabled()) return NextResponse.json({ ok: true });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "Слишком много попыток. Подождите минуту." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(String(body.password ?? ""))) return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  const t = makeToken();
  const res = NextResponse.json({ ok: true });
  const secure = req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
  res.cookies.set(COOKIE, t.value, { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: t.maxAge });
  return res;
}
