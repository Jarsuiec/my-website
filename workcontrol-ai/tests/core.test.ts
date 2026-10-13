// Модульные тесты ядра: разбор, правила, дедупликация, задачи, архив.
// Запуск: npm test  (используется временная папка данных, настоящая база не затрагивается)

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wc-test-"));
process.env.DATA_DIR = tmp;

const { closeDb, getDb, setSetting } = await import("../src/lib/db.ts");
const { parseFile, parseCsv, isWhatsApp, parseWhatsApp, parsePlainText } = await import("../src/lib/parsers.ts");
const { classify, extractOrderNumbers, extractTrackingNumbers, normalizeSubject, suggestPriority } = await import("../src/lib/rules.ts");
const { ingest, recomputeDirections } = await import("../src/lib/ingest.ts");
const tasksLib = await import("../src/lib/tasks.ts");
const backup = await import("../src/lib/backup.ts");
const demo = await import("../src/lib/demo.ts");
const assistant = await import("../src/lib/assistant.ts");

before(() => {
  setSetting("my_addresses", "sklep@demo-shop.pl");
});
after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const eml = (id: string, from: string, subject: string, body: string, date: string, extra = "") =>
  Buffer.from(
    `Message-ID: <${id}>\r\nFrom: ${from}\r\nTo: sklep@demo-shop.pl\r\nSubject: ${subject}\r\nDate: ${date}\r\n${extra}Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body}\r\n`,
  );

test("правила: номера заказов, трекинги, категории", () => {
  assert.deepEqual(extractOrderNumbers("Zamówienie nr 123456 nie dotarło"), ["123456"]);
  assert.deepEqual(extractOrderNumbers("order #A-7781 and #99812"), ["A-7781", "99812"]);
  assert.deepEqual(extractOrderNumbers("zamówienie zostało wysłane"), []);
  assert.deepEqual(extractTrackingNumbers("UPS 1Z999AA10123456784"), ["1Z999AA10123456784"]);
  assert.equal(normalizeSubject("Re: RE: Odp: Zwrot zamówienia"), "zwrot zamowienia");
  assert.deepEqual(classify("Paczka", "Paczka nie dotarła, gdzie jest moja przesyłka?").categories, ["delivery"]);
  assert.deepEqual(classify("", "Proszę o etykietę zwrotną").categories, ["return_label"]);
  assert.deepEqual(classify("", "Odeślę paczkę sam we własnym zakresie").categories, ["return_wait"]);
  assert.ok(classify("", "Produkt uszkodzony").categories.includes("complaint"));
  assert.ok(classify("", "Proszę o fakturę VAT").categories.includes("invoice"));
  assert.ok(classify("", "Die Ware ist kaputt").categories.includes("complaint"));
  assert.ok(classify("", "Zgłoszę sprawę do rzecznika praw konsumenta").critical);
  assert.equal(classify("Dziękuję", "Wszystko doszło, dziękuję").needsReplyHint, false);
  assert.equal(suggestPriority("invoice", { waitingSince: new Date(Date.now() - 72 * 36e5).toISOString() }), "high");
  assert.equal(suggestPriority("return_wait", {}), "low");
});

