// Разбор входящих файлов в единый формат RawMessage.
// Отсутствующие данные остаются пустыми — ничего не придумываем.

import { simpleParser, type AddressObject } from "mailparser";
import Papa from "papaparse";
import JSZip from "jszip";

export type RawMessage = {
  externalId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  fromName?: string | null;
  fromAddr?: string | null;
  toAddr?: string | null;
  mailbox?: string | null;
  subject?: string | null;
  date?: Date | null;
  body: string;
  sourceHint?: string | null;
  directionHint?: "in" | "out" | null;
  threadHint?: string | null;
  orderHint?: string | null;
};

export type ManualTaskRow = {
  title: string;
  source?: string | null;
  customer_name?: string | null;
  order_number?: string | null;
  summary?: string | null;
  priority?: string | null;
  deadline?: string | null;
};

export type ParseResult = {
  format: string;
  messages: RawMessage[];
  tasks: ManualTaskRow[];
  errors: string[];
};

export const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;
const MAX_ZIP_UNCOMPRESSED = 600 * 1024 * 1024;
const MAX_BODY = 200_000;

export const SUPPORTED_EXT = ["eml", "mbox", "csv", "xlsx", "json", "txt", "pdf", "zip"];

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

function cleanBody(s: string | null | undefined): string {
  const t = (s || "").replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  return t.length > MAX_BODY ? t.slice(0, MAX_BODY) + "\n…[обрезано]" : t;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, "\n\n");
}

function firstAddress(a: AddressObject | AddressObject[] | undefined): { name: string | null; addr: string | null } {
  const obj = Array.isArray(a) ? a[0] : a;
  const v = obj?.value?.[0];
  return { name: v?.name || null, addr: v?.address?.toLowerCase() || null };
}

function allAddresses(a: AddressObject | AddressObject[] | undefined): string | null {
  const list = (Array.isArray(a) ? a : a ? [a] : []).flatMap((o) => o.value.map((v) => v.address?.toLowerCase()).filter(Boolean));
  return list.length ? list.join(", ") : null;
}

function headerStr(h: unknown): string | null {
  if (!h) return null;
  if (typeof h === "string") return h;
  if (Array.isArray(h)) return h.map(headerStr).filter(Boolean).join(", ");
  if (typeof h === "object" && h && "text" in h) return String((h as { text: string }).text);
  return String(h);
}

export async function parseEml(buf: Buffer): Promise<RawMessage> {
  const p = await simpleParser(buf, { skipImageLinks: true, skipTextToHtml: true });
  const from = firstAddress(p.from);
  const labels = (headerStr(p.headers.get("x-gmail-labels")) || "").toLowerCase();
  const delivered = headerStr(p.headers.get("delivered-to")) || headerStr(p.headers.get("x-original-to"));
  const refs = Array.isArray(p.references) ? p.references : p.references ? [p.references] : [];
  let direction: "in" | "out" | null = null;
  if (/\b(sent|wysłane|отправленные|gesendet)\b/.test(labels)) direction = "out";
  return {
    externalId: p.messageId || null,
    inReplyTo: p.inReplyTo || null,
    references: refs,
    fromName: from.name,
    fromAddr: from.addr,
    toAddr: allAddresses(p.to),
    mailbox: delivered?.toLowerCase().split(",")[0].trim() || null,
    subject: p.subject || null,
    date: p.date && !isNaN(p.date.getTime()) ? p.date : null,
    body: cleanBody(p.text || (typeof p.html === "string" ? htmlToText(p.html) : "")),
    directionHint: direction,
  };
}

/** MBOX (Google Takeout, Thunderbird): разделитель — строка «From ...» в начале. */
export async function parseMbox(buf: Buffer, errors: string[]): Promise<RawMessage[]> {
  const raw = buf.toString("latin1"); // побайтово, кодировки разберёт mailparser
  const parts = raw.split(/\r?\n(?=From [^\r\n]*\r?\n)/);
  const out: RawMessage[] = [];
  let i = 0;
  for (let part of parts) {
    i++;
    if (!part.trim()) continue;
    if (part.startsWith("From ")) part = part.slice(part.indexOf("\n") + 1);
    part = part.replace(/^>(>*From )/gm, "$1");
    try {
      out.push(await parseEml(Buffer.from(part, "latin1")));
    } catch (e) {
      errors.push(`Письмо №${i} в MBOX не разобрано: ${(e as Error).message}`);
    }
  }
  return out;
}

// ---------- Таблицы (CSV / XLSX / JSON) ----------

