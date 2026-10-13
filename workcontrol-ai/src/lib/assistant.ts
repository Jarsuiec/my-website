// «Спросить AI». Два режима:
//  1) локальный (по умолчанию) — правила и поиск по базе, ничего не уходит наружу;
//  2) Claude API — только если задан ANTHROPIC_API_KEY И в Настройках явно разрешена отправка данных.
// AI только отвечает и пишет черновики. Он не отправляет письма и не меняет заказы.

import Anthropic from "@anthropic-ai/sdk";
import { getDb, getSetting } from "./db";
import { CATEGORIES, PRIORITIES, RETURN_CATEGORIES, SOURCES, STATUSES, COMPLAINT_CATEGORIES, DELIVERY_CATEGORIES } from "./constants";
import { listTasks, possiblyMissed, searchAll, startOfToday, getTask, type Task } from "./tasks";
import { claudeContext, maskText, reportMarkdown } from "./backup";
import { guessLang, templateDraft } from "./drafts";
import { fold } from "./rules";

export type Ref = { kind: "task" | "message"; id: number; label: string; sub?: string };
export type Answer = { mode: "local" | "ai"; text: string; refs: Ref[]; notice?: string };

export function aiStatus() {
  const keyPresent = !!process.env.ANTHROPIC_API_KEY?.trim();
  const allowed = getSetting("ai_external_allowed") === "1";
  return {
    keyPresent,
    allowed,
    enabled: keyPresent && allowed,
    maskPii: getSetting("ai_mask_pii", "1") !== "0",
    model: process.env.AI_MODEL?.trim() || "claude-opus-5-5",
  };
}

const taskRef = (t: Task): Ref => ({
  kind: "task",
  id: t.id,
  label: `${t.title}${t.order_number ? ` · заказ ${t.order_number}` : ""}`,
  sub: [t.customer_name, SOURCES[t.source as keyof typeof SOURCES], PRIORITIES[t.priority as keyof typeof PRIORITIES], STATUSES[t.status as keyof typeof STATUSES]]
    .filter(Boolean)
    .join(" · "),
});

function taskList(title: string, tasks: Task[], empty: string): Answer {
  if (!tasks.length) return { mode: "local", text: empty, refs: [] };
  const lines = tasks.slice(0, 30).map((t) => `• [T${t.id}] ${t.title}${t.order_number ? ` — заказ ${t.order_number}` : ""}${t.customer_name ? ` — ${t.customer_name}` : ""}`);
  const more = tasks.length > 30 ? `\n…и ещё ${tasks.length - 30}.` : "";
  return { mode: "local", text: `${title} (${tasks.length}):\n${lines.join("\n")}${more}`, refs: tasks.slice(0, 30).map(taskRef) };
}

function textFilter(tasks: Task[], words: RegExp): Task[] {
  return tasks.filter((t) => words.test(fold(`${t.title} ${t.summary ?? ""} ${t.source ?? ""} ${t.category}`)));
}