test("парсеры: EML с польскими символами, CSV, WhatsApp, текст", async () => {
  const r = await parseFile("a.eml", eml("x1@t", "Anna <anna@x.pl>", "Zwrot zamówienia", "Zażółć gęślą jaźń", "Mon, 12 Oct 2026 10:00:00 +0200"), { myWhatsAppNames: [] });
  assert.equal(r.errors.length, 0);
  assert.equal(r.messages[0].body, "Zażółć gęślą jaźń");
  assert.equal(r.messages[0].fromAddr, "anna@x.pl");

  const csv = parseCsv("from,subject,date,message\nb@x.pl,Pytanie,12.10.2026 09:30,Czy mogę zmienić adres?\n");
  assert.equal(csv.messages.length, 1);
  assert.equal(csv.messages[0].date?.getDate(), 12);

  const bad = parseCsv("foo,bar\n1,2\n");
  assert.equal(bad.messages.length, 0);
  assert.match(bad.errors[0], /Не найдена колонка/);

  const wa = "12.10.2026, 14:23 - Ola: Dzień dobry, gdzie paczka?\n12.10.2026, 14:30 - Ja: Sprawdzam\nkolejna linia\n";
  assert.ok(isWhatsApp(wa));
  const msgs = parseWhatsApp(wa, "WhatsApp Chat with Ola.txt", ["Ja"]);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[1].directionHint, "out");
  assert.match(msgs[1].body, /kolejna linia/);

  const t = parsePlainText("Od: Jan <jan@x.pl>\nTemat: Faktura\n\nProszę o fakturę", "wklejony");
  assert.equal(t.fromAddr, "jan@x.pl");
  assert.equal(t.subject, "Faktura");

  const unsupported = await parseFile("a.exe", Buffer.from("MZ"), { myWhatsAppNames: [] });
  assert.match(unsupported.errors[0], /не поддерживается/);
  const fakePdf = await parseFile("a.pdf", Buffer.from("hello"), { myWhatsAppNames: [] });
  assert.match(fakePdf.errors[0], /не является PDF/);
});

test("импорт: повторная загрузка не создаёт дубликатов и сохраняет ручные изменения", async () => {
  const files = [
    eml("t1@x", "Ewa <ewa@x.pl>", "Paczka nie dotarła", "Zamówienie nr 555001 nie dotarło. Gdzie jest paczka?", "Mon, 12 Oct 2026 08:00:00 +0200"),
    eml("t2@x", "Ewa <ewa@x.pl>", "Prośba o fakturę", "Proszę o fakturę do zamówienia nr 555002", "Mon, 12 Oct 2026 09:00:00 +0200"),
  ];
  const parse = async () => {
    const all = await Promise.all(files.map((f, i) => parseFile(`m${i}.eml`, f, { myWhatsAppNames: [] })));
    return { format: "eml", messages: all.flatMap((a) => a.messages), tasks: [], errors: [] };
  };
  const first = ingest(await parse(), { filename: "batch1" });
  assert.equal(first.added, 2);
  assert.equal(first.tasksCreated, 2);
  const tasks1 = tasksLib.listTasks({ view: "all" });
  const delivery = tasks1.find((t) => t.category === "delivery")!;
  assert.equal(delivery.order_number, "555001");
  assert.equal(delivery.needs_reply, 1);

  tasksLib.updateTask(delivery.id, { title: "Моё название", priority: "low" });
  tasksLib.addNote(delivery.id, "Позвонил в DPD");

  const second = ingest(await parse(), { filename: "batch1-again" });
  assert.equal(second.added, 0);
  assert.equal(second.duplicates, 2);
  assert.equal(second.tasksCreated, 0);
  const again = tasksLib.getTask(delivery.id)!;
  assert.equal(again.task.title, "Моё название");
  assert.equal(again.task.priority, "low");
  assert.equal(again.notes.length, 1);
  assert.equal(tasksLib.listTasks({ view: "all" }).length, 2);
  // Тот же текст, вставленный вручную дважды — тоже дубликат
  const p1 = ingest({ format: "text", messages: [parsePlainText("Gdzie moja paczka 777?", "")], tasks: [], errors: [] }, { filename: "paste" });
  const p2 = ingest({ format: "text", messages: [parsePlainText("Gdzie moja paczka 777?", "")], tasks: [], errors: [] }, { filename: "paste" });
  assert.equal(p1.added, 1);
  assert.equal(p2.duplicates, 1);
});