const COLS: Record<string, string[]> = {
  title: ["title", "task", "zadanie", "задача", "название"],
  fromAddr: ["from", "from email", "sender", "sender email", "email", "e-mail", "mail", "od", "nadawca", "adres email", "от", "отправитель", "customer email", "buyer email"],
  fromName: ["name", "from name", "sender name", "customer", "customer name", "buyer", "buyer login", "klient", "kupujacy", "kupujący", "imie i nazwisko", "imię i nazwisko", "клиент", "имя", "имя клиента"],
  toAddr: ["to", "recipient", "do", "odbiorca", "кому", "получатель"],
  subject: ["subject", "temat", "тема", "topic"],
  date: ["date", "data", "дата", "created at", "created_at", "sent", "sent at", "timestamp", "time", "czas", "время"],
  body: ["body", "message", "text", "content", "tresc", "treść", "wiadomosc", "wiadomość", "сообщение", "текст", "описание", "description"],
  order: ["order", "order number", "order id", "order_id", "zamowienie", "zamówienie", "nr zamowienia", "nr zamówienia", "numer zamowienia", "numer zamówienia", "заказ", "номер заказа"],
  source: ["source", "platform", "zrodlo", "źródło", "platforma", "источник", "kanal", "kanał", "channel"],
  direction: ["direction", "kierunek", "направление"],
  thread: ["thread", "thread id", "conversation", "conversation id", "watek", "wątek", "переписка"],
  messageId: ["message id", "message-id", "id wiadomosci", "external id"],
  priority: ["priority", "priorytet", "приоритет"],
  deadline: ["deadline", "termin", "дедлайн", "срок"],
};

function normKey(k: string): string {
  return k.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function mapColumns(keys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [field, names] of Object.entries(COLS)) {
    const hit = keys.find((k) => names.includes(normKey(k)));
    if (hit && !Object.values(map).includes(hit)) map[field] = hit;
  }
  return map;
}

/** Даты: ISO, «dd.mm.yyyy hh:mm», «dd/mm/yyyy» (польский порядок день-месяц). */
export function parseLooseDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Excel serial date
    return new Date(Math.round((v - 25569) * 864e5));
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[,\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s) || /[a-z]{3}/i.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function rowsToResult(rows: Record<string, unknown>[], format: string): ParseResult {
  const result: ParseResult = { format, messages: [], tasks: [], errors: [] };
  if (!rows.length) {
    result.errors.push("Файл не содержит строк");
    return result;
  }
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const map = mapColumns(keys);
  const get = (r: Record<string, unknown>, f: string) => {
    const k = map[f];
    const v = k ? r[k] : undefined;
    if (v === null || v === undefined) return null;
    const s = v instanceof Date ? v.toISOString() : String(v).trim();
    return s || null;
  };
  if (!map.body && !map.title) {
    result.errors.push(
      `Не найдена колонка с текстом сообщения или названием задачи. Найдены колонки: ${keys.join(", ")}. ` +
        `Переименуйте нужную колонку в «message» (сообщения) или «title» (задачи).`,
    );
    return result;
  }
  rows.forEach((r, idx) => {
    const body = get(r, "body");
    const title = get(r, "title");
    if (map.title && title && !body) {
      result.tasks.push({
        title,
        source: get(r, "source"),
        customer_name: get(r, "fromName"),
        order_number: get(r, "order"),
        summary: null,
        priority: get(r, "priority"),
        deadline: get(r, "deadline"),
      });
      return;
    }
    if (!body) {
      result.errors.push(`Строка ${idx + 2}: пустой текст — пропущена`);
      return;
    }
    const dir = (get(r, "direction") || "").toLowerCase();
    const k = map.date;
    result.messages.push({
      externalId: get(r, "messageId"),
      fromAddr: get(r, "fromAddr")?.toLowerCase() ?? null,
      fromName: get(r, "fromName"),
      toAddr: get(r, "toAddr")?.toLowerCase() ?? null,
      subject: get(r, "subject") ?? title,
      date: k ? parseLooseDate(r[k]) : null,
      body: cleanBody(body),
      sourceHint: get(r, "source"),
      threadHint: get(r, "thread"),
      orderHint: get(r, "order"),
      directionHint: /^(out|outgoing|sent|wychodz|исход|отправ)/.test(dir) ? "out" : /^(in|incoming|received|przychodz|вход)/.test(dir) ? "in" : null,
    });
  });
  return result;
}

export function parseCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true, dynamicTyping: false });
  const res = rowsToResult(parsed.data, "csv");
  for (const e of parsed.errors.slice(0, 5)) res.errors.push(`CSV, строка ${(e.row ?? 0) + 2}: ${e.message}`);
  return res;
}

