// Архив: полная резервная копия, восстановление, CSV, отчёт и контекст для Claude.

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import Papa from "papaparse";
import { closeDb, dataDir, getDb, logActivity, nowIso } from "./db";
import { CATEGORIES, PRIORITIES, RETURN_STAGES, COMPLAINT_STAGES, SOURCES, STATUSES, RETURN_CATEGORIES, COMPLAINT_CATEGORIES } from "./constants";
import { dashboardStats, listTasks, possiblyMissed, sourcesOverview, startOfToday, type Task } from "./tasks";

const TABLES = ["settings", "imports", "messages", "tasks", "task_messages", "notes", "activity", "thread_flags"] as const;
const SECRET_SETTINGS = /^(secret|token|api_key)/i;
export const APP_VERSION = "0.1.0";

export type Backup = {
  format: "workcontrol-backup";
  version: 1;
  app_version: string;
  created_at: string;
  sources_included: string[];
  counts: Record<string, number>;
  tables: Record<string, Record<string, unknown>[]>;
};

export function createBackup(): Backup {
  const db = getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
  tables.settings = tables.settings.filter((r) => !SECRET_SETTINGS.test(String(r.key)));
  const sources = (db.prepare("SELECT DISTINCT source FROM messages").all() as { source: string }[]).map((r) => r.source);
  return {
    format: "workcontrol-backup",
    version: 1,
    app_version: APP_VERSION,
    created_at: nowIso(),
    sources_included: sources,
    counts: Object.fromEntries(TABLES.map((t) => [t, tables[t].length])),
    tables,
  };
}

function stamp(d = new Date()): string {
  return d.toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
}

export function backupFilename(ext: string): string {
  return `workcontrol-backup-${stamp()}.${ext}`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  return "﻿" + Papa.unparse(rows);
}

export function tasksCsv(tasks?: Task[]): string {
  const list = tasks ?? listTasks({ view: "all", limit: 2000 });
  return toCsv(
    list.map((t) => ({
      id: t.id,
      "Название": t.title,
      "Категория": CATEGORIES[t.category as keyof typeof CATEGORIES] ?? t.category,
      "Источник": SOURCES[t.source as keyof typeof SOURCES] ?? t.source ?? "",
      "Клиент": t.customer_name ?? "",
      "Контакт": t.customer_contact ?? "",
      "Заказ": t.order_number ?? "",
      "Описание": t.summary ?? "",
      "Приоритет": PRIORITIES[t.priority as keyof typeof PRIORITIES] ?? t.priority,
      "Статус": STATUSES[t.status as keyof typeof STATUSES] ?? t.status,
      "Этап": t.stage ?? "",
      "Следующее действие": t.next_action ?? "",
      "Дедлайн": t.deadline ?? "",
      "Последнее сообщение": t.last_message_at ?? "",
      "Создано": t.created_at,
      "Выполнено": t.completed_at ?? "",
      "Демо": t.is_demo ? "да" : "",
    })),
  );
}

export function messagesCsv(): string {
  const rows = getDb()
    .prepare("SELECT id, source, direction, from_name, from_addr, to_addr, subject, sent_at, order_numbers, tracking_numbers, body, is_demo FROM messages ORDER BY COALESCE(sent_at, created_at)")
    .all() as Record<string, unknown>[];
  return toCsv(rows);
}

