// Простая авторизация одного пользователя: пароль из APP_PASSWORD, подписанная cookie-сессия.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { dataDir } from "./db";

export const COOKIE = "wc_session";
const TTL_DAYS = 14;

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

let cachedSecret: Buffer | null = null;
function secret(): Buffer {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    cachedSecret = Buffer.from(process.env.SESSION_SECRET);
    return cachedSecret;
  }
  const p = path.join(dataDir(), "secret.key");
  if (!fs.existsSync(p)) fs.writeFileSync(p, crypto.randomBytes(48).toString("hex"), { mode: 0o600 });
  cachedSecret = Buffer.from(fs.readFileSync(p, "utf8").trim());
  return cachedSecret;
}

function sign(v: string): string {
  return crypto.createHmac("sha256", secret()).update(v).digest("base64url");
}

export function makeToken(): { value: string; maxAge: number } {
  const exp = Date.now() + TTL_DAYS * 864e5;
  const v = `${exp}.${crypto.randomBytes(8).toString("hex")}`;
  return { value: `${v}.${sign(v)}`, maxAge: TTL_DAYS * 86400 };
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const v = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(v));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return false;
  return Number(v.split(".")[0]) > Date.now();
}

export function checkPassword(input: string): boolean {
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(process.env.APP_PASSWORD || "").digest();
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthed(): Promise<boolean> {
  if (!authEnabled()) return true;
  const c = await cookies();
  return verifyToken(c.get(COOKIE)?.value);
}

const attempts = new Map<string, number[]>();
export function rateLimited(key: string): boolean {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 60_000);
  list.push(now);
  attempts.set(key, list);
  return list.length > 8;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Обёртка API-маршрутов: авторизация, проверка Origin для изменений, единый формат ошибок. */
export function api<A extends unknown[]>(handler: (req: Request, ...args: A) => Promise<Response | unknown>) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      if (!(await isAuthed())) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
        if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Запрос с чужого сайта отклонён" }, { status: 403 });
      }
      const out = await handler(req, ...args);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 400;
      const msg = (e as Error).message || "Ошибка";
      if (!(e instanceof HttpError)) console.error("[api]", e);
      return NextResponse.json({ error: msg }, { status });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Некорректный JSON в запросе");
  }
}