test("ответ, ожидание и повторное открытие задачи новым письмом", async () => {
  const q = await parseFile("q.eml", eml("r1@x", "Olek <olek@x.pl>", "Reklamacja", "Produkt uszkodzony, zamówienie nr 600100", "Sat, 10 Oct 2026 08:00:00 +0200"), { myWhatsAppNames: [] });
  ingest(q, { filename: "r1" });
  const t = tasksLib.listTasks({ view: "all" }).find((x) => x.order_number === "600100")!;
  assert.equal(t.category, "complaint");
  tasksLib.applyAction(t.id, "replied");
  assert.equal(tasksLib.getTask(t.id)!.task.status, "waiting");
  assert.equal(tasksLib.getTask(t.id)!.task.needs_reply, 0);
  // Наш ответ из Gmail (исходящее) не создаёт новых задач
  const out = await parseFile("o.eml", eml("r2@x", "Sklep <sklep@demo-shop.pl>", "Re: Reklamacja", "Prosimy o zdjęcia", "Sat, 10 Oct 2026 09:00:00 +0200", "In-Reply-To: <r1@x>\r\n"), { myWhatsAppNames: [] });
  const before = tasksLib.listTasks({ view: "all" }).length;
  ingest(out, { filename: "r2" });
  assert.equal(tasksLib.listTasks({ view: "all" }).length, before);
  // Новое письмо клиента (дата в будущем относительно смены статуса) — задача снова открыта
  const future = new Date(Date.now() + 3600e3).toUTCString();
  const again = await parseFile("n.eml", eml("r3@x", "Olek <olek@x.pl>", "Re: Reklamacja", "Wysyłam zdjęcia, nadal uszkodzony", future, "In-Reply-To: <r2@x>\r\n"), { myWhatsAppNames: [] });
  const res = ingest(again, { filename: "r3" });
  assert.equal(res.tasksReopened, 1);
  assert.equal(tasksLib.getTask(t.id)!.task.status, "open");
  assert.equal(tasksLib.getTask(t.id)!.messages.length, 3);
});

test("отложить, выполнить, фильтры и поиск", () => {
  const id = tasksLib.createTask({ title: "Обновить карточку товара Plecak", category: "website", source: "website", order_number: "X-1" });
  assert.throws(() => tasksLib.applyAction(id, "snooze", new Date(Date.now() - 1000).toISOString()));
  tasksLib.applyAction(id, "snooze", new Date(Date.now() + 864e5).toISOString());
  assert.equal(tasksLib.listTasks({ status: "snoozed" }).some((t) => t.id === id), true);
  tasksLib.applyAction(id, "done");
  assert.equal(tasksLib.listTasks({ view: "active" }).some((t) => t.id === id), false);
  assert.equal(tasksLib.listTasks({ preset: "done_today", view: "done" }).some((t) => t.id === id), true);
  assert.equal(tasksLib.listTasks({ view: "all", q: "plecak" }).some((t) => t.id === id), true);
  assert.equal(tasksLib.listTasks({ view: "all", source: "website" }).length >= 1, true);
  const s = tasksLib.searchAll("555001");
  assert.ok(s.tasks.length >= 1 && s.messages.length >= 1);
  assert.doesNotThrow(() => tasksLib.listTasks({ q: "a" }));
  assert.doesNotThrow(() => tasksLib.listTasks({ q: '"(*' }));
});

test("демо-данные отделены и удаляются", () => {
  const before = tasksLib.listTasks({ view: "all", demo: "hide" }).length;
  demo.loadDemo();
  assert.ok(tasksLib.listTasks({ view: "all", demo: "only" }).length >= 7);
  const missed = tasksLib.possiblyMissed();
  assert.ok(missed.every((m) => !/noreply/.test(m.from_addr ?? "")));
  demo.removeDemo();
  assert.equal(tasksLib.listTasks({ view: "all", demo: "only" }).length, 0);
  assert.equal(tasksLib.listTasks({ view: "all" }).length, before);
});