/** Локальные ответы на типовые вопросы. Возвращает null, если вопрос не распознан. */
export function localAnswer(question: string): Answer | null {
  const q = fold(question);
  const active = () => listTasks({ view: "active", limit: 2000 });

  if (/отч[её]т|директор|raport/.test(q)) {
    return { mode: "local", text: reportMarkdown(), refs: [] };
  }
  if (/(напиши|подготов\w*|составь|черновик).*(ответ|письмо|сообщени)|ответ.*(польск|по-польски|англ|немец)/.test(q)) {
    const id = /(?:^|[\s[(])[tт]\s?(\d{1,7})\b/.exec(q)?.[1] ?? /задач\w*\s*#?(\d{1,7})/.exec(q)?.[1];
    const lang = /польск/.test(q) ? "pl" : /англ/.test(q) ? "en" : /немец/.test(q) ? "de" : /русск/.test(q) ? "ru" : null;
    if (id) {
      const d = getTask(Number(id));
      if (d) {
        const last = [...d.messages].reverse().find((x) => x.direction !== "out");
        const l = lang ?? (last ? guessLang(last.body) : "pl");
        return {
          mode: "local",
          text: `Черновик по шаблону для [T${d.task.id}] (${l.toUpperCase()}). Проверьте и дополните перед отправкой — приложение ничего не отправляет само.\n\n${templateDraft(d.task.category, l, { order: d.task.order_number, name: d.task.customer_name })}`,
          refs: [taskRef(d.task)],
        };
      }
    }
    return {
      mode: "local",
      text: "Укажите задачу, например: «Напиши ответ на польском по T12». Номер задачи виден в её карточке. Также черновик можно сделать кнопкой «Черновик ответа» на странице задачи.",
      refs: [],
    };
  }
  if (/срочн|важн|в первую очередь|приоритет|что делать|с чего начать/.test(q)) {
    const t = active().filter((x) => x.status === "open" && (x.priority === "critical" || x.priority === "high" || (x.deadline && x.deadline <= new Date(Date.now() + 864e5).toISOString())));
    return taskList("Самое срочное", t, "Срочных открытых задач нет. 👍");
  }
  if (/не ответил|без ответа|ожида\w* ответ|кому.*ответ|пропущ/.test(q)) {
    const t = active().filter((x) => x.needs_reply);
    const missed = possiblyMissed();
    const a = taskList("Задачи, где клиент, возможно, ждёт ответа", t, "Задач, где клиент ждёт ответа, не найдено.");
    if (missed.length) {
      a.text += `\n\nПереписки без задачи, где последнее сообщение от клиента (${missed.length}):\n` +
        missed.slice(0, 20).map((m) => `• [M${m.last_id}] ${m.from_name || m.from_addr || "?"} — ${m.subject ?? "(без темы)"}`).join("\n");
      a.refs.push(...missed.slice(0, 20).map((m) => ({ kind: "message" as const, id: m.last_id, label: m.subject ?? "(без темы)", sub: m.from_name || m.from_addr || "" })));
    }
    a.notice = "«Возможно» — потому что приложение видит только загруженную историю. Если ваши ответы не импортированы, вывод может быть неточным.";
    return a;
  }
  if (/возврат/.test(q) && /(не поступ|не пришл|склад|не дош)/.test(q)) {
    const t = listTasks({ view: "active", categories: RETURN_CATEGORIES }).filter((x) => !["received", "refunded"].includes(x.stage ?? ""));
    return taskList("Возвраты, которые ещё не поступили на склад", t, "Открытых возвратов, ожидающих поступления, нет.");
  }
  if (/возврат/.test(q)) {
    return taskList("Открытые возвраты", listTasks({ view: "active", categories: RETURN_CATEGORIES }), "Открытых возвратов нет.");
  }
  const carrier = /\bups\b/.test(q) ? "ups" : /\bdpd\b/.test(q) ? "dpd" : null;
  if (/рекламац|жалоб|претензи/.test(q)) {
    let t = listTasks({ view: "active", categories: COMPLAINT_CATEGORIES });
    if (carrier) t = t.filter((x) => x.source === carrier || new RegExp(`\\b${carrier}\\b`).test(fold(`${x.summary} ${x.title}`)) || threadMentions(x, carrier));
    return taskList(`Открытые рекламации${carrier ? ` (${carrier.toUpperCase()})` : ""}`, t, `Открытых рекламаций${carrier ? ` по ${carrier.toUpperCase()}` : ""} не найдено.`);
  }
  if (carrier || /достав|посылк|перевозчик|трек|kurier|przesylk/.test(q)) {
    let t = listTasks({ view: "active", categories: DELIVERY_CATEGORIES.concat(["complaint"]) });
    if (carrier) t = t.filter((x) => x.source === carrier || threadMentions(x, carrier) || new RegExp(`\\b${carrier}\\b`).test(fold(`${x.summary} ${x.title}`)));
    else t = t.filter((x) => DELIVERY_CATEGORIES.includes(x.category));
    return taskList(`Проблемы с доставкой${carrier ? ` (${carrier.toUpperCase()})` : ""}`, t, "Открытых проблем с доставкой не найдено.");
  }
  if (/фактур|invoice|счет/.test(q)) {
    return taskList("Фактуры к подготовке", listTasks({ view: "active", category: "invoice" }), "Открытых задач по фактурам нет.");
  }
  if (/вчера|осталось|незаверш|хвост/.test(q)) {
    return taskList("Открытые задачи, созданные до сегодняшнего дня", listTasks({ preset: "yesterday" }), "Со вчера ничего не осталось.");
  }
  if (/(выполнил|сделал|закрыл|выполнено)/.test(q)) {
    return taskList("Выполнено сегодня", listTasks({ preset: "done_today", view: "done" }), "Сегодня пока ничего не отмечено выполненным.");
  }
  const order = /(?:заказ\w*|order|zamowieni\w*|nr)\s*#?\s*([a-z0-9-]{3,})/.exec(q)?.[1] ?? /#(\d{3,})/.exec(q)?.[1] ?? (/^\s*(найди|найти|покажи)?\s*(\d{4,})\s*$/.exec(q)?.[2]);
  if (order) return searchAnswer(order, `Найдено по номеру ${order}`);
  const client = /(?:клиент\w*|от|сообщени\w* (?:от|клиента))\s+([^\s,.?!]+(?:\s+[^\s,.?!]+)?)/.exec(question)?.[1];
  if (/найди|покажи|поиск|сообщени/.test(q) && client) return searchAnswer(client, `Найдено по «${client}»`);
  return null;
}

function threadMentions(t: Task, word: string): boolean {
  if (!t.thread_key) return false;
  const row = getDb()
    .prepare("SELECT 1 FROM messages WHERE thread_key = ? AND id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?) LIMIT 1")
    .get(t.thread_key, `"${word}"`);
  return !!row;
}

function searchAnswer(q: string, title: string): Answer {
  const r = searchAll(q);
  if (!r.tasks.length && !r.messages.length) return { mode: "local", text: `По запросу «${q}» ничего не найдено в загруженных данных.`, refs: [] };
  const lines = [
    ...r.tasks.slice(0, 15).map((t) => `• [T${t.id}] ${t.title} — ${STATUSES[t.status as keyof typeof STATUSES]}${t.customer_name ? ` — ${t.customer_name}` : ""}`),
    ...r.messages.slice(0, 15).map((m) => `• [M${m.id}] ${m.from_name || m.from_addr || "?"} — ${m.subject ?? "(без темы)"} — ${String(m.snippet ?? "").replace(/\s+/g, " ")}`),
  ];
  return {
    mode: "local",
    text: `${title}: задач ${r.tasks.length}, сообщений ${r.messages.length}.\n${lines.join("\n")}`,
    refs: [
      ...r.tasks.slice(0, 15).map(taskRef),
      ...r.messages.slice(0, 15).map((m) => ({ kind: "message" as const, id: Number(m.id), label: String(m.subject ?? "(без темы)"), sub: String(m.from_name || m.from_addr || "") })),
    ],
  };
}

const SYSTEM = `Ты — помощник e-commerce менеджера в приложении WorkControl AI. Отвечай по-русски, кратко и по делу.
Используй ТОЛЬКО данные из блока <data>. Каждое утверждение о задаче или сообщении сопровождай ссылкой [T<id>] или [M<id>] из этих данных.
Если данных недостаточно или источник не был загружен — прямо скажи об этом, не додумывай.
Ты не можешь отправлять письма, оформлять возвраты или менять заказы — можешь только советовать и готовить черновики.
Если просят ответ клиенту — пиши черновик на языке клиента (по умолчанию польский), вежливо, без обещаний, которых нет в данных.
Слова «возможно, ожидает ответа» используй, когда история переписки может быть неполной.`;

async function callClaude(system: string, userContent: string, history: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const st = aiStatus();
  const client = new Anthropic();
  const resp = await client.beta.messages.create({
    model: st.model,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [...history.slice(-6), { role: "user", content: userContent }],
  } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
  if (resp.stop_reason === "refusal") throw new Error("Модель отклонила запрос. Попробуйте переформулировать.");
  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!text) throw new Error("Пустой ответ модели");
  return text;
}

export async function ask(question: string, history: { role: "user" | "assistant"; content: string }[] = []): Promise<Answer> {
  const q = question.trim().slice(0, 4000);
  if (!q) return { mode: "local", text: "Задайте вопрос.", refs: [] };
  const local = localAnswer(q);
  const st = aiStatus();
  if (!st.enabled) {
    if (local) return { ...local, notice: local.notice ?? localNotice(st) };
    const fallback = searchAnswer(q, "Вопрос не распознан как типовой. Результаты поиска");
    return { ...fallback, notice: localNotice(st) };
  }
  // Режим Claude: даём модели сводку и релевантные фрагменты.
  const ctx = claudeContext({ maskPii: st.maskPii });
  const hits = searchAll(q);
  const msgs = hits.messages.slice(0, 15).map((m) => {
    const full = getDb().prepare("SELECT body FROM messages WHERE id = ?").get(m.id) as { body: string };
    const body = full.body.slice(0, 1500);
    return `[M${m.id}] ${m.source} · ${m.at} · ${st.maskPii ? "" : m.from_name || m.from_addr || ""} · ${m.subject ?? ""}\n${st.maskPii ? maskText(body) : body}`;
  });
  const localPart = local ? `\nРезультат локального анализа:\n${st.maskPii ? maskText(local.text) : local.text}` : "";
  const data = `<data>\n${ctx}\n\n## Найденные сообщения\n${msgs.join("\n\n") || "нет"}${localPart}\n</data>\n\nВопрос: ${q}`;
  try {
    const text = await callClaude(SYSTEM, data, history);
    const refs = collectRefs(text);
    return { mode: "ai", text, refs, notice: st.maskPii ? "Персональные данные были замаскированы перед отправкой." : undefined };
  } catch (e) {
    const base = local ?? searchAnswer(q, "Результаты поиска");
    return { ...base, notice: `AI недоступен (${(e as Error).message}). Показан локальный ответ.` };
  }
}

function localNotice(st: ReturnType<typeof aiStatus>): string {
  if (!st.keyPresent) return "Локальный режим: ответ построен правилами и поиском по базе, данные никуда не отправлялись.";
  return "Локальный режим: ключ API задан, но отправка данных во внешний AI не разрешена в Настройках.";
}

export function collectRefs(text: string): Ref[] {
  const db = getDb();
  const refs: Ref[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/\[(T|M)(\d+)\]/g)) {
    const key = m[1] + m[2];
    if (seen.has(key)) continue;
    seen.add(key);
    const id = Number(m[2]);
    if (m[1] === "T") {
      const t = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;
      if (t) refs.push(taskRef(t));
    } else {
      const r = db.prepare("SELECT id, subject, from_name, from_addr FROM messages WHERE id = ?").get(id) as
        | { id: number; subject: string | null; from_name: string | null; from_addr: string | null }
        | undefined;
      if (r) refs.push({ kind: "message", id, label: r.subject ?? "(без темы)", sub: r.from_name || r.from_addr || "" });
    }
  }
  return refs;
}

/** Черновик ответа по задаче. С AI — генерация, без AI — шаблон. */
export async function draftReply(taskId: number, lang?: string): Promise<{ mode: "local" | "ai"; text: string; lang: string; notice?: string }> {
  const d = getTask(taskId);
  if (!d) throw new Error("Задача не найдена");
  const lastIn = [...d.messages].reverse().find((m) => m.direction !== "out");
  const l = lang && lang !== "auto" ? lang : lastIn ? guessLang(lastIn.body) : "pl";
  const st = aiStatus();
  const tpl = templateDraft(d.task.category, l, { order: d.task.order_number, name: d.task.customer_name });
  if (!st.enabled || !lastIn) {
    return { mode: "local", text: tpl, lang: l, notice: st.enabled ? "Нет входящего сообщения — использован шаблон." : "Черновик по шаблону (AI не подключён или не разрешён)." };
  }
  const conv = d.messages
    .slice(-8)
    .map((m) => `${m.direction === "out" ? "МЫ" : "КЛИЕНТ"} (${m.sent_at ?? "дата неизвестна"}):\n${(st.maskPii ? maskText(m.body) : m.body).slice(0, 2500)}`)
    .join("\n\n---\n\n");
  const notes = (d.notes as { body: string }[]).map((n) => `- ${n.body}`).join("\n");
  try {
    const text = await callClaude(
      SYSTEM,
      `<data>\nЗадача [T${d.task.id}]: ${d.task.title}; категория: ${CATEGORIES[d.task.category as keyof typeof CATEGORIES]}; заказ: ${d.task.order_number ?? "неизвестен"}\nЗаметки менеджера:\n${notes || "нет"}\n\nПереписка:\n${conv}\n</data>\n\nНапиши черновик ответа клиенту на языке: ${l}. Только текст письма, без пояснений. Не обещай конкретных сроков или сумм, если их нет в данных.`,
      [],
    );
    return { mode: "ai", text, lang: l, notice: "Черновик создан AI. Проверьте перед отправкой." };
  } catch (e) {
    return { mode: "local", text: tpl, lang: l, notice: `AI недоступен (${(e as Error).message}). Использован шаблон.` };
  }
}

export { startOfToday };
