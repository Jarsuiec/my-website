// Общие справочники. Файл без серверных зависимостей — используется и в интерфейсе.

export const SOURCES = {
  gmail: "Gmail / e-mail",
  allegro: "Allegro",
  decathlon: "Decathlon",
  etsy: "Etsy",
  shopify: "Shopify",
  apilo: "Apilo",
  ups: "UPS",
  dpd: "DPD",
  whatsapp: "WhatsApp",
  reseller: "Перепродавцы",
  website: "Сайт",
  manual: "Вручную",
  other: "Другое",
} as const;
export type SourceId = keyof typeof SOURCES;
export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

export const CATEGORIES = {
  complaint: "Рекламация",
  delivery: "Проблема доставки",
  carrier: "Перевозчик UPS/DPD",
  return_label: "Этикетка возврата",
  return_wait: "Ожидание возврата",
  return: "Возврат",
  invoice: "Фактура",
  reply: "Ответить клиенту",
  shipping: "Отправки / этикетки",
  reseller: "Перепродавцы",
  website: "Сайт",
  automation: "Автоматизация",
  other: "Другое",
} as const;
export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_TASK_TITLES: Record<string, string> = {
  complaint: "Обработать рекламацию",
  delivery: "Проверить доставку",
  carrier: "Проверить перевозчика",
  return_label: "Подготовить этикетку возврата",
  return_wait: "Ожидать возврат от клиента",
  return: "Обработать возврат",
  invoice: "Подготовить фактуру",
  reply: "Ответить клиенту",
};

export const CATEGORY_NEXT_ACTION: Record<string, string> = {
  complaint: "Проверить фото/описание, решить: замена, возврат денег или отказ; ответить клиенту",
  delivery: "Проверить трекинг у перевозчика и сообщить клиенту статус",
  carrier: "Проверить статус в панели UPS/DPD, при необходимости открыть претензию",
  return_label: "Создать обратную этикетку (Apilo/перевозчик) и отправить клиенту",
  return_wait: "Дождаться поступления товара на склад и проверить его",
  return: "Проверить условия возврата и ответить клиенту",
  invoice: "Подготовить фактуру и отправить клиенту",
  reply: "Прочитать сообщение и ответить",
};

export const RETURN_CATEGORIES = ["return", "return_label", "return_wait"];
export const COMPLAINT_CATEGORIES = ["complaint", "carrier"];
export const DELIVERY_CATEGORIES = ["delivery", "carrier"];

export const PRIORITIES = {
  critical: "Критический",
  high: "Высокий",
  normal: "Обычный",
  low: "Низкий",
} as const;
export type PriorityId = keyof typeof PRIORITIES;
export const PRIORITY_ORDER: PriorityId[] = ["critical", "high", "normal", "low"];

export const STATUSES = {
  open: "Нужно действие",
  waiting: "Ожидаю",
  snoozed: "Отложено",
  done: "Выполнено",
} as const;
export type StatusId = keyof typeof STATUSES;

export const RETURN_STAGES = {
  requested: "Запрошен",
  label_sent: "Этикетка отправлена",
  pickup_ordered: "Курьер заказан",
  in_transit: "В пути на склад",
  received: "Поступил на склад",
  refunded: "Деньги возвращены",
} as const;

export const COMPLAINT_STAGES = {
  new: "Новая",
  in_progress: "В работе",
  waiting_carrier: "Ждём перевозчика",
  waiting_customer: "Ждём клиента",
  resolved: "Решена",
} as const;
