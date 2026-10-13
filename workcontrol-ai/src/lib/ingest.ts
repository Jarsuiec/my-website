// Сохранение импортированных сообщений без дубликатов и автоматическое создание/обновление задач.

import crypto from "node:crypto";
import { getDb, getSetting, logActivity, nowIso, setSetting } from "./db";
import type { ParseResult, RawMessage, ManualTaskRow } from "./parsers";
import {
  classify,
  detectSource,
  extractOrderNumbers,
  extractTrackingNumbers,
  isAutomatedSender,
  normalizeSubject,
  suggestPriority,
  summarize,
} from "./rules";
import { CATEGORY_NEXT_ACTION, CATEGORY_TASK_TITLES, PRIORITIES, RETURN_CATEGORIES, SOURCES } from "./constants";

export type ImportSummary = {
  importId: number;
  filename: string;
  format: string;
  added: number;
  duplicates: number;
  tasksCreated: number;
  tasksUpdated: number;
  tasksReopened: number;
  errors: string[];
};

export type MessageRow = {
  id: number;
  fingerprint: string;
  source: string;
  mailbox: string | null;
  external_id: string | null;
  thread_key: string;
  direction: "in" | "out" | "unknown";
  direction_hint: string | null;
  counterparty: string | null;
  norm_subject: string | null;
  from_name: string | null;
  from_addr: string | null;
  to_addr: string | null;
  subject: string | null;
  sent_at: string | null;
  body: string;
  order_numbers: string;
  tracking_numbers: string;
  categories: string;
  is_demo: number;
  created_at: string;
};

export function myAddresses(): string[] {
  return getSetting("my_addresses")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function myWhatsAppNames(): string[] {
  return getSetting("my_whatsapp_names")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isMine(addr: string | null | undefined, mine: string[]): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return mine.some((m) => (m.startsWith("@") ? a.endsWith(m) : a === m));
}

export function computeDirection(fromAddr: string | null, mine: string[]): "in" | "out" | "unknown" {
  if (!mine.length) return "unknown";
  return isMine(fromAddr, mine) ? "out" : "in";
}

function normalizeSourceHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const h = hint.toLowerCase().trim();
  if (h in SOURCES) return h;
  if (/mail|gmail|poczta/.test(h)) return "gmail";
  if (/allegro/.test(h)) return "allegro";
  if (/decathlon|mirakl/.test(h)) return "decathlon";
  if (/etsy/.test(h)) return "etsy";
  if (/whats/.test(h)) return "whatsapp";
  if (/shopify/.test(h)) return "shopify";
  if (/apilo/.test(h)) return "apilo";
  if (/^ups/.test(h)) return "ups";
  if (/^dpd/.test(h)) return "dpd";
  return "other";
}

