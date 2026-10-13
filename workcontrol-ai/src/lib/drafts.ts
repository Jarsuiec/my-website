// Черновики ответов клиентам по шаблонам (без AI). Отправка — только вручную.

type Lang = "pl" | "en" | "de" | "ru";

const T: Record<string, Record<Lang, string>> = {
  delivery: {
    pl: "Dziękujemy za wiadomość. Sprawdzamy status przesyłki{order} u przewoźnika i wrócimy z informacją najszybciej, jak to możliwe.",
    en: "Thank you for your message. We are checking the status of your shipment{order} with the carrier and will get back to you as soon as possible.",
    de: "Vielen Dank für Ihre Nachricht. Wir prüfen den Status Ihrer Sendung{order} beim Versanddienstleister und melden uns schnellstmöglich.",
    ru: "Спасибо за сообщение. Мы проверяем статус отправления{order} у перевозчика и скоро вернёмся с информацией.",
  },
  carrier: {
    pl: "Dziękujemy za informację. Wyjaśniamy sprawę przesyłki{order} z przewoźnikiem i poinformujemy o dalszych krokach.",
    en: "Thank you for the information. We are clarifying the shipment{order} with the carrier and will inform you about the next steps.",
    de: "Danke für die Information. Wir klären die Sendung{order} mit dem Versanddienstleister und informieren Sie über die nächsten Schritte.",
    ru: "Спасибо за информацию. Мы выясняем ситуацию с отправлением{order} у перевозчика и сообщим о дальнейших шагах.",
  },
  return_label: {
    pl: "Dziękujemy za wiadomość. Przygotujemy etykietę zwrotną{order} i prześlemy ją w osobnej wiadomości. Prosimy o staranne zapakowanie produktu.",
    en: "Thank you for your message. We will prepare a return label{order} and send it in a separate message. Please pack the item carefully.",
    de: "Vielen Dank. Wir erstellen ein Rücksendeetikett{order} und senden es Ihnen separat zu. Bitte verpacken Sie den Artikel sorgfältig.",
    ru: "Спасибо за сообщение. Мы подготовим обратную этикетку{order} и пришлём её отдельным письмом. Пожалуйста, аккуратно упакуйте товар.",
  },
  return_wait: {
    pl: "Dziękujemy za informację. Po otrzymaniu i sprawdzeniu zwrotu{order} niezwłocznie poinformujemy o jego rozliczeniu.",
    en: "Thank you for letting us know. Once we receive and inspect the return{order}, we will process it and inform you promptly.",
    de: "Danke für die Information. Sobald die Rücksendung{order} bei uns eingegangen und geprüft ist, informieren wir Sie umgehend.",
    ru: "Спасибо за информацию. Как только возврат{order} поступит и будет проверен, мы сразу сообщим о его оформлении.",
  },
  return: {
    pl: "Dziękujemy za wiadomość. Zwrot{order} jest możliwy — prosimy o informację, czy przygotować etykietę zwrotną, czy odeśle Pan/Pani produkt we własnym zakresie.",
    en: "Thank you for your message. A return{order} is possible — please let us know whether you need a return label or will send the item yourself.",
    de: "Vielen Dank. Eine Rücksendung{order} ist möglich — bitte teilen Sie uns mit, ob Sie ein Rücksendeetikett benötigen oder selbst versenden.",
    ru: "Спасибо за сообщение. Возврат{order} возможен — подскажите, нужна ли обратная этикетка или вы отправите товар самостоятельно.",
  },
  invoice: {
    pl: "Dziękujemy za wiadomość. Przygotujemy fakturę{order}. Prosimy o potwierdzenie danych do faktury (nazwa firmy, adres, NIP), jeśli nie zostały podane w zamówieniu.",
    en: "Thank you for your message. We will prepare the invoice{order}. Please confirm your billing details (company name, address, VAT ID) if they were not provided with the order.",
    de: "Vielen Dank. Wir erstellen die Rechnung{order}. Bitte bestätigen Sie Ihre Rechnungsdaten (Firma, Adresse, USt-IdNr.), falls nicht bei der Bestellung angegeben.",
    ru: "Спасибо за сообщение. Мы подготовим фактуру{order}. Пожалуйста, подтвердите реквизиты (название фирмы, адрес, NIP), если они не были указаны в заказе.",
  },
  complaint: {
    pl: "Przykro nam, że wystąpił problem z zamówieniem{order}. Aby szybko rozpatrzyć reklamację, prosimy o przesłanie zdjęć produktu i opakowania oraz krótkiego opisu usterki.",
    en: "We are sorry that there is a problem with your order{order}. To process your complaint quickly, please send photos of the item and packaging and a short description of the issue.",
    de: "Es tut uns leid, dass es ein Problem mit Ihrer Bestellung{order} gibt. Bitte senden Sie uns Fotos des Artikels und der Verpackung sowie eine kurze Beschreibung des Mangels.",
    ru: "Нам жаль, что с заказом{order} возникла проблема. Чтобы быстро рассмотреть рекламацию, пришлите, пожалуйста, фото товара и упаковки и краткое описание дефекта.",
  },
  reply: {
    pl: "Dziękujemy za wiadomość{order}. ",
    en: "Thank you for your message{order}. ",
    de: "Vielen Dank für Ihre Nachricht{order}. ",
    ru: "Спасибо за сообщение{order}. ",
  },
};

