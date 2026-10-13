// Сквозной тест: запускает настоящий production-сервер на временной базе и проверяет сценарии через HTTP.
// Запуск: npm run build && npm run test:e2e

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";
import ExcelJS from "exceljs";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-e2e-"));
const PORT = 3217;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "test-password-123";

let cookie = "";
const results: { name: string; ok: boolean; err?: string }[] = [];

async function req(p: string, opts: { method?: string; json?: unknown; form?: FormData; raw?: boolean; noAuth?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (!opts.noAuth && cookie) headers.cookie = cookie;
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) body = opts.form;
  const res = await fetch(BASE + p, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, redirect: "manual" });
  return res;
}
async function json<T = any>(p: string, opts: Parameters<typeof req>[1] = {}): Promise<T> {
  const r = await req(p, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(`${p} → ${r.status}: ${JSON.stringify(data)}`);
  return data as T;
}
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: (e as Error).message });
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}
function filesForm(files: { name: string; data: Buffer | string }[], extra: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  for (const f of files) fd.append("files", new Blob([typeof f.data === "string" ? Buffer.from(f.data) : new Uint8Array(f.data)]), f.name);
  return fd;
}
const sample = (n: string) => ({ name: n, data: fs.readFileSync(path.join(root, "samples", n)) });

async function main() {
  const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    cwd: root,
    env: { ...process.env, DATA_DIR: dataDir, APP_PASSWORD: PASSWORD, ANTHROPIC_API_KEY: "", TZ: "Europe/Warsaw" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  try {
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(BASE + "/login");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    console.log(`Сервер запущен, данные: ${dataDir}\n`);

    await step("без входа API отвечает 401, страницы перенаправляют на /login", async () => {
      assert.equal((await req("/api/tasks", { noAuth: true })).status, 401);
      const r = await req("/", { noAuth: true });
      assert.ok([302, 307, 308].includes(r.status), `status ${r.status}`);
      assert.match(r.headers.get("location") || "", /\/login/);
    });

    await step("неверный пароль отклоняется, верный — даёт сессию", async () => {
      assert.equal((await req("/api/auth/login", { json: { password: "wrong" } })).status, 401);
      const r = await req("/api/auth/login", { json: { password: PASSWORD } });
      assert.equal(r.status, 200);
      cookie = (r.headers.get("set-cookie") || "").split(";")[0];
      assert.match(cookie, /^wc_session=/);
      assert.match(r.headers.get("set-cookie") || "", /HttpOnly/i);
    });

    await step("запрос с чужого Origin отклоняется", async () => {
      const r = await fetch(BASE + "/api/tasks", { method: "POST", headers: { cookie, "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
      assert.equal(r.status, 403);
    });

    await step("настройки: мои адреса и имя WhatsApp сохраняются", async () => {
      await json("/api/settings", { json: { my_addresses: "sklep@example.invalid", my_whatsapp_names: "Ja" } });
      const s = await json("/api/settings");
      assert.equal(s.settings.my_addresses, "sklep@example.invalid");
    });

    let firstCounts = { tasks: 0, messages: 0 };
    await step("импорт EML, MBOX, CSV, WhatsApp, XLSX, ZIP и текста", async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Zadania");
      ws.addRow(["title", "order", "priority"]);
      ws.addRow(["Zaktualizować zdjęcia produktu", "", "low"]);
      ws.addRow(["Sprawdzić rejestr Shopify z etykietami Apilo", "", "high"]);
      const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
      const zip = new JSZip();
      zip.file("mail/one.eml", `Message-ID: <zip-1@example.invalid>\r\nFrom: Ola <ola@example.invalid>\r\nTo: sklep@example.invalid\r\nSubject: Reklamacja\r\nDate: Mon, 12 Oct 2026 14:00:00 +0200\r\n\r\nProdukt uszkodzony, zamówienie nr 700600. Proszę o kontakt.\r\n`);
      zip.file("readme.doc", "x");
      const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
      const r = await json<{ results: any[] }>("/api/import", {
        form: filesForm(
          [
            sample("przyklad-allegro.eml"),
            sample("gmail-takeout-przyklad.mbox"),
            sample("zgloszenia-przyklad.csv"),
            sample("WhatsApp Chat with Hurtownia Marek.txt"),
            { name: "zadania.xlsx", data: xlsx },
            { name: "archiwum.zip", data: zipBuf },
          ],
          { source: "auto", text: "Od: Kasia <kasia@example.invalid>\nTemat: Pytanie\n\nCzy mogę odebrać zamówienie nr 700610 osobiście?" },
        ),
      });
      const added = r.results.reduce((s, x) => s + x.added, 0);
      assert.equal(added, 11, `добавлено ${added}: ${JSON.stringify(r.results.map((x) => [x.filename, x.added, x.errors]))}`);
      const created = r.results.reduce((s, x) => s + x.tasksCreated, 0);
      assert.ok(created >= 9, `создано задач ${created}`);
      const zipRes = r.results.find((x) => x.filename === "archiwum.zip");
      assert.ok(zipRes.errors.some((e: string) => /readme\.doc/.test(e)), "неподдерживаемый файл в ZIP отмечен");
      const tasks = (await json("/api/tasks?view=all")).tasks;
      const stats = (await json("/api/stats")).stats;
      firstCounts = { tasks: tasks.length, messages: stats.messages };
    });

    await step("автоматические задачи: категории, заказы, источник, ответы", async () => {
      const tasks = (await json("/api/tasks?view=all")).tasks as any[];
      const by = (order: string) => tasks.find((t) => t.order_number === order);
      assert.equal(by("700512")?.category, "delivery");
      assert.equal(by("700512")?.source, "gmail"); // письмо от покупателя — источник определяется как e-mail
      assert.equal(by("700530")?.category, "invoice");
      assert.equal(by("700530")?.needs_reply, 0, "ответ из папки Sent учтён");
      assert.equal(by("700498")?.category, "complaint");
      assert.equal(by("700540")?.category, "return_label");
      assert.equal(by("700540")?.source, "decathlon");
      assert.equal(by("700555")?.category, "delivery");
      assert.equal(by("700600")?.category, "complaint");
      const wa = tasks.find((t) => t.source === "whatsapp");
      assert.ok(wa, "задача из WhatsApp");
      assert.equal(wa.category, "invoice");
      assert.ok(tasks.find((t) => t.title === "Sprawdzić rejestr Shopify z etykietami Apilo" && t.priority === "high"), "задача из XLSX");
      assert.ok(tasks.find((t) => t.order_number === "700610" && t.category === "reply"), "задача из вставленного текста");
    });

    await step("повторный импорт тех же файлов не создаёт дубликатов", async () => {
      const r = await json<{ results: any[] }>("/api/import", {
        form: filesForm([sample("przyklad-allegro.eml"), sample("gmail-takeout-przyklad.mbox"), sample("zgloszenia-przyklad.csv"), sample("WhatsApp Chat with Hurtownia Marek.txt")], {
          text: "Od: Kasia <kasia@example.invalid>\nTemat: Pytanie\n\nCzy mogę odebrać zamówienie nr 700610 osobiście?",
        }),
      });
      assert.equal(r.results.reduce((s, x) => s + x.added, 0), 0);
      assert.equal(r.results.reduce((s, x) => s + x.tasksCreated, 0), 0);
      const tasks = (await json("/api/tasks?view=all")).tasks;
      assert.equal(tasks.length, firstCounts.tasks);
      assert.equal((await json("/api/stats")).stats.messages, firstCounts.messages);
    });

    let taskId = 0;
    await step("ручная задача: создание, редактирование, заметка", async () => {
      taskId = (await json("/api/tasks", { json: { title: "Отправить этикетку клиенту Ewa", category: "return_label", source: "allegro", order_number: "800001", priority: "critical" } })).id;
      await json(`/api/tasks/${taskId}`, { method: "PATCH", json: { summary: "Клиент ждёт до пятницы", stage: "label_sent" } });
      await json(`/api/tasks/${taskId}/notes`, { json: { body: "Этикетка DPD создана в Apilo" } });
      const d = await json(`/api/tasks/${taskId}`);
      assert.equal(d.task.summary, "Клиент ждёт до пятницы");
      assert.equal(d.task.stage, "label_sent");
      assert.equal(d.notes.length, 1);
      assert.ok(d.activity.length >= 3);
    });

    await step("ручные изменения автозадачи сохраняются при повторном импорте", async () => {
      const t = ((await json("/api/tasks?view=all")).tasks as any[]).find((x) => x.order_number === "700512");
      await json(`/api/tasks/${t.id}`, { method: "PATCH", json: { title: "Позвонить в UPS по 700512", priority: "low" } });
      await json(`/api/tasks/${t.id}/notes`, { json: { body: "Ждём ответ перевозчика" } });
      await json("/api/import", { form: filesForm([sample("przyklad-allegro.eml")]) });
      const d = await json(`/api/tasks/${t.id}`);
      assert.equal(d.task.title, "Позвонить в UPS по 700512");
      assert.equal(d.task.priority, "low");
      assert.equal(d.notes.length, 1);
    });

    await step("статусы: ответил → ожидаю, отложить, выполнено → история", async () => {
      await json(`/api/tasks/${taskId}/action`, { json: { action: "replied" } });
      let d = await json(`/api/tasks/${taskId}`);
      assert.equal(d.task.status, "waiting");
      const bad = await req(`/api/tasks/${taskId}/action`, { json: { action: "snooze", until: "2000-01-01T00:00:00Z" } });
      assert.equal(bad.status, 400);
      await json(`/api/tasks/${taskId}/action`, { json: { action: "snooze", until: new Date(Date.now() + 864e5).toISOString() } });
      d = await json(`/api/tasks/${taskId}`);
      assert.equal(d.task.status, "snoozed");
      await json(`/api/tasks/${taskId}/action`, { json: { action: "done" } });
      const active = (await json("/api/tasks?view=active")).tasks as any[];
      assert.ok(!active.some((t) => t.id === taskId), "выполненная скрыта из активных");
      const done = (await json("/api/tasks?view=done")).tasks as any[];
      assert.ok(done.some((t) => t.id === taskId), "выполненная есть в истории");
      const stats = (await json("/api/stats")).stats;
      assert.ok(stats.done_today >= 1);
    });

    await step("фильтры и поиск", async () => {
      const allegro = (await json("/api/tasks?view=all&source=decathlon")).tasks as any[];
      assert.ok(allegro.length >= 1 && allegro.every((t) => t.source === "decathlon"));
      const crit = (await json("/api/tasks?view=all&priority=low")).tasks as any[];
      assert.ok(crit.every((t) => t.priority === "low"));
      const returns = (await json("/api/tasks?preset=returns")).tasks as any[];
      assert.ok(returns.every((t) => ["return", "return_label", "return_wait"].includes(t.category)));
      const s = await json("/api/search?q=" + encodeURIComponent("Dąbrowska"));
      assert.ok(s.tasks.length >= 1, "поиск по клиенту с польскими буквами");
      const s2 = await json("/api/search?q=dabrowska");
      assert.ok(s2.tasks.length >= 1, "поиск без диакритики");
      const s3 = await json("/api/search?q=700498");
      assert.ok(s3.messages.length >= 1, "поиск по номеру заказа");
      const from = (await json("/api/tasks?view=all&from=2099-01-01")).tasks;
      assert.equal(from.length, 0, "фильтр по дате");
    });

    await step("сообщения: переписки, пропущенные, отметка «не требует ответа»", async () => {
      const th = (await json("/api/threads")).threads as any[];
      assert.ok(th.length >= 8);
      const invoiceThread = th.find((t) => /700530/.test(t.subject || ""));
      assert.equal(invoiceThread.count, 2, "письмо и ответ в одной переписке");
      const detail = await json(`/api/threads/detail?key=${encodeURIComponent(invoiceThread.thread_key)}`);
      assert.equal(detail.messages.length, 2);
      // Новое письмо без задачи (просто «спасибо» с вопросом нет) → проверяем «пропущенные»
      await json("/api/import", { form: filesForm([], { text: "Od: Leon <leon@example.invalid>\nTemat: Info\n\nPaczka odebrana, wszystko ok." }) });
      let missed = (await json("/api/threads?filter=missed")).threads as any[];
      const leon = missed.find((t) => t.from_addr === "leon@example.invalid");
      assert.ok(leon, "сообщение без задачи попало в «возможно пропущенные»");
      await json("/api/threads/dismiss", { json: { key: leon.thread_key } });
      missed = (await json("/api/threads?filter=missed")).threads as any[];
      assert.ok(!missed.some((t) => t.from_addr === "leon@example.invalid"));
      const m = await json(`/api/messages/${leon.last_id}`);
      assert.equal(m.thread_key, leon.thread_key);
    });

    await step("AI-помощник в локальном режиме отвечает со ссылками", async () => {
      const st = await json("/api/ai");
      assert.equal(st.status.enabled, false);
      const a = await json("/api/ai", { json: { question: "Какие рекламации открыты?" } });
      assert.equal(a.mode, "local");
      assert.ok(a.refs.length >= 2, JSON.stringify(a));
      const b = await json("/api/ai", { json: { question: "Найди заказ 700540" } });
      assert.ok(b.refs.some((r: any) => r.kind === "task"));
      const c = await json("/api/ai", { json: { question: "Подготовь отчёт директору" } });
      assert.match(c.text, /Отчёт WorkControl AI/);
      const t = ((await json("/api/tasks?view=all")).tasks as any[]).find((x) => x.order_number === "700498");
      const dr = await json(`/api/tasks/${t.id}/draft`, { json: { lang: "auto" } });
      assert.equal(dr.lang, "de", "язык клиента определён как немецкий");
      assert.match(dr.text, /Guten Tag/);
    });

    let zipBackup: Buffer = Buffer.alloc(0);
    await step("архив: ZIP, JSON, CSV, отчёт, контекст для Claude", async () => {
      const z = await req("/api/archive?type=zip");
      assert.equal(z.status, 200);
      zipBackup = Buffer.from(await z.arrayBuffer());
      const zip = await JSZip.loadAsync(zipBackup);
      for (const f of ["backup.json", "tasks.csv", "messages.csv", "report.md", "claude-context.md", "README.txt"]) assert.ok(zip.file(f), `в ZIP есть ${f}`);
      const b = JSON.parse(await zip.file("backup.json")!.async("string"));
      assert.equal(b.format, "workcontrol-backup");
      assert.ok(b.created_at && b.tables.notes.length >= 2);
      const csv = await (await req("/api/archive?type=tasks.csv")).text();
      assert.match(csv, /Название/);
      const cl = await json("/api/archive?type=claude.preview&mask=1");
      assert.doesNotMatch(cl.text, /julia\.k@example\.invalid/);
      assert.match(cl.text, /Сформировано: 20/);
      const snap = await json("/api/archive/snapshot", { method: "POST" });
      assert.match(snap.name, /workcontrol-manual-/);
      const list = await json("/api/archive/snapshots");
      assert.ok(list.snapshots.some((s: any) => s.name === snap.name));
      const dl = await req(`/api/archive/snapshots/${snap.name}`);
      assert.equal(dl.status, 200);
      assert.equal((await req("/api/archive/snapshots/..%2F..%2Fetc%2Fpasswd")).status, 404);
    });

    await step("восстановление: удалить всё → восстановить из ZIP", async () => {
      const before = (await json("/api/tasks?view=all")).tasks.length;
      assert.equal((await req("/api/wipe", { json: { confirm: "нет" } })).status, 400);
      await json("/api/wipe", { json: { confirm: "УДАЛИТЬ" } });
      assert.equal((await json("/api/tasks?view=all")).tasks.length, 0);
      const fd = new FormData();
      fd.set("confirm", "yes");
      fd.set("file", new Blob([new Uint8Array(zipBackup)]), "backup.zip");
      const r = await json("/api/archive/restore", { form: fd });
      assert.ok(r.safetyCopy);
      assert.equal((await json("/api/tasks?view=all")).tasks.length, before);
      const s = await json("/api/search?q=700498");
      assert.ok(s.messages.length >= 1, "поиск работает после восстановления");
      const bad = new FormData();
      bad.set("confirm", "yes");
      bad.set("file", new Blob([Buffer.from("{}")]), "x.json");
      assert.equal((await req("/api/archive/restore", { form: bad })).status, 400);
    });

    await step("ошибки: неподдерживаемый файл, пустой импорт, битый JSON", async () => {
      const r = await json<{ results: any[] }>("/api/import", { form: filesForm([{ name: "virus.exe", data: "MZ" }, { name: "fake.pdf", data: "not a pdf" }]) });
      assert.match(r.results[0].errors[0], /не поддерживается/);
      assert.match(r.results[1].errors[0], /не является PDF/);
      assert.equal((await req("/api/import", { form: new FormData() })).status, 400);
      const bad = await fetch(BASE + "/api/tasks", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{oops" });
      assert.equal(bad.status, 400);
      assert.equal((await req("/api/tasks/999999")).status, 404);
      assert.equal((await req("/api/tasks", { json: { title: "" } })).status, 400);
    });

    await step("демо-данные загружаются и удаляются отдельно", async () => {
      const before = (await json("/api/tasks?view=all&demo=hide")).tasks.length;
      await json("/api/demo", { json: { action: "load" } });
      const demo = (await json("/api/tasks?view=all&demo=only")).tasks;
      assert.ok(demo.length >= 8);
      await json("/api/demo", { json: { action: "remove" } });
      assert.equal((await json("/api/tasks?view=all&demo=only")).tasks.length, 0);
      assert.equal((await json("/api/tasks?view=all")).tasks.length, before);
    });

    await step("все страницы открываются (HTTP 200)", async () => {
      const t = ((await json("/api/tasks?view=all")).tasks as any[])[0];
      for (const p of ["/", "/tasks", `/tasks/${t.id}`, "/messages", "/returns", "/complaints", "/ai", "/import", "/archive", "/integrations", "/settings", "/search?q=test"]) {
        const r = await req(p);
        assert.equal(r.status, 200, `${p} → ${r.status}`);
        const html = await r.text();
        assert.match(html, /WorkControl AI/);
      }
      const integ = await (await req("/integrations")).text();
      assert.match(integ, /Не подключено/);
    });

    await step("данные сохраняются после перезапуска сервера", async () => {
      const before = (await json("/api/tasks?view=all")).tasks.length;
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1500));
      const s2 = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(PORT)], {
        cwd: root,
        env: { ...process.env, DATA_DIR: dataDir, APP_PASSWORD: PASSWORD, ANTHROPIC_API_KEY: "" },
        stdio: "ignore",
      });
      try {
        for (let i = 0; i < 60; i++) {
          try {
            await fetch(BASE + "/login");
            break;
          } catch {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        assert.equal((await json("/api/tasks?view=all")).tasks.length, before, "сессия и данные сохранились");
      } finally {
        s2.kill("SIGTERM");
      }
    });
  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nИтого: ${results.length - failed.length} пройдено, ${failed.length} с ошибками`);
  if (failed.length) {
    console.log("\n--- журнал сервера (последние строки) ---\n" + log.split("\n").slice(-40).join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
