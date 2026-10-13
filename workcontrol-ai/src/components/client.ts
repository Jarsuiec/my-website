"use client";

// Клиентские утилиты: запросы к API и всплывающие уведомления.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function call<T = Record<string, unknown>>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"), cache: "no-store" };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json" };
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте, запущено ли приложение.");
  }
  if (res.status === 401) {
    if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) location.href = "/login";
    throw new ApiError(401, "Требуется вход");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || `Ошибка ${res.status}`);
  return data as T;
}

export function toast(message: string, kind: "ok" | "error" = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wc-toast", { detail: { message, kind } }));
}

export function fmtDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", withTime ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "дата неизвестна";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (Math.abs(m) < 1) return "только что";
  if (m < 0) return `через ${fmtDuration(-m)}`;
  return `${fmtDuration(m)} назад`;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min} мин`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} ч`;
  return `${Math.round(h / 24)} дн`;
}

/** Преобразует ссылки [T12] / [M34] в тексте ответа AI в кликабельные. */
export function linkify(text: string): (string | { kind: "T" | "M"; id: number; raw: string })[] {
  const out: (string | { kind: "T" | "M"; id: number; raw: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[(T|M)(\d+)\]/g)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ kind: m[1] as "T" | "M", id: Number(m[2]), raw: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