const GREETING: Record<Lang, (name?: string | null) => string> = {
  pl: () => "Dzień dobry,",
  en: (n) => (n ? `Hello ${n.split(" ")[0]},` : "Hello,"),
  de: () => "Guten Tag,",
  ru: (n) => (n ? `Здравствуйте, ${n.split(" ")[0]}!` : "Здравствуйте!"),
};
const SIGN: Record<Lang, string> = {
  pl: "Pozdrawiamy serdecznie,\nZespół obsługi klienta",
  en: "Kind regards,\nCustomer Service Team",
  de: "Mit freundlichen Grüßen\nIhr Kundenservice",
  ru: "С уважением,\nслужба поддержки",
};
// Номер вставляется после слова «заказ» в нужном падеже: «z zamówieniem nr 100251», «przesyłki (zamówienie nr 100251)».
const ORDER: Record<Lang, (o: string, afterNoun: boolean) => string> = {
  pl: (o, n) => (n ? ` nr ${o}` : ` (zamówienie nr ${o})`),
  en: (o, n) => (n ? ` no. ${o}` : ` (order no. ${o})`),
  de: (o, n) => (n ? ` Nr. ${o}` : ` (Bestellung Nr. ${o})`),
  ru: (o, n) => (n ? ` № ${o}` : ` (заказ № ${o})`),
};
const AFTER_NOUN = /(zamówieniem|zamówienia|order|Bestellung|заказом|заказу|заказа)\{order\}/;

export function templateDraft(category: string, lang: string, opts: { order?: string | null; name?: string | null }): string {
  const l = (["pl", "en", "de", "ru"].includes(lang) ? lang : "pl") as Lang;
  const tpl = (T[category] ?? T.reply)[l];
  const body = tpl.replace("{order}", opts.order ? ORDER[l](opts.order, AFTER_NOUN.test(tpl)) : "");
  return `${GREETING[l](opts.name)}\n\n${body.trim()}\n\n${SIGN[l]}`;
}

/** Грубое определение языка клиента по последнему сообщению. */
export function guessLang(text: string): Lang {
  const t = text.toLowerCase();
  if (/[ąćęłńśźż]|\b(dzień dobry|zamówieni|proszę|dziękuj)/.test(t)) return "pl";
  if (/[äöüß]|\b(bitte|danke|bestellung|guten tag)\b/.test(t)) return "de";
  if (/[а-яё]/.test(t)) return "ru";
  return "en";
}