export async function createZip(): Promise<Buffer> {
  const backup = createBackup();
  const zip = new JSZip();
  zip.file("backup.json", JSON.stringify(backup));
  zip.file("tasks.csv", tasksCsv());
  zip.file("messages.csv", messagesCsv());
  zip.file("notes.csv", toCsv(backup.tables.notes));
  zip.file("activity.csv", toCsv(backup.tables.activity));
  zip.file("report.md", reportMarkdown());
  zip.file("claude-context.md", claudeContext({ maskPii: false }));
  zip.file(
    "README.txt",
    `WorkControl AI — резервная копия\nСоздана: ${backup.created_at}\n\n` +
      `Для восстановления: Архив → Восстановить из копии → выберите этот ZIP или backup.json.\n` +
      `Источники с данными: ${backup.sources_included.join(", ") || "нет"}\n` +
      Object.entries(backup.counts).map(([k, v]) => `${k}: ${v}`).join("\n"),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function readBackupFile(name: string, buf: Buffer): Promise<Backup> {
  let text: string;
  if (/\.zip$/i.test(name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    const zip = await JSZip.loadAsync(buf);
    const entry = zip.file("backup.json");
    if (!entry) throw new Error("В ZIP нет файла backup.json — это не резервная копия WorkControl");
    text = await entry.async("string");
  } else text = buf.toString("utf8");
  let data: Backup;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Файл повреждён: некорректный JSON");
  }
  if (data?.format !== "workcontrol-backup" || data.version !== 1 || typeof data.tables !== "object")
    throw new Error("Это не резервная копия WorkControl (неизвестный формат)");
  for (const t of ["tasks", "messages"]) if (!Array.isArray(data.tables[t])) throw new Error(`В копии нет таблицы ${t}`);
  return data;
}

/** Полное восстановление. Перед ним текущие данные автоматически сохраняются в data/backups. */
export function restoreBackup(data: Backup): { safetyCopy: string; counts: Record<string, number> } {
  const safetyCopy = saveSnapshot("before-restore");
  const db = getDb();
  const cols = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
  const counts: Record<string, number> = {};
  db.transaction(() => {
    for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
    for (const t of TABLES) {
      const rows = data.tables[t] ?? [];
      const allowed = cols(t);
      counts[t] = 0;
      for (const r of rows) {
        const keys = Object.keys(r).filter((k) => allowed.includes(k));
        if (!keys.length) continue;
        db.prepare(`INSERT OR REPLACE INTO ${t}(${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(
          ...keys.map((k) => (r[k] === undefined ? null : (r[k] as string | number | null))),
        );
        counts[t]++;
      }
    }
    db.exec("INSERT INTO messages_fts(messages_fts) VALUES ('rebuild'); INSERT INTO tasks_fts(tasks_fts) VALUES ('rebuild');");
  })();
  logActivity(null, "restore", `Восстановлено из копии от ${data.created_at}. Предыдущие данные сохранены: ${safetyCopy}`);
  return { safetyCopy, counts };
}

export function backupsDir(): string {
  const d = path.join(dataDir(), "backups");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function saveSnapshot(label = "manual"): string {
  const name = `workcontrol-${label}-${stamp()}.json`;
  fs.writeFileSync(path.join(backupsDir(), name), JSON.stringify(createBackup()), { mode: 0o600 });
  return name;
}

export function listSnapshots() {
  return fs
    .readdirSync(backupsDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const st = fs.statSync(path.join(backupsDir(), f));
      return { name: f, size: st.size, created_at: st.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function snapshotPath(name: string): string | null {
  if (!/^[\w.-]+\.json$/.test(name)) return null;
  const p = path.join(backupsDir(), name);
  return fs.existsSync(p) ? p : null;
}

/** Автоматическая ежедневная копия (хранятся последние 14). Вызывается при открытии главной. */
export function autoDailyBackup() {
  const today = new Date().toISOString().slice(0, 10);
  const files = listSnapshots().filter((s) => s.name.startsWith("workcontrol-auto-"));
  if (files.some((f) => f.name.includes(today))) return;
  const db = getDb();
  if (!(db.prepare("SELECT COUNT(*) c FROM tasks").get() as { c: number }).c) return;
  saveSnapshot("auto");
  for (const old of files.slice(13)) fs.rmSync(path.join(backupsDir(), old.name), { force: true });
}

export function wipeAll() {
  const db = getDb();
  saveSnapshot("before-wipe");
  db.transaction(() => {
    for (const t of TABLES) if (t !== "settings") db.prepare(`DELETE FROM ${t}`).run();
    db.prepare("DELETE FROM settings WHERE key LIKE 'source_last_import:%'").run();
    db.exec("INSERT INTO messages_fts(messages_fts) VALUES ('rebuild'); INSERT INTO tasks_fts(tasks_fts) VALUES ('rebuild');");
  })();
}

export { closeDb };

// ---------- Отчёты ----------

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—");

function taskLine(t: Task, maskPii = false): string {
  const parts = [
    `[T${t.id}] ${t.title}`,
    t.order_number ? `заказ ${t.order_number}` : null,
    t.customer_name ? `клиент: ${maskPii ? mask(t.customer_name) : t.customer_name}` : null,
    SOURCES[t.source as keyof typeof SOURCES] ?? t.source,
    PRIORITIES[t.priority as keyof typeof PRIORITIES],
    STATUSES[t.status as keyof typeof STATUSES],
    t.stage ? `этап: ${(RETURN_STAGES as Record<string, string>)[t.stage] ?? (COMPLAINT_STAGES as Record<string, string>)[t.stage] ?? t.stage}` : null,
    t.deadline ? `дедлайн ${fmt(t.deadline)}` : null,
    t.needs_reply ? "возможно, клиент ожидает ответа" : null,
  ].filter(Boolean);
  return `- ${parts.join(" · ")}${t.summary ? `\n  ${maskPii ? maskText(t.summary) : t.summary}` : ""}`;
}

function mask(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w.length > 1 ? w[0] + "." : w))
    .join(" ");
}
export function maskText(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]")
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, "[телефон]")
    .replace(/\b[A-Z]{2}\d{2}(?:\s?\d{4}){4,7}\b/g, "[IBAN]");
}

export function reportMarkdown(): string {
  const s = dashboardStats();
  const active = listTasks({ view: "active", limit: 2000 });
  const doneToday = listTasks({ preset: "done_today", view: "done" });
  const created = nowIso();
  const by = (cats: string[]) => active.filter((t) => cats.includes(t.category));
  const lines = [
    `# Отчёт WorkControl AI`,
    ``,
    `Создан: ${fmt(created)} (${created})`,
    ``,
    `## Сводка`,
    `- Активных задач: ${s.active}`,
    `- Срочных: ${s.urgent}`,
    `- Требуют ответа: ${s.needs_reply}`,
    `- Ожидают клиента / третьей стороны: ${s.waiting}`,
    `- Проблемы с доставкой: ${s.delivery}`,
    `- Открытые возвраты: ${s.returns}`,
    `- Выполнено сегодня: ${s.done_today}`,
    `- Возможно пропущенные переписки: ${s.missed}`,
    ``,
    `## Выполнено сегодня`,
    ...(doneToday.length ? doneToday.map((t) => `- [T${t.id}] ${t.title}${t.order_number ? ` · заказ ${t.order_number}` : ""}`) : ["- нет"]),
    ``,
    `## Срочные и критические`,
    ...listOrNone(active.filter((t) => t.status === "open" && (t.priority === "critical" || t.priority === "high")).map((t) => taskLine(t))),
    ``,
    `## Рекламации и перевозчики`,
    ...listOrNone(by(COMPLAINT_CATEGORIES).map((t) => taskLine(t))),
    ``,
    `## Возвраты`,
    ...listOrNone(by(RETURN_CATEGORIES).map((t) => taskLine(t))),
    ``,
    `## Остальные открытые задачи`,
    ...listOrNone(
      active.filter((t) => ![...COMPLAINT_CATEGORIES, ...RETURN_CATEGORIES].includes(t.category) && !(t.status === "open" && ["critical", "high"].includes(t.priority))).map((t) => taskLine(t)),
    ),
    ``,
    `---`,
    `Отчёт построен только по данным, загруженным в WorkControl AI. ${sourcesNote()}`,
  ];
  return lines.join("\n");
}

function listOrNone(l: string[]): string[] {
  return l.length ? l : ["- нет"];
}

function sourcesNote(): string {
  const src = sourcesOverview();
  const withData = src.filter((s) => s.messages > 0 || s.last_import_at);
  const without = src.filter((s) => !(s.messages > 0 || s.last_import_at) && !["manual", "other", "website", "reseller"].includes(s.id));
  return (
    `Источники с данными: ${withData.map((s) => `${s.label} (последний импорт ${fmt(s.last_import_at)})`).join(", ") || "нет"}. ` +
    (without.length ? `Нет данных из: ${without.map((s) => s.label).join(", ")}.` : "")
  );
}

/** Структурированная сводка для вставки в чат с Claude (вручную). */
export function claudeContext({ maskPii }: { maskPii: boolean }): string {
  const created = nowIso();
  const db = getDb();
  const active = listTasks({ view: "active", limit: 300 });
  const recent = db
    .prepare("SELECT a.*, t.title FROM activity a LEFT JOIN tasks t ON t.id = a.task_id WHERE a.created_at >= ? ORDER BY a.created_at DESC LIMIT 60")
    .all(new Date(Date.now() - 48 * 36e5).toISOString()) as { task_id: number | null; action: string; details: string; created_at: string; title: string | null }[];
  const missed = possiblyMissed().slice(0, 30);
  const out: string[] = [
    `# Контекст рабочего дня (WorkControl AI)`,
    ``,
    `Сформировано: ${created}. Сегодня с: ${startOfToday()}.`,
    maskPii ? `Персональные данные (e-mail, телефоны, фамилии) замаскированы.` : `ВНИМАНИЕ: содержит персональные данные клиентов. Передавайте во внешние сервисы только с разрешения работодателя.`,
    ``,
    `## Источники`,
    sourcesNote(),
    ``,
    `## Открытые задачи (${active.length})`,
    ...listOrNone(active.map((t) => taskLine(t, maskPii))),
    ``,
    `## Возможно пропущенные переписки (${missed.length})`,
    ...listOrNone(
      missed.map(
        (m) =>
          `- [M${m.last_id}] ${SOURCES[m.source as keyof typeof SOURCES] ?? m.source} · ${fmt(m.last_at)} · ${maskPii ? "[отправитель]" : m.from_name || m.from_addr || "?"}: ${m.subject ?? ""}\n  ${(maskPii ? maskText(m.snippet) : m.snippet).replace(/\s+/g, " ").slice(0, 200)}`,
      ),
    ),
    ``,
    `## Действия за последние 48 часов`,
    ...listOrNone(recent.map((a) => `- ${fmt(a.created_at)} · ${a.task_id ? `[T${a.task_id}] ${a.title ?? ""} — ` : ""}${maskPii ? maskText(a.details ?? a.action) : a.details ?? a.action}`)),
    ``,
    `## Как использовать`,
    `Вставьте этот текст в Claude и спросите, например: «Составь план на сегодня по приоритетам» или «Подготовь ответы клиентам по задачам T…». ` +
      `Данные ограничены тем, что было импортировано в приложение.`,
  ];
  return out.join("\n");
}