export async function parseXlsx(buf: Buffer): Promise<ParseResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { format: "xlsx", messages: [], tasks: [], errors: ["В файле нет листов"] };
  const headers: string[] = [];
  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, n) => {
    const values = (row.values as unknown[]).slice(1).map((v) => {
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
        if (o.richText) return o.richText.map((t) => t.text).join("");
        if (o.text !== undefined) return o.text;
        if (o.result !== undefined) return o.result;
      }
      return v;
    });
    if (n === 1) values.forEach((v, i) => (headers[i] = String(v ?? `col${i + 1}`)));
    else {
      const r: Record<string, unknown> = {};
      headers.forEach((h, i) => (r[h] = values[i] ?? null));
      rows.push(r);
    }
  });
  return rowsToResult(rows, "xlsx");
}

export function parseJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    return { format: "json", messages: [], tasks: [], errors: [`Некорректный JSON: ${(e as Error).message}`] };
  }
  if (data && typeof data === "object" && (data as { format?: string }).format === "workcontrol-backup") {
    return { format: "json", messages: [], tasks: [], errors: ["Это резервная копия WorkControl. Восстановите её в разделе «Архив → Восстановить»."] };
  }
  const obj = data as Record<string, unknown>;
  const list = Array.isArray(data) ? data : Array.isArray(obj?.messages) ? obj.messages : Array.isArray(obj?.tasks) ? obj.tasks : null;
  if (!list) return { format: "json", messages: [], tasks: [], errors: ["Ожидался массив объектов или объект с полем messages / tasks"] };
  return rowsToResult(list.filter((x) => x && typeof x === "object") as Record<string, unknown>[], "json");
}

// ---------- Текст и WhatsApp ----------

// «12.10.2026, 14:23 - Anna: текст» (Android) или «[12.10.26, 14:23:11] Anna: текст» (iOS)
const WA_LINE = /^‎?\[?(\d{1,2}[./]\d{1,2}[./]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:[-–]\s*)?([^:\n]{1,80}?):\s([\s\S]*)$/;

export function isWhatsApp(text: string): boolean {
  const lines = text.split(/\r?\n/).slice(0, 50);
  return lines.filter((l) => WA_LINE.test(l)).length >= 2;
}

export function parseWhatsApp(text: string, fileName: string, myNames: string[]): RawMessage[] {
  const chat =
    /(?:WhatsApp Chat (?:with|-)|Czat WhatsApp z|Чат WhatsApp с|WhatsApp-Chat mit)\s*(.+?)\.txt$/i.exec(fileName)?.[1]?.trim() || null;
  const msgs: RawMessage[] = [];
  let cur: RawMessage | null = null;
  const mine = myNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
  for (const line of text.split(/\r?\n/)) {
    const m = WA_LINE.exec(line);
    if (m) {
      if (cur) msgs.push(cur);
      const author = m[3].trim();
      const isMine = mine.includes(author.toLowerCase());
      cur = {
        fromName: author,
        fromAddr: null,
        subject: chat ? `WhatsApp: ${chat}` : "WhatsApp",
        date: parseLooseDate(`${m[1]} ${m[2]}`),
        body: m[4],
        sourceHint: "whatsapp",
        directionHint: mine.length ? (isMine ? "out" : "in") : null,
        threadHint: `wa:${(chat || fileName).toLowerCase()}`,
      };
    } else if (cur) {
      cur.body += "\n" + line;
    }
  }
  if (cur) msgs.push(cur);
  return msgs
    .filter((m) => !/^(<(media omitted|pominięto multimedia|без медиафайлов)>|messages and calls are end-to-end encrypted|wiadomości i połączenia są szyfrowane)/i.test(m.body.trim()))
    .map((m) => ({ ...m, body: cleanBody(m.body) }));
}

/** Вставленный текст: если сверху есть заголовки «From/Od/Subject/Temat/Date/Data» — используем их. */
export function parsePlainText(text: string, label: string): RawMessage {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const head: Record<string, string> = {};
  let i = 0;
  for (; i < Math.min(lines.length, 12); i++) {
    const m = /^(from|od|от|von|to|do|кому|an|subject|temat|тема|betreff|date|data|дата|datum)\s*:\s*(.+)$/i.exec(lines[i].trim());
    if (!m) break;
    head[m[1].toLowerCase()] = m[2].trim();
  }
  const fromRaw = head.from || head.od || head["от"] || head.von || "";
  const addr = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.exec(fromRaw)?.[0]?.toLowerCase() || null;
  const name = fromRaw.replace(/<[^>]*>/, "").replace(addr || "", "").replace(/["']/g, "").trim() || null;
  const dateRaw = head.date || head.data || head["дата"] || head.datum;
  const body = i > 0 ? lines.slice(i).join("\n") : text;
  return {
    fromAddr: addr,
    fromName: name,
    toAddr: /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.exec(head.to || head.do || head["кому"] || head.an || "")?.[0]?.toLowerCase() || null,
    subject: head.subject || head.temat || head["тема"] || head.betreff || (i === 0 ? null : null) || label || null,
    date: dateRaw ? parseLooseDate(dateRaw) ?? (isNaN(Date.parse(dateRaw)) ? null : new Date(dateRaw)) : null,
    body: cleanBody(body),
  };
}

export async function parsePdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}

// ---------- Диспетчер ----------

function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 4000);
  let zeros = 0;
  for (let i = 0; i < n; i++) if (buf[i] === 0) zeros++;
  return zeros > 2;
}

