// Отправляет заказ с сайта в Telegram владельцу.
// Токен бота и chat id лежат в переменных окружения Netlify
// (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) и не попадают в код сайта.
const config = require("../../config.js");

const NAMES = {
  windows: "Переустановка Windows", cleaning: "Чистка и замена термопасты", ssd: "Установка SSD",
  speedup: "Ускорение старого ноутбука", remote: "Удалённая помощь", gaming: "Игровой ПК: FPS и настройка",
  build: "Сборка ПК", advice: "Подбор комплектующих", wifi: "Wi‑Fi и роутер"
};
const WHERE = { remote: "Удалённо", visit: "Выезд", bring: "Привезёт сам(а)" };

const clean = (v, max) => String(v || "").trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  let data;
  try { data = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, body: "Bad JSON" }; }
  if (data.botField) return { statusCode: 200, body: "ok" }; // ловушка для ботов

  const name = clean(data.name, 80);
  const contact = clean(data.contact, 80);
  if (!name || !contact) return { statusCode: 400, body: "Name and contact are required" };

  // Цены считаются здесь из config.js, а не берутся из браузера.
  const discount = Number(config.discount) || 0;
  const ids = Array.isArray(data.items) ? data.items.slice(0, 20) : [];
  let before = 0, total = 0;
  const lines = [];
  ids.forEach((id) => {
    const s = config.services.find((x) => x.id === id);
    if (!s) return;
    const price = Math.round(s.price * (100 - discount) / 100);
    before += s.price; total += price;
    lines.push("• " + NAMES[id] + " — от " + price + " zł" + (discount ? " (было " + s.price + ")" : ""));
  });

  const text = [
    "🛒 Новый заказ с сайта",
    "",
    "Имя: " + name,
    "Контакт: " + contact,
    "Где: " + (WHERE[data.where] || "не указано"),
    "",
    lines.length ? "Услуги:\n" + lines.join("\n") : "Услуга: другое / не знает",
    lines.length ? "Итого: от " + total + " zł" + (discount ? " (скидка " + discount + "%, без скидки " + before + ")" : "") : "",
    "",
    "Описание: " + (clean(data.description, 1500) || "—"),
    "Язык клиента: " + clean(data.lang, 5)
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { statusCode: 500, body: "Telegram is not configured" };

  const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
  if (!res.ok) return { statusCode: 502, body: "Telegram error" };
  return { statusCode: 200, body: "ok" };
};
