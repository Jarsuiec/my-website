// Демо-данные. Все записи помечены is_demo = 1 и удаляются одной кнопкой, не затрагивая настоящие данные.

import { getDb, logActivity } from "./db";
import { ingest } from "./ingest";
import type { RawMessage } from "./parsers";
import { createTask } from "./tasks";

const h = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 36e5);

export function demoMessages(myAddr = "sklep@demo-shop.pl"): RawMessage[] {
  return [
    {
      externalId: "<demo-1@allegro.example>",
      fromName: "Anna Kowalska",
      fromAddr: "anna.kowalska@demo.example",
      toAddr: myAddr,
      subject: "Paczka nie dotarła — zamówienie nr 100234",
      date: h(52),
      body: "Dzień dobry,\nzamówiłam tydzień temu i paczka nadal nie dotarła. Gdzie jest moja przesyłka? Numer zamówienia 100234.\nPozdrawiam, Anna",
      sourceHint: "allegro",
      directionHint: "in",
    },
    {
      externalId: "<demo-2@mail.example>",
      fromName: "Piotr Nowak",
      fromAddr: "p.nowak@demo.example",
      toAddr: myAddr,
      subject: "Reklamacja - uszkodzony produkt",
      date: h(20),
      body: "Witam,\nprodukt przyszedł uszkodzony, pęknięta obudowa. Zamówienie #100251. W załączniku zdjęcia. Proszę o szybką odpowiedź, inaczej zgłoszę sprawę do rzecznika praw konsumenta.",
      sourceHint: "gmail",
      directionHint: "in",
    },
    {
      externalId: "<demo-3@mail.example>",
      fromName: "Katarzyna Wiśniewska",
      fromAddr: "k.wisniewska@demo.example",
      toAddr: myAddr,
      subject: "Zwrot towaru",
      date: h(30),
      body: "Dzień dobry, chcę zwrócić buty z zamówienia 100198 — rozmiar za mały. Czy mogą Państwo przysłać etykietę zwrotną?",
      sourceHint: "decathlon",
      directionHint: "in",
    },
    {
      externalId: "<demo-4@mail.example>",
      fromName: "Sklep",
      fromAddr: myAddr,
      toAddr: "m.zielinski@demo.example",
      subject: "Re: Zwrot zamówienia 100177",
      date: h(70),
      body: "Dzień dobry, oczywiście, zwrot jest możliwy. Proszę dać znać, czy przygotować etykietę.",
      inReplyTo: "<demo-5a@mail.example>",
      sourceHint: "gmail",
      directionHint: "out",
    },
    {
      externalId: "<demo-5a@mail.example>",
      fromName: "Marek Zieliński",
      fromAddr: "m.zielinski@demo.example",
      toAddr: myAddr,
      subject: "Zwrot zamówienia 100177",
      date: h(75),
      body: "Dzień dobry, chciałbym zwrócić zamówienie 100177.",
      sourceHint: "gmail",
      directionHint: "in",
    },
    {
      externalId: "<demo-5b@mail.example>",
      fromName: "Marek Zieliński",
      fromAddr: "m.zielinski@demo.example",
      toAddr: myAddr,
      subject: "Re: Zwrot zamówienia 100177",
      date: h(26),
      inReplyTo: "<demo-4@mail.example>",
      body: "Nie trzeba etykiety, odeślę paczkę sam we własnym zakresie przez InPost. Dziękuję.",
      sourceHint: "gmail",
      directionHint: "in",
    },
    {
      externalId: "<demo-6@mail.example>",
      fromName: "Firma Budex Sp. z o.o.",
      fromAddr: "biuro@budex-demo.example",
      toAddr: myAddr,
      subject: "Prośba o fakturę VAT",
      date: h(6),
      body: "Dzień dobry, prosimy o wystawienie faktury VAT do zamówienia nr 100260. NIP 1234567890. Dziękujemy.",
      sourceHint: "gmail",
      directionHint: "in",
    },
    {
      externalId: "<demo-7@ups.example>",
      fromName: "UPS Quantum View",
      fromAddr: "noreply@ups.com",
      toAddr: myAddr,
      subject: "UPS Update: Delivery Exception 1Z999AA10123456784",
      date: h(10),
      body: "UPS: delivery exception for tracking number 1Z999AA10123456784. The receiver's address is incomplete. Order 100244. Action required.",
      sourceHint: "ups",
      directionHint: "in",
    },
    {
      externalId: "<demo-8@etsy.example>",
      fromName: "Emily Carter",
      fromAddr: "emily.c@demo.example",
      toAddr: myAddr,
      subject: "Question about custom engraving",
      date: h(3),
      body: "Hi! Can you add a custom engraving to the wooden box before shipping? Thanks, Emily",
      sourceHint: "etsy",
      directionHint: "in",
    },
    {
      externalId: "<demo-9@mail.example>",
      fromName: "Jan Mazur",
      fromAddr: "jan.mazur@demo.example",
      toAddr: myAddr,
      subject: "Dziękuję",
      date: h(4),
      body: "Wszystko doszło, dziękuję za szybką wysyłkę!",
      sourceHint: "gmail",
      directionHint: "in",
    },
    {
      externalId: "<demo-10@dpd.example>",
      fromName: "Klaus Becker",
      fromAddr: "k.becker@demo.example",
      toAddr: myAddr,
      subject: "Bestellung 100231 nicht angekommen",
      date: h(98),
      body: "Guten Tag, meine Bestellung 100231 ist nicht angekommen. DPD sagt, das Paket wurde zugestellt, aber ich habe nichts erhalten. Bitte um Hilfe.",
      sourceHint: "gmail",
      directionHint: "in",
    },
  ];
}

export function loadDemo() {
  const r = ingest({ format: "demo", messages: demoMessages(), tasks: [], errors: [] }, { filename: "Демо-данные", isDemo: true });
  // Пара ручных задач из ежедневной рутины
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM tasks WHERE is_demo = 1 AND origin = 'manual'").get()) {
    createTask(
      { title: "Сверить реестр Shopify с этикетками Apilo", category: "shipping", source: "shopify", priority: "high", next_action: "Сравнить количество заказов и этикеток за сегодня" },
      { isDemo: true },
    );
    createTask({ title: "Обновить фото в карточке товара «Plecak 30L»", category: "website", source: "website", priority: "low" }, { isDemo: true });
  }
  return r;
}

export function removeDemo(): { tasks: number; messages: number } {
  const db = getDb();
  let tasks = 0;
  let messages = 0;
  db.transaction(() => {
    const ids = (db.prepare("SELECT id FROM tasks WHERE is_demo = 1").all() as { id: number }[]).map((r) => r.id);
    for (const id of ids) {
      db.prepare("DELETE FROM notes WHERE task_id = ?").run(id);
      db.prepare("DELETE FROM activity WHERE task_id = ?").run(id);
      db.prepare("DELETE FROM task_messages WHERE task_id = ?").run(id);
    }
    tasks = db.prepare("DELETE FROM tasks WHERE is_demo = 1").run().changes;
    db.prepare("DELETE FROM task_messages WHERE message_id IN (SELECT id FROM messages WHERE is_demo = 1)").run();
    messages = db.prepare("DELETE FROM messages WHERE is_demo = 1").run().changes;
    db.prepare("DELETE FROM imports WHERE is_demo = 1").run();
  })();
  logActivity(null, "demo_removed", `Удалены демо-данные: задач ${tasks}, сообщений ${messages}`);
  return { tasks, messages };
}
