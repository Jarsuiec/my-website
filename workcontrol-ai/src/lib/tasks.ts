// Задачи: выборки для интерфейса, действия со статусами, заметки, поиск.

import { getDb, logActivity, nowIso } from "./db";
import {
  CATEGORIES,
  COMPLAINT_CATEGORIES,
  DELIVERY_CATEGORIES,
  PRIORITIES,
  RETURN_CATEGORIES,
  SOURCES,
  STATUSES,
} from "./constants";
import { isAutomatedSender, suggestPriority, classify } from "./rules";
import type { MessageRow } from "./ingest";

export type Task = {
  id: number;
  dedup_key: string | null;
  title: string;
  category: string;
  source: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  order_number: string | null;
  summary: string | null;
  priority: string;
  priority_locked: number;
  status: string;
  status_changed_at: string | null;
  stage: string | null;
  next_action: string | null;
  deadline: string | null;
  snoozed_until: string | null;
  thread_key: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_reply_at: string | null;
  origin: string;
  edited_fields: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // вычисляемые
  needs_reply?: number;
  history_incomplete?: number;
  notes_count?: number;
  messages_count?: number;
};

export const NEEDS_REPLY_SQL = `(t.status = 'open' AND t.last_inbound_at IS NOT NULL
  AND (t.last_outbound_at IS NULL OR t.last_inbound_at > t.last_outbound_at)
  AND (t.last_reply_at IS NULL OR t.last_inbound_at > t.last_reply_at))`;

const SELECT_TASK = `SELECT t.*,
  ${NEEDS_REPLY_SQL} AS needs_reply,
  (t.last_outbound_at IS NULL AND t.last_reply_at IS NULL AND t.thread_key IS NOT NULL) AS history_incomplete,
  (SELECT COUNT(*) FROM notes n WHERE n.task_id = t.id) AS notes_count,
  (SELECT COUNT(*) FROM task_messages tm WHERE tm.task_id = t.id) AS messages_count
  FROM tasks t`;

const PRIORITY_RANK = `CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`;

export function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
export function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Отложенные задачи, срок которых наступил, возвращаются в работу. */
export function wakeSnoozed() {
  const db = getDb();
  const now = nowIso();
  const rows = db.prepare("SELECT id FROM tasks WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?").all(now) as { id: number }[];
  if (!rows.length) return;
  db.transaction(() => {
    for (const r of rows) {
      db.prepare("UPDATE tasks SET status = 'open', snoozed_until = NULL, status_changed_at = ?, updated_at = ? WHERE id = ?").run(now, now, r.id);
      logActivity(r.id, "woke", "Вернулась из отложенных");
    }
  })();
}

/** Автоприоритет пересчитывается для незаблокированных задач (учитывает, сколько клиент ждёт). */
export function refreshAutoPriorities() {
  const db = getDb();
  const rows = db
    .prepare(`SELECT t.id, t.category, t.priority, t.last_inbound_at, ${NEEDS_REPLY_SQL} AS needs_reply, t.thread_key FROM tasks t
      WHERE t.status != 'done' AND t.priority_locked = 0 AND t.origin = 'auto'`)
    .all() as { id: number; category: string; priority: string; last_inbound_at: string | null; needs_reply: number; thread_key: string | null }[];
  const upd = db.prepare("UPDATE tasks SET priority = ? WHERE id = ?");
  db.transaction(() => {
    for (const r of rows) {
      let critical = false;
      if (r.thread_key) {
        const last = db
          .prepare("SELECT subject, body, from_addr FROM messages WHERE thread_key = ? AND direction != 'out' ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 5")
          .all(r.thread_key) as { subject: string; body: string; from_addr: string }[];
        critical = last.some((m) => classify(m.subject, m.body, m.from_addr).critical);
      }
      const p = suggestPriority(r.category, { critical, waitingSince: r.needs_reply ? r.last_inbound_at : null });
      if (p !== r.priority) upd.run(p, r.id);
    }
  })();
}