export async function parseFile(name: string, buf: Buffer, opts: { myWhatsAppNames: string[]; depth?: number }): Promise<ParseResult> {
  const ext = extOf(name);
  const res: ParseResult = { format: ext, messages: [], tasks: [], errors: [] };
  if (!SUPPORTED_EXT.includes(ext)) {
    res.errors.push(`Формат «.${ext || "?"}» не поддерживается. Поддерживаются: ${SUPPORTED_EXT.join(", ")}`);
    return res;
  }
  if (buf.length > MAX_FILE_BYTES) {
    res.errors.push(`Файл больше ${MAX_FILE_BYTES / 1024 / 1024} МБ`);
    return res;
  }
  if (buf.length === 0) {
    res.errors.push("Пустой файл");
    return res;
  }
  try {
    switch (ext) {
      case "eml":
        if (looksBinary(buf)) throw new Error("файл не похож на письмо (двоичные данные)");
        res.messages.push(await parseEml(buf));
        break;
      case "mbox":
        res.messages.push(...(await parseMbox(buf, res.errors)));
        break;
      case "csv":
        return { ...parseCsv(buf.toString("utf8")), format: "csv" };
      case "xlsx":
        if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("файл не является XLSX (неверная сигнатура)");
        return await parseXlsx(buf);
      case "json":
        return parseJson(buf.toString("utf8"));
      case "txt": {
        if (looksBinary(buf)) throw new Error("файл не является текстовым");
        const text = buf.toString("utf8").replace(/^﻿/, "");
        if (isWhatsApp(text)) {
          res.format = "whatsapp";
          res.messages.push(...parseWhatsApp(text, name, opts.myWhatsAppNames));
        } else res.messages.push(parsePlainText(text, name.replace(/\.txt$/i, "")));
        break;
      }
      case "pdf": {
        if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("файл не является PDF (неверная сигнатура)");
        const text = await parsePdf(buf);
        if (text.replace(/\s/g, "").length < 20)
          throw new Error("в PDF нет извлекаемого текста (возможно, это скан). Такой файл нельзя надёжно прочитать.");
        res.messages.push({ subject: name.replace(/\.pdf$/i, ""), body: cleanBody(text), date: null });
        break;
      }
      case "zip": {
        if ((opts.depth ?? 0) > 0) throw new Error("вложенные ZIP-архивы не поддерживаются");
        if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("файл не является ZIP (неверная сигнатура)");
        const zip = await JSZip.loadAsync(buf);
        const entries = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith("__MACOSX/"));
        if (entries.length > MAX_ZIP_ENTRIES) throw new Error(`слишком много файлов в архиве (> ${MAX_ZIP_ENTRIES})`);
        let total = 0;
        for (const entry of entries) {
          const sub = extOf(entry.name);
          if (!SUPPORTED_EXT.includes(sub) || sub === "zip") {
            res.errors.push(`${entry.name}: пропущен (формат не поддерживается)`);
            continue;
          }
          const data = await entry.async("nodebuffer");
          total += data.length;
          if (total > MAX_ZIP_UNCOMPRESSED) throw new Error("архив слишком большой после распаковки");
          const r = await parseFile(entry.name.split("/").pop() || entry.name, data, { ...opts, depth: 1 });
          res.messages.push(...r.messages);
          res.tasks.push(...r.tasks);
          res.errors.push(...r.errors.map((e) => `${entry.name}: ${e}`));
        }
        break;
      }
    }
  } catch (e) {
    res.errors.push(`Ошибка чтения: ${(e as Error).message}`);
  }
  return res;
}