test("архив: резервная копия и восстановление", async () => {
  const snapshot = tasksLib.listTasks({ view: "all" }).length;
  const zip = await backup.createZip();
  const data = await backup.readBackupFile("b.zip", zip);
  assert.equal(data.tables.tasks.length, snapshot);
  tasksLib.createTask({ title: "Временная" });
  assert.equal(tasksLib.listTasks({ view: "all" }).length, snapshot + 1);
  const r = backup.restoreBackup(data);
  assert.ok(r.safetyCopy.startsWith("workcontrol-before-restore"));
  assert.equal(tasksLib.listTasks({ view: "all" }).length, snapshot);
  assert.ok(tasksLib.listTasks({ view: "all", q: "555001" }).length >= 1, "поиск работает после восстановления");
  await assert.rejects(backup.readBackupFile("x.json", Buffer.from('{"a":1}')), /не резервная копия/);
  assert.match(backup.reportMarkdown(), /Отчёт WorkControl AI/);
  assert.doesNotMatch(backup.claudeContext({ maskPii: true }), /ewa@x\.pl/);
});

test("пересчёт направления после указания своих адресов", async () => {
  setSetting("my_addresses", "");
  const m = await parseFile("u.eml", eml("u1@x", "Me <me@shop.pl>", "Oferta", "Czy potrzebują Państwo czegoś?", "Sun, 11 Oct 2026 08:00:00 +0200"), { myWhatsAppNames: [] });
  ingest(m, { filename: "u" });
  const row = getDb().prepare("SELECT direction FROM messages WHERE external_id = 'u1@x'").get() as { direction: string };
  assert.equal(row.direction, "unknown");
  setSetting("my_addresses", "sklep@demo-shop.pl, @shop.pl");
  recomputeDirections();
  const row2 = getDb().prepare("SELECT direction FROM messages WHERE external_id = 'u1@x'").get() as { direction: string };
  assert.equal(row2.direction, "out");
});

test("локальный помощник отвечает по данным и даёт ссылки", async () => {
  const a = await assistant.ask("Покажи все проблемы с доставкой");
  assert.equal(a.mode, "local");
  assert.ok(a.refs.some((r) => r.kind === "task"));
  const b = await assistant.ask("Найди заказ 555002");
  assert.ok(b.refs.length >= 1);
  const c = await assistant.ask("Какие фактуры нужно сделать?");
  assert.match(c.text, /Фактуры|фактур/);
  const t = tasksLib.listTasks({ view: "all", category: "invoice" })[0];
  const d = await assistant.ask(`Напиши клиенту ответ на польском по T${t.id}`);
  assert.match(d.text, /Dzień dobry/);
});

test("общая задача «возврат» уточняется до «ожидать возврат», без дублей", async () => {
  const a = await parseFile("a.eml", eml("ret1@x", "Iga <iga@x.pl>", "Zwrot", "Chcę zwrócić zamówienie nr 900100", "Fri, 09 Oct 2026 08:00:00 +0200"), { myWhatsAppNames: [] });
  ingest(a, { filename: "ret1" });
  const t1 = tasksLib.listTasks({ view: "all" }).filter((t) => t.order_number === "900100");
  assert.deepEqual(t1.map((t) => t.category), ["return"]);
  const b = await parseFile("b.eml", eml("ret2@x", "Iga <iga@x.pl>", "Re: Zwrot", "Odeślę paczkę sama we własnym zakresie", "Fri, 09 Oct 2026 10:00:00 +0200", "In-Reply-To: <ret1@x>\r\n"), { myWhatsAppNames: [] });
  ingest(b, { filename: "ret2" });
  const t2 = tasksLib.listTasks({ view: "all" }).filter((t) => t.order_number === "900100");
  assert.deepEqual(t2.map((t) => t.category), ["return_wait"]);
  assert.equal(t2[0].id, t1[0].id, "та же задача, а не новая");
  const ups = await parseFile("u.eml", eml("ups1@x", "UPS <noreply@ups.com>", "UPS exception", "UPS delivery exception, order 900200", "Fri, 09 Oct 2026 10:00:00 +0200"), { myWhatsAppNames: [] });
  ingest(ups, { filename: "ups" });
  const u = tasksLib.listTasks({ view: "all" }).find((t) => t.order_number === "900200")!;
  assert.equal(u.customer_name, null, "робот-отправитель не записывается клиентом");
});