export type TaskFilter = {
  view?: "active" | "all" | "done";
  preset?: string;
  source?: string;
  status?: string;
  priority?: string;
  category?: string;
  categories?: string[];
  q?: string;
  from?: string;
  to?: string;
  demo?: "only" | "hide";
  limit?: number;
};

export function ftsQuery(q: string): string | null {
  const tokens = q
    .replace(/["'*^():]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

export function listTasks(f: TaskFilter = {}): Task[] {
  wakeSnoozed();
  const db = getDb();
  const where: string[] = [];
  const p: Record<string, unknown> = {};
  const view = f.view ?? "active";
  if (view === "active") where.push("t.status != 'done'");
  if (view === "done") where.push("t.status = 'done'");
  if (f.status) {
    where.push("t.status = @status");
    p.status = f.status;
  }
  if (f.source) {
    where.push("t.source = @source");
    p.source = f.source;
  }
  if (f.priority) {
    where.push("t.priority = @priority");
    p.priority = f.priority;
  }
  const cats = f.categories ?? (f.category ? [f.category] : []);
  if (cats.length) {
    where.push(`t.category IN (${cats.map((_, i) => `@cat${i}`).join(",")})`);
    cats.forEach((c, i) => (p[`cat${i}`] = c));
  }
  if (f.from) {
    where.push("COALESCE(t.last_message_at, t.created_at) >= @from");
    p.from = new Date(f.from).toISOString();
  }
  if (f.to) {
    const d = new Date(f.to);
    d.setHours(23, 59, 59, 999);
    where.push("COALESCE(t.last_message_at, t.created_at) <= @to");
    p.to = d.toISOString();
  }
  if (f.demo === "only") where.push("t.is_demo = 1");
  if (f.demo === "hide") where.push("t.is_demo = 0");
  switch (f.preset) {
    case "urgent":
      where.push("t.status = 'open' AND (t.priority IN ('critical','high') OR (t.deadline IS NOT NULL AND t.deadline <= @eod))");
      p.eod = endOfToday();
      break;
    case "needs_reply":
      where.push(NEEDS_REPLY_SQL);
      break;
    case "waiting":
      where.push("t.status = 'waiting'");
      break;
    case "delivery":
      where.push(`t.status != 'done' AND t.category IN (${DELIVERY_CATEGORIES.map((c) => `'${c}'`).join(",")})`);
      break;
    case "returns":
      where.push(`t.status != 'done' AND t.category IN (${RETURN_CATEGORIES.map((c) => `'${c}'`).join(",")})`);
      break;
    case "done_today":
      where.push("t.status = 'done' AND t.completed_at >= @sod");
      p.sod = startOfToday();
      break;
    case "yesterday":
      where.push("t.status != 'done' AND t.created_at < @sod");
      p.sod = startOfToday();
      break;
  }
  if (f.q?.trim()) {
    const fts = ftsQuery(f.q);
    const like = `%${f.q.trim().replace(/^#/, "")}%`;
    where.push(`(t.id IN (SELECT rowid FROM tasks_fts WHERE tasks_fts MATCH @fts)
      OR t.id IN (SELECT task_id FROM notes WHERE body LIKE @like)
      OR t.id IN (SELECT tm.task_id FROM task_messages tm WHERE tm.message_id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH @fts))
      OR t.order_number LIKE @like)`);
    p.fts = fts ?? '""';
    p.like = like;
  }
  const order =
    view === "done" || f.preset === "done_today"
      ? "t.completed_at DESC"
      : `CASE WHEN t.status = 'open' THEN 0 WHEN t.status = 'waiting' THEN 1 ELSE 2 END, ${PRIORITY_RANK},
         (t.deadline IS NULL), t.deadline, COALESCE(t.last_inbound_at, t.created_at) ASC`;
  const sql = `${SELECT_TASK} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ${Math.min(f.limit ?? 500, 2000)}`;
  return db.prepare(sql).all(p) as Task[];
}

export function getTask(id: number) {
  const db = getDb();
  const task = db.prepare(`${SELECT_TASK} WHERE t.id = ?`).get(id) as Task | undefined;
  if (!task) return null;
  const linked = db
    .prepare(
      `SELECT m.* FROM messages m WHERE m.id IN (SELECT message_id FROM task_messages WHERE task_id = ?)
       OR (m.thread_key = ? AND ? IS NOT NULL) ORDER BY COALESCE(m.sent_at, m.created_at), m.id`,
    )
    .all(id, task.thread_key, task.thread_key) as MessageRow[];
  const notes = db.prepare("SELECT * FROM notes WHERE task_id = ? ORDER BY created_at DESC").all(id);
  const activity = db.prepare("SELECT * FROM activity WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 200").all(id);
  return { task, messages: linked, notes, activity };
}

export type StatusAction = "done" | "replied" | "waiting" | "snooze" | "reopen";

const ACTION_LABEL: Record<StatusAction, string> = {
  done: "Отмечено: выполнено",
  replied: "Отмечено: ответил клиенту",
  waiting: "Отмечено: ожидаю",
  snooze: "Отложено",
  reopen: "Возвращено в работу",
};

export function applyAction(id: number, action: StatusAction, until?: string | null) {
  const db = getDb();
  const t = db.prepare("SELECT id, status FROM tasks WHERE id = ?").get(id) as { id: number; status: string } | undefined;
  if (!t) throw new Error("Задача не найдена");
  const now = nowIso();
  switch (action) {
    case "done":
      db.prepare("UPDATE tasks SET status = 'done', completed_at = ?, snoozed_until = NULL, status_changed_at = ?, updated_at = ? WHERE id = ?").run(now, now, now, id);
      break;
    case "replied":
      db.prepare("UPDATE tasks SET status = 'waiting', last_reply_at = ?, snoozed_until = NULL, status_changed_at = ?, updated_at = ? WHERE id = ?").run(now, now, now, id);
      break;
    case "waiting":
      db.prepare("UPDATE tasks SET status = 'waiting', snoozed_until = NULL, status_changed_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
      break;
    case "snooze": {
      const d = until ? new Date(until) : null;
      if (!d || isNaN(d.getTime()) || d.getTime() <= Date.now()) throw new Error("Укажите время в будущем");
      db.prepare("UPDATE tasks SET status = 'snoozed', snoozed_until = ?, status_changed_at = ?, updated_at = ? WHERE id = ?").run(d.toISOString(), now, now, id);
      break;
    }
    case "reopen":
      db.prepare("UPDATE tasks SET status = 'open', completed_at = NULL, snoozed_until = NULL, status_changed_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
      break;
    default:
      throw new Error("Неизвестное действие");
  }
  logActivity(id, action, action === "snooze" && until ? `${ACTION_LABEL[action]} до ${new Date(until).toLocaleString("ru-RU")}` : ACTION_LABEL[action]);
}

const EDITABLE = ["title", "category", "source", "customer_name", "customer_contact", "order_number", "summary", "priority", "next_action", "deadline", "stage"] as const;

export function updateTask(id: number, patch: Record<string, unknown>) {
  const db = getDb();
  const t = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;
  if (!t) throw new Error("Задача не найдена");
  const edited = new Set(JSON.parse(t.edited_fields) as string[]);
  const sets: string[] = [];
  const vals: Record<string, unknown> = { id };
  const changes: string[] = [];
  for (const k of EDITABLE) {
    if (!(k in patch)) continue;
    let v = patch[k] === "" ? null : (patch[k] as string | null);
    if (typeof v === "string") v = v.slice(0, 5000);
    if (k === "title" && !v) throw new Error("Название не может быть пустым");
    if (k === "category" && v && !(v in CATEGORIES)) throw new Error("Неизвестная категория");
    if (k === "source" && v && !(v in SOURCES)) throw new Error("Неизвестный источник");
    if (k === "priority") {
      if (v === "auto") {
        sets.push("priority_locked = 0");
        changes.push("приоритет: автоматически");
        continue;
      }
      if (!v || !(v in PRIORITIES)) throw new Error("Неизвестный приоритет");
      sets.push("priority_locked = 1");
    }
    if (k === "deadline" && v && isNaN(Date.parse(v))) throw new Error("Некорректная дата дедлайна");
    if ((t as unknown as Record<string, unknown>)[k] === v) continue;
    sets.push(`${k} = @${k}`);
    vals[k] = v;
    edited.add(k);
    changes.push(k);
  }
  if (!sets.length) return;
  sets.push("edited_fields = @edited", "updated_at = @now");
  vals.edited = JSON.stringify([...edited]);
  vals.now = nowIso();
  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = @id`).run(vals);
  if (patch.priority === "auto") refreshAutoPriorities();
  logActivity(id, "edited", `Изменено: ${changes.join(", ")}`);
}

export function addNote(taskId: number, body: string) {
  const text = body.trim().slice(0, 10000);
  if (!text) throw new Error("Пустая заметка");
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM tasks WHERE id = ?").get(taskId)) throw new Error("Задача не найдена");
  const now = nowIso();
  db.prepare("INSERT INTO notes(task_id, body, created_at) VALUES (?, ?, ?)").run(taskId, text, now);
  db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").run(now, taskId);
  logActivity(taskId, "note", text.length > 80 ? text.slice(0, 80) + "…" : text);
}

export function createTask(data: Record<string, unknown>, opts: { isDemo?: boolean; messageId?: number } = {}): number {
  const db = getDb();
  const title = String(data.title ?? "").trim();
  if (!title) throw new Error("Укажите название задачи");
  const category = String(data.category || "other");
  if (!(category in CATEGORIES)) throw new Error("Неизвестная категория");
  const source = String(data.source || "manual");
  if (!(source in SOURCES)) throw new Error("Неизвестный источник");
  const priorityRaw = String(data.priority || "auto");
  const locked = priorityRaw !== "auto";
  const priority = locked ? priorityRaw : suggestPriority(category, {});
  if (!(priority in PRIORITIES)) throw new Error("Неизвестный приоритет");
  const deadline = data.deadline ? String(data.deadline) : null;
  if (deadline && isNaN(Date.parse(deadline))) throw new Error("Некорректная дата дедлайна");
  const now = nowIso();
  let thread: string | null = null;
  let lastIn: string | null = null;
  if (opts.messageId) {
    const m = db.prepare("SELECT thread_key, sent_at, created_at, direction FROM messages WHERE id = ?").get(opts.messageId) as
      | { thread_key: string; sent_at: string | null; created_at: string; direction: string }
      | undefined;
    if (!m) throw new Error("Сообщение не найдено");
    thread = m.thread_key;
    if (m.direction !== "out") lastIn = m.sent_at ?? m.created_at;
  }
  const str = (k: string) => (data[k] ? String(data[k]).trim().slice(0, 5000) : null);
  const info = db
    .prepare(
      `INSERT INTO tasks(title, category, source, customer_name, customer_contact, order_number, summary, priority, priority_locked,
        status, status_changed_at, stage, next_action, deadline, thread_key, last_inbound_at, last_message_at, origin, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`,
    )
    .run(
      title.slice(0, 300),
      category,
      source,
      str("customer_name"),
      str("customer_contact"),
      str("order_number"),
      str("summary"),
      priority,
      locked ? 1 : 0,
      now,
      RETURN_CATEGORIES.includes(category) ? "requested" : COMPLAINT_CATEGORIES.includes(category) ? "new" : null,
      str("next_action"),
      deadline,
      thread,
      lastIn,
      lastIn,
      opts.isDemo ? 1 : 0,
      now,
      now,
    );
  const id = Number(info.lastInsertRowid);
  if (opts.messageId) db.prepare("INSERT OR IGNORE INTO task_messages(task_id, message_id) VALUES (?, ?)").run(id, opts.messageId);
  logActivity(id, "created", opts.messageId ? "Создана вручную из сообщения" : "Создана вручную");
  return id;
}

export function dashboardStats() {
  wakeSnoozed();
  refreshAutoPriorities();
  const db = getDb();
  const one = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { c: number }).c;
  const inList = (l: string[]) => l.map((c) => `'${c}'`).join(",");
  return {
    urgent: one(
      "SELECT COUNT(*) c FROM tasks t WHERE t.status = 'open' AND (t.priority IN ('critical','high') OR (t.deadline IS NOT NULL AND t.deadline <= ?))",
      endOfToday(),
    ),
    needs_reply: one(`SELECT COUNT(*) c FROM tasks t WHERE ${NEEDS_REPLY_SQL}`),
    waiting: one("SELECT COUNT(*) c FROM tasks t WHERE t.status = 'waiting'"),
    delivery: one(`SELECT COUNT(*) c FROM tasks t WHERE t.status != 'done' AND t.category IN (${inList(DELIVERY_CATEGORIES)})`),
    returns: one(`SELECT COUNT(*) c FROM tasks t WHERE t.status != 'done' AND t.category IN (${inList(RETURN_CATEGORIES)})`),
    done_today: one("SELECT COUNT(*) c FROM tasks t WHERE t.status = 'done' AND t.completed_at >= ?", startOfToday()),
    missed: possiblyMissed().length,
    yesterday: one("SELECT COUNT(*) c FROM tasks t WHERE t.status != 'done' AND t.created_at < ?", startOfToday()),
    active: one("SELECT COUNT(*) c FROM tasks t WHERE t.status != 'done'"),
    snoozed: one("SELECT COUNT(*) c FROM tasks t WHERE t.status = 'snoozed'"),
    messages: one("SELECT COUNT(*) c FROM messages"),
    has_my_addresses: !!(db.prepare("SELECT value FROM settings WHERE key = 'my_addresses'").get() as { value: string } | undefined)?.value?.trim(),
  };
}

export type ThreadSummary = {
  thread_key: string;
  last_id: number;
  last_at: string;
  last_direction: string;
  subject: string | null;
  from_name: string | null;
  from_addr: string | null;
  source: string;
  snippet: string;
  count: number;
  out_count: number;
  active_tasks: number;
  is_demo: number;
  dismissed_at: string | null;
};

/**
 * Переписки, где последнее сообщение — входящее от человека (не робота), ответа после него не видно,
 * и нет активной задачи. Это лишь «возможно пропущено»: история могла быть загружена не полностью.
 */
export function possiblyMissed(): ThreadSummary[] {
  return listThreads({ missedOnly: true, limit: 1000 });
}

export function listThreads(f: { q?: string; source?: string; missedOnly?: boolean; unansweredOnly?: boolean; limit?: number } = {}): ThreadSummary[] {
  const db = getDb();
  const where: string[] = ["l.rn = 1"];
  const p: Record<string, unknown> = {};
  if (f.source) {
    where.push("l.thread_key IN (SELECT thread_key FROM messages WHERE source = @source)");
    p.source = f.source;
  }
  if (f.q?.trim()) {
    where.push("l.thread_key IN (SELECT thread_key FROM messages WHERE id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH @fts))");
    p.fts = ftsQuery(f.q) ?? '""';
  }
  if (f.unansweredOnly || f.missedOnly) where.push("l.direction != 'out'");
  if (f.missedOnly) {
    where.push(`NOT EXISTS (SELECT 1 FROM tasks t WHERE t.thread_key = l.thread_key
       AND (t.status != 'done' OR t.completed_at >= COALESCE(l.sent_at, l.created_at)))`);
    where.push("(tf.dismissed_at IS NULL OR tf.dismissed_at < COALESCE(l.sent_at, l.created_at))");
  }
  const rows = db
    .prepare(
      `WITH l AS (
        SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.thread_key ORDER BY COALESCE(m.sent_at, m.created_at) DESC, m.id DESC) rn,
               COUNT(*) OVER (PARTITION BY m.thread_key) cnt,
               SUM(CASE WHEN m.direction = 'out' THEN 1 ELSE 0 END) OVER (PARTITION BY m.thread_key) outs
        FROM messages m)
      SELECT l.thread_key, l.id AS last_id, COALESCE(l.sent_at, l.created_at) AS last_at, l.direction AS last_direction,
        l.subject, l.from_name, l.from_addr, l.source, substr(l.body, 1, 300) AS snippet, l.cnt AS count, l.outs AS out_count, l.is_demo,
        (SELECT COUNT(*) FROM tasks t WHERE t.thread_key = l.thread_key AND t.status != 'done') AS active_tasks,
        tf.dismissed_at
      FROM l LEFT JOIN thread_flags tf ON tf.thread_key = l.thread_key
      WHERE ${where.join(" AND ")}
      ORDER BY last_at DESC LIMIT ${Math.min(f.limit ?? 300, 2000)}`,
    )
    .all(p) as ThreadSummary[];
  return f.missedOnly ? rows.filter((r) => !isAutomatedSender(r.from_addr)) : rows;
}

export function getThread(threadKey: string) {
  const db = getDb();
  const messages = db
    .prepare("SELECT * FROM messages WHERE thread_key = ? ORDER BY COALESCE(sent_at, created_at), id")
    .all(threadKey) as MessageRow[];
  const tasks = db.prepare(`${SELECT_TASK} WHERE t.thread_key = ? ORDER BY t.created_at`).all(threadKey) as Task[];
  const flag = db.prepare("SELECT dismissed_at FROM thread_flags WHERE thread_key = ?").get(threadKey) as { dismissed_at: string } | undefined;
  return { messages, tasks, dismissed_at: flag?.dismissed_at ?? null };
}

export function dismissThread(threadKey: string) {
  getDb()
    .prepare("INSERT INTO thread_flags(thread_key, dismissed_at) VALUES (?, ?) ON CONFLICT(thread_key) DO UPDATE SET dismissed_at = excluded.dismissed_at")
    .run(threadKey, nowIso());
  logActivity(null, "dismissed", `Переписка отмечена как не требующая ответа: ${threadKey}`);
}

export function searchAll(q: string) {
  const db = getDb();
  const fts = ftsQuery(q);
  const tasks = listTasks({ view: "all", q, limit: 100 });
  const messages = fts
    ? (db
        .prepare(
          `SELECT m.id, m.thread_key, m.source, m.direction, m.from_name, m.from_addr, m.subject, COALESCE(m.sent_at, m.created_at) AS at,
             snippet(messages_fts, 1, '«', '»', '…', 24) AS snippet, m.order_numbers
           FROM messages_fts JOIN messages m ON m.id = messages_fts.rowid
           WHERE messages_fts MATCH ? ORDER BY at DESC LIMIT 100`,
        )
        .all(fts) as Record<string, unknown>[])
    : [];
  return { tasks, messages };
}

export function sourcesOverview() {
  const db = getDb();
  const counts = db.prepare("SELECT source, COUNT(*) c, MAX(COALESCE(sent_at, created_at)) last_msg FROM messages GROUP BY source").all() as {
    source: string;
    c: number;
    last_msg: string;
  }[];
  const imports = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'source_last_import:%'").all() as { key: string; value: string }[];
  const last = Object.fromEntries(imports.map((r) => [r.key.split(":")[1], r.value]));
  return Object.keys(SOURCES).map((id) => {
    const c = counts.find((x) => x.source === id);
    return { id, label: SOURCES[id as keyof typeof SOURCES], messages: c?.c ?? 0, last_message_at: c?.last_msg ?? null, last_import_at: last[id] ?? null };
  });
}

export { STATUSES };