export function fingerprintOf(raw: RawMessage): string {
  if (raw.externalId) return "mid:" + raw.externalId.trim().toLowerCase().replace(/^<|>$/g, "");
  const parts = [
    (raw.fromAddr || raw.fromName || "").toLowerCase(),
    raw.date ? raw.date.toISOString() : "",
    normalizeSubject(raw.subject),
    (raw.body || "").replace(/\s+/g, " ").trim().slice(0, 4000),
  ];
  return "h:" + crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

function cleanId(id: string): string {
  return id.trim().toLowerCase().replace(/^<|>$/g, "");
}

function resolveThread(raw: RawMessage, fp: string, counterparty: string | null, normSubj: string, orders: string[]): string {
  const db = getDb();
  if (raw.threadHint) return "h:" + raw.threadHint.toLowerCase();
  const ids = [raw.inReplyTo, ...(raw.references || [])].filter(Boolean) as string[];
  for (const id of ids) {
    const row = db.prepare("SELECT thread_key FROM messages WHERE external_id = ? LIMIT 1").get(cleanId(id)) as { thread_key: string } | undefined;
    if (row) return row.thread_key;
  }
  if (normSubj && counterparty) {
    const row = db
      .prepare("SELECT thread_key FROM messages WHERE counterparty = ? AND norm_subject = ? ORDER BY id DESC LIMIT 1")
      .get(counterparty, normSubj) as { thread_key: string } | undefined;
    if (row) return row.thread_key;
  }
  for (const o of orders) {
    const row = db
      .prepare("SELECT m.thread_key FROM messages m, json_each(m.order_numbers) j WHERE j.value = ? ORDER BY m.id DESC LIMIT 1")
      .get(o) as { thread_key: string } | undefined;
    if (row) return row.thread_key;
  }
  if (orders[0]) return `order:${orders[0]}`;
  if (normSubj && counterparty) return `s:${counterparty}|${normSubj}`;
  return `m:${fp.slice(0, 24)}`;
}

function sortKey(m: RawMessage): number {
  return m.date ? m.date.getTime() : Number.MAX_SAFE_INTEGER;
}

export function ingest(parsed: ParseResult, opts: { filename: string; source?: string | null; isDemo?: boolean }): ImportSummary {
  const db = getDb();
  const mine = myAddresses();
  const forced = opts.source && opts.source !== "auto" ? opts.source : null;
  const now = nowIso();
  const summary: ImportSummary = {
    importId: 0,
    filename: opts.filename,
    format: parsed.format,
    added: 0,
    duplicates: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    tasksReopened: 0,
    errors: [...parsed.errors],
  };

  const run = db.transaction(() => {
    const imp = db
      .prepare("INSERT INTO imports(created_at, filename, format, source, is_demo) VALUES (?, ?, ?, ?, ?)")
      .run(now, opts.filename, parsed.format, forced ?? "auto", opts.isDemo ? 1 : 0);
    summary.importId = Number(imp.lastInsertRowid);

    const touched = new Map<string, Set<number>>(); // thread_key -> id новых сообщений
    const sourcesSeen = new Set<string>();
    const insert = db.prepare(`INSERT INTO messages(
        fingerprint, source, mailbox, external_id, in_reply_to, references_ids, thread_key, direction, direction_hint,
        counterparty, norm_subject, from_name, from_addr, to_addr, subject, sent_at, body,
        order_numbers, tracking_numbers, categories, import_id, is_demo, created_at)
      VALUES (@fingerprint, @source, @mailbox, @external_id, @in_reply_to, @references_ids, @thread_key, @direction, @direction_hint,
        @counterparty, @norm_subject, @from_name, @from_addr, @to_addr, @subject, @sent_at, @body,
        @order_numbers, @tracking_numbers, @categories, @import_id, @is_demo, @created_at)`);
    const exists = db.prepare("SELECT id, source FROM messages WHERE fingerprint = ?");

    const sorted = [...parsed.messages].sort((a, b) => sortKey(a) - sortKey(b));
    for (const raw of sorted) {
      if (!raw.body?.trim() && !raw.subject?.trim()) {
        summary.errors.push("Пропущено пустое сообщение");
        continue;
      }
      const fp = fingerprintOf(raw);
      const dup = exists.get(fp) as { id: number; source: string } | undefined;
      if (dup) {
        summary.duplicates++;
        sourcesSeen.add(dup.source);
        continue;
      }
      const source =
        forced ?? normalizeSourceHint(raw.sourceHint) ?? detectSource(raw.fromAddr, raw.subject, raw.body) ?? (raw.fromAddr ? "gmail" : "other");
      sourcesSeen.add(source);
      const direction = raw.directionHint ?? computeDirection(raw.fromAddr ?? null, mine);
      const firstTo = raw.toAddr?.split(",")[0]?.trim() || null;
      const counterparty = (direction === "out" ? firstTo : raw.fromAddr || raw.fromName?.toLowerCase()) || null;
      const normSubj = normalizeSubject(raw.subject);
      const text = `${raw.subject || ""}\n${raw.body}`;
      const orders = [...new Set([raw.orderHint, ...extractOrderNumbers(text)].filter(Boolean) as string[])];
      const tracking = extractTrackingNumbers(text);
      const thread = resolveThread(raw, fp, counterparty, normSubj, orders);
      const cls = direction === "out" ? { categories: [] as string[] } : classify(raw.subject, raw.body, raw.fromAddr);
      const info = insert.run({
        fingerprint: fp,
        source,
        mailbox: raw.mailbox ?? (direction === "out" ? raw.fromAddr : firstTo) ?? null,
        external_id: raw.externalId ? cleanId(raw.externalId) : null,
        in_reply_to: raw.inReplyTo ? cleanId(raw.inReplyTo) : null,
        references_ids: raw.references?.length ? JSON.stringify(raw.references.map(cleanId)) : null,
        thread_key: thread,
        direction,
        direction_hint: raw.directionHint ?? null,
        counterparty,
        norm_subject: normSubj || null,
        from_name: raw.fromName ?? null,
        from_addr: raw.fromAddr ?? null,
        to_addr: raw.toAddr ?? null,
        subject: raw.subject ?? null,
        sent_at: raw.date ? raw.date.toISOString() : null,
        body: raw.body || "",
        order_numbers: JSON.stringify(orders),
        tracking_numbers: JSON.stringify(tracking),
        categories: JSON.stringify(cls.categories),
        import_id: summary.importId,
        is_demo: opts.isDemo ? 1 : 0,
        created_at: now,
      });
      summary.added++;
      if (!touched.has(thread)) touched.set(thread, new Set());
      touched.get(thread)!.add(Number(info.lastInsertRowid));
    }

    for (const t of parsed.tasks) {
      const r = createImportedTask(t, opts.isDemo ?? false, forced);
      if (r === "created") summary.tasksCreated++;
      else summary.duplicates++;
    }

    for (const [thread, newIds] of touched) {
      const r = syncThreadTasks(thread, newIds, opts.isDemo ?? false);
      summary.tasksCreated += r.created;
      summary.tasksUpdated += r.updated;
      summary.tasksReopened += r.reopened;
    }

    for (const s of sourcesSeen) setSetting(`source_last_import:${s}`, now);
    if (parsed.tasks.length && !sourcesSeen.size) setSetting(`source_last_import:${forced ?? "manual"}`, now);

    db.prepare(
      "UPDATE imports SET added = ?, duplicates = ?, tasks_created = ?, tasks_updated = ?, errors = ? WHERE id = ?",
    ).run(summary.added, summary.duplicates, summary.tasksCreated, summary.tasksUpdated, JSON.stringify(summary.errors.slice(0, 200)), summary.importId);
  });
  run();
  return summary;
}

function createImportedTask(t: ManualTaskRow, isDemo: boolean, forcedSource: string | null): "created" | "duplicate" {
  const db = getDb();
  const key = "import:" + crypto.createHash("sha256").update([t.title, t.order_number, t.customer_name].join("|").toLowerCase()).digest("hex").slice(0, 32);
  if (db.prepare("SELECT 1 FROM tasks WHERE dedup_key = ?").get(key)) return "duplicate";
  const now = nowIso();
  const pr = t.priority && t.priority.toLowerCase() in PRIORITIES ? t.priority.toLowerCase() : "normal";
  const info = db
    .prepare(
      `INSERT INTO tasks(dedup_key, title, category, source, customer_name, order_number, summary, priority, priority_locked, status, status_changed_at,
        deadline, origin, is_demo, created_at, updated_at)
       VALUES (?, ?, 'other', ?, ?, ?, ?, ?, ?, 'open', ?, ?, 'import', ?, ?, ?)`,
    )
    .run(key, t.title, normalizeSourceHint(t.source) ?? forcedSource ?? "manual", t.customer_name, t.order_number, t.summary, pr, t.priority ? 1 : 0, now, t.deadline, isDemo ? 1 : 0, now, now);
  logActivity(Number(info.lastInsertRowid), "created", "Задача импортирована из таблицы");
  return "created";
}

function msgTime(m: MessageRow): string {
  return m.sent_at ?? m.created_at;
}

type TaskRow = {
  id: number;
  category: string;
  status: string;
  status_changed_at: string | null;
  edited_fields: string;
  priority_locked: number;
  last_reply_at: string | null;
  origin: string;
};

/** Пересобирает задачи одной переписки. Ручные изменения (edited_fields), заметки и статусы сохраняются. */
export function syncThreadTasks(threadKey: string, newIds: Set<number> = new Set(), isDemo = false) {
  const db = getDb();
  const res = { created: 0, updated: 0, reopened: 0 };
  const msgs = db
    .prepare("SELECT * FROM messages WHERE thread_key = ? ORDER BY COALESCE(sent_at, created_at), id")
    .all(threadKey) as MessageRow[];
  if (!msgs.length) return res;
  const inbound = msgs.filter((m) => m.direction !== "out");
  const outbound = msgs.filter((m) => m.direction === "out");
  if (!inbound.length) {
    // Только наши письма — задачи не создаём, но обновляем время последнего ответа у существующих.
    const lastOut = msgTime(outbound[outbound.length - 1]);
    db.prepare("UPDATE tasks SET last_outbound_at = ?, last_message_at = ? WHERE thread_key = ?").run(lastOut, lastOut, threadKey);
    return res;
  }
  const lastIn = inbound[inbound.length - 1];
  const lastInAt = msgTime(lastIn);
  const lastOutAt = outbound.length ? msgTime(outbound[outbound.length - 1]) : null;
  const lastMsgAt = msgTime(msgs[msgs.length - 1]);

  const catOrder = ["complaint", "carrier", "delivery", "return_label", "return_wait", "return", "invoice"];
  const cats = new Set<string>();
  for (const m of inbound) for (const c of JSON.parse(m.categories) as string[]) cats.add(c);
  let categories = catOrder.filter((c) => cats.has(c));
  // Ожидание возврата заменяет запрос этикетки, если клиент позже написал, что отправит сам.
  if (categories.includes("return_wait") && categories.includes("return_label")) categories = categories.filter((c) => c !== "return_label");
  const lastCls = classify(lastIn.subject, lastIn.body, lastIn.from_addr);
  const anyCritical = inbound.slice(-5).some((m) => classify(m.subject, m.body, m.from_addr).critical);
  const needsReplyNow = !lastOutAt || lastInAt > lastOutAt;
  if (!categories.length) {
    if (lastCls.needsReplyHint && needsReplyNow) categories = ["reply"];
    else return res; // уведомление/«спасибо» — задачу не создаём, сообщение останется в «Сообщениях»
  }

  const human = [...inbound].reverse().find((m) => !isAutomatedSender(m.from_addr)) ?? null;
  const order = msgs.map((m) => (JSON.parse(m.order_numbers) as string[])[0]).find(Boolean) ?? null;

  // Более точная категория заменяет общую: «ответить» → любая, «возврат» → этикетка/ожидание, «этикетка» → ожидание.
  const SUPERSEDES: Record<string, string[]> = {
    return_wait: ["return", "return_label", "reply"],
    return_label: ["return", "reply"],
  };
  for (const c of categories) for (const s of SUPERSEDES[c] ?? []) categories = categories.filter((x) => x !== s);
  const existing = db.prepare("SELECT * FROM tasks WHERE thread_key = ?").all(threadKey) as TaskRow[];
  for (const target of categories) {
    if (target === "reply" || existing.some((t) => t.category === target)) continue;
    const replaceable = [...(SUPERSEDES[target] ?? []), "reply"];
    const old = existing.find(
      (t) => replaceable.includes(t.category) && t.status !== "done" && t.origin === "auto" && !(JSON.parse(t.edited_fields) as string[]).includes("category"),
    );
    if (!old) continue;
    db.prepare("UPDATE tasks SET category = ?, title = ?, dedup_key = ?, next_action = ? WHERE id = ?").run(
      target,
      CATEGORY_TASK_TITLES[target],
      `t:${threadKey}:${target}`,
      CATEGORY_NEXT_ACTION[target],
      old.id,
    );
    logActivity(old.id, "updated", `Категория уточнена автоматически: ${CATEGORY_TASK_TITLES[target]}`);
    old.category = target;
  }

  const now = nowIso();
  for (const cat of categories) {
    const key = `t:${threadKey}:${cat}`;
    const related = cat === "reply" ? inbound : inbound.filter((m) => (JSON.parse(m.categories) as string[]).includes(cat));
    const basis = related[related.length - 1] ?? lastIn;
    const fields = {
      source: basis.source,
      customer_name: human?.from_name || null,
      customer_contact: human?.from_addr || (human?.source === "whatsapp" ? "WhatsApp" : null),
      order_number: order,
      summary: summarize(basis.body) || basis.subject || "",
      title: CATEGORY_TASK_TITLES[cat] ?? "Задача",
      next_action: CATEGORY_NEXT_ACTION[cat] ?? null,
    };
    const priority = suggestPriority(cat, { critical: anyCritical, waitingSince: needsReplyNow ? lastInAt : null });
    const linkIds = [...related, ...outbound].map((m) => m.id);
    const task = db.prepare("SELECT * FROM tasks WHERE dedup_key = ?").get(key) as TaskRow | undefined;

    if (!task) {
      const info = db
        .prepare(
          `INSERT INTO tasks(dedup_key, title, category, source, customer_name, customer_contact, order_number, summary, priority,
            status, status_changed_at, stage, next_action, thread_key, last_message_at, last_inbound_at, last_outbound_at, origin, is_demo, created_at, updated_at)
           VALUES (@key, @title, @cat, @source, @customer_name, @customer_contact, @order_number, @summary, @priority,
            'open', @now, @stage, @next_action, @thread, @lastMsg, @lastIn, @lastOut, 'auto', @demo, @now, @now)`,
        )
        .run({
          key,
          cat,
          ...fields,
          priority,
          stage: RETURN_CATEGORIES.includes(cat) ? "requested" : cat === "complaint" || cat === "carrier" ? "new" : null,
          thread: threadKey,
          lastMsg: lastMsgAt,
          lastIn: lastInAt,
          lastOut: lastOutAt,
          demo: isDemo ? 1 : 0,
          now,
        });
      const id = Number(info.lastInsertRowid);
      linkMessages(id, linkIds);
      logActivity(id, "created", `Создана автоматически по ${related.length || 1} сообщ. (${fields.source})`);
      res.created++;
      continue;
    }

    const edited = new Set(JSON.parse(task.edited_fields) as string[]);
    const sets: string[] = [];
    const vals: Record<string, unknown> = { id: task.id };
    for (const [k, v] of Object.entries(fields)) {
      if (edited.has(k)) continue;
      sets.push(`${k} = @${k}`);
      vals[k] = v;
    }
    if (!task.priority_locked) {
      sets.push("priority = @priority");
      vals.priority = priority;
    }
    sets.push("last_message_at = @lastMsg", "last_inbound_at = @lastIn", "last_outbound_at = @lastOut");
    Object.assign(vals, { lastMsg: lastMsgAt, lastIn: lastInAt, lastOut: lastOutAt });

    // Новое входящее письмо после закрытия/ответа — задача снова требует действия.
    const freshInbound = related.filter((m) => newIds.has(m.id) && m.sent_at);
    const changedAt = task.status_changed_at ?? "";
    if ((task.status === "done" || task.status === "waiting") && freshInbound.some((m) => m.sent_at! > changedAt)) {
      sets.push("status = 'open'", "status_changed_at = @now", "completed_at = NULL");
      vals.now = now;
      logActivity(task.id, "reopened", "Открыта снова: пришло новое сообщение клиента");
      res.reopened++;
    }
    sets.push("updated_at = @updated");
    vals.updated = now;
    db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = @id`).run(vals);
    linkMessages(task.id, linkIds);
    if (newIds.size) res.updated++;
  }
  return res;
}

function linkMessages(taskId: number, ids: number[]) {
  const st = getDb().prepare("INSERT OR IGNORE INTO task_messages(task_id, message_id) VALUES (?, ?)");
  for (const id of ids) st.run(taskId, id);
}

/** После изменения «моих адресов» пересчитываем направление писем и задачи. */
export function recomputeDirections(): { messages: number; threads: number } {
  const db = getDb();
  const mine = myAddresses();
  let changed = 0;
  const threads = new Set<string>();
  db.transaction(() => {
    const rows = db.prepare("SELECT id, from_addr, to_addr, direction, thread_key, subject, body FROM messages WHERE direction_hint IS NULL").all() as {
      id: number;
      from_addr: string | null;
      to_addr: string | null;
      direction: string;
      thread_key: string;
      subject: string | null;
      body: string;
    }[];
    const upd = db.prepare("UPDATE messages SET direction = ?, counterparty = COALESCE(?, counterparty), categories = ? WHERE id = ?");
    for (const r of rows) {
      const d = computeDirection(r.from_addr, mine);
      if (d === r.direction) continue;
      const cp = d === "out" ? r.to_addr?.split(",")[0]?.trim() ?? null : r.from_addr;
      const cats = d === "out" ? [] : classify(r.subject, r.body, r.from_addr).categories;
      upd.run(d, cp, JSON.stringify(cats), r.id);
      changed++;
      threads.add(r.thread_key);
    }
    for (const t of threads) syncThreadTasks(t);
  })();
  return { messages: changed, threads: threads.size };
}
