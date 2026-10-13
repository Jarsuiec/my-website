// Правила разбора сообщений: источник, номера заказов, трекинги, категории, приоритет.
// Всё детерминированно и без внешних сервисов. Ключевые слова — PL / EN / DE / RU.

import type { PriorityId } from "./constants";

/** Нижний регистр + без диакритики (ą→a, ł→l, ü→u, ё→е), чтобы ключевые слова совпадали в любом написании. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .replace(/ё/g, "е")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function normalizeSubject(subject: string | null | undefined): string {
  let s = (subject || "").trim();
  // Re:, Fwd:, Odp:, PD:, AW:, WG:, Ответ: — в любом количестве
  const prefix = /^(re|fw|fwd|odp|pd|aw|wg|sv|tr|ответ|отв|пересл)\s*(\[\d+\])?\s*:\s*/i;
  while (prefix.test(s)) s = s.replace(prefix, "");
  return fold(s).replace(/\s+/g, " ").trim();
}

const SOURCE_DOMAINS: [RegExp, string][] = [
  [/allegro(mail)?\.(pl|com|cz|sk)|allegromail/i, "allegro"],
  [/decathlon|mirakl/i, "decathlon"],
  [/etsy\.com|etsymail/i, "etsy"],
  [/shopify\.com|myshopify/i, "shopify"],
  [/apilo/i, "apilo"],
  [/\bups\.com|ups\.pl/i, "ups"],
  [/dpd\.(pl|com|de)|dpdgroup/i, "dpd"],
];

export function detectSource(fromAddr: string | null | undefined, subject?: string | null, body?: string | null): string | null {
  const f = fromAddr || "";
  for (const [re, src] of SOURCE_DOMAINS) if (re.test(f)) return src;
  const s = fold(subject || "");
  if (/\ballegro\b/.test(s)) return "allegro";
  if (/\bdecathlon\b/.test(s)) return "decathlon";
  if (/\betsy\b/.test(s)) return "etsy";
  // Тело учитываем только для явных уведомлений платформ
  const b = fold((body || "").slice(0, 600));
  if (/wiadomosc od kupujacego.*allegro|allegro.*wiadomosc od kupujacego/.test(b)) return "allegro";
  return null;
}

const ORDER_KEYWORD =
  /(?:zam[oó]wieni[a-z]*|nr\.?\s*zam\.?|order(?:\s*(?:id|number|no\.?|nr))?|bestell(?:ung|nummer)?(?:\s*nr\.?)?|auftrag(?:snummer)?|commande|заказ[а-я]*|номер заказа)\s*(?:nr\.?|no\.?|number|nummer|номер|№|#)?\s*[:#№]?\s*([A-Z0-9][A-Z0-9-]{2,40})/giu;
const HASH_ORDER = /(?:^|[\s(])#(\d{4,12})\b/g;
const UPS_TRACKING = /\b1Z[0-9A-Z]{16}\b/g;
const TRACKING_KEYWORD =
  /(?:tracking(?:\s*(?:number|no\.?|nr))?|numer\s*(?:przesy[lł]ki|paczki|listu\s*przewozowego)|nr\s*(?:przesy[lł]ki|paczki)|list\s*przewozowy|sendungsnummer|трек(?:-?номер)?|номер\s*отправления)\s*[:#]?\s*([A-Z0-9]{8,30})/giu;

function uniq(list: string[]): string[] {
  return [...new Set(list)];
}

/** Номера заказов — только рядом с ключевым словом или в виде #12345. Ничего не придумываем. */
export function extractOrderNumbers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(ORDER_KEYWORD)) {
    const v = m[1].replace(/-+$/, "");
    if (/\d/.test(v) && v.length >= 3) found.push(v);
  }
  for (const m of text.matchAll(HASH_ORDER)) found.push(m[1]);
  const tracking = new Set(extractTrackingNumbers(text));
  return uniq(found.filter((v) => !tracking.has(v))).slice(0, 10);
}

export function extractTrackingNumbers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(UPS_TRACKING)) found.push(m[0]);
  for (const m of text.matchAll(TRACKING_KEYWORD)) if (/\d/.test(m[1])) found.push(m[1]);
  return uniq(found).slice(0, 10);
}

// ---------- Категории ----------

type Rule = { category: string; patterns: RegExp[] };

// Шаблоны применяются к fold(text), поэтому пишем без диакритики.
const RULES: Rule[] = [
  {
    category: "return_wait",
    patterns: [
      /(odesl|wysl|nadam|nadal)\w*\s+(go|je|towar|paczke|produkt)?\s*(sam|sama|we wlasnym zakresie|samodzielnie)/,
      /(sam|sama)\s+(odesle|wysle|nadam)/,
      /we wlasnym zakresie/,
      /(i will|i'll|i have)\s+(send|ship|post)\w*\s+(it|the item|the parcel)?\s*back/,
      /schicke\w*\s+(es|die ware|das paket)?\s*(selbst\s+)?zuruck/,
      /отправлю\s+(сам|сама|самостоятельно)|верну\s+(сам|сама|самостоятельно)/,
      /(paczka|towar|zwrot)\s+(zostal|zostala)\s+(wyslan|nadan)/,
    ],
  },
  {
    category: "return_label",
    patterns: [
      /etykiet\w*\s+zwrot\w*|zwrotn\w*\s+etykiet\w*|etykiet\w*\s+do\s+zwrotu/,
      /list\w*\s+przewozow\w*\s+(do\s+)?zwrot/,
      /(zamowi\w*|zamowic|przysla\w*)\s+kurier\w*|odbior\w*\s+(przez\s+)?kurier|kurier\s+(po\s+)?odbier/,
      /return\s+(shipping\s+)?label|prepaid\s+label|label\s+for\s+(the\s+)?return/,
      /rucksendeetikett|retourenschein|retourenlabel/,
      /(обратн\w*|возвратн\w*)\s+этикетк\w*|этикетк\w*\s+(для|на)\s+возврат/,
    ],
  },
  {
    category: "complaint",
    patterns: [
      /reklamac\w*|reklamuj\w*/,
      /uszkodz\w*|zniszcz\w*|pekniet\w*|zepsut\w*|nie dziala|wadliw\w*|wada\b|usterk\w*/,
      /niezgodn\w*\s+z\s+(opisem|zamowieniem)|zly\s+(rozmiar|kolor|produkt)|inny\s+produkt|brakuje\s+\w+\s+w\s+paczce/,
      /\bdamaged\b|\bbroken\b|\bdefective\b|not working|wrong item|\bcomplaint\b/,
      /beschadigt|kaputt|defekt|reklamation|mangel/,
      /рекламаци\w*|поврежд\w*|сломан\w*|брак\b|не работает|претензи\w*/,
    ],
  },
  {
    category: "carrier",
    patterns: [
      /(ups|dpd)\b.*\b(wyjatek|exception|opozni\w*|delay\w*|nieudan\w*|zwrot do nadawcy|returned to sender|zatrzyman\w*|uszkodz\w*|damage\w*|claim|roszczen\w*|zagubi\w*|lost)/,
      /(wyjatek|exception|zwrot do nadawcy|returned to sender|address (correction|problem)|bledny adres|niepelny adres)\b.*\b(ups|dpd)\b/,
      /delivery\s+exception|zustellung\s+(nicht moglich|fehlgeschlagen)/,
    ],
  },
  {
    category: "delivery",
    patterns: [
      /(paczk\w*|przesylk\w*|zamowieni\w*|towar)\s+(nie\s+)?(dotarl\w*|doszl\w*|przyszl\w*)/,
      /nie\s+(dostal\w*|otrzymal\w*|dotarl\w*|doszl\w*)/,
      /gdzie\s+(jest\s+)?(moja\s+)?(paczka|przesylka|zamowienie)|kiedy\s+(dotrze|przyjdzie|wyslecie|bedzie wyslan)/,
      /status\s+(przesylki|paczki|zamowienia)|sledzen\w*\s+przesylki|numer\s+(przesylki|sledzenia)/,
      /(not|never)\s+(arrived|received|delivered)|where\s+is\s+my\s+(order|parcel|package)|has(n't| not) arrived|tracking/,
      /nicht\s+(angekommen|erhalten|zugestellt)|wo\s+ist\s+mein\w*\s+(paket|bestellung|sendung)/,
      /(не\s+пришл\w*|не\s+получил\w*|не\s+доставлен\w*|где\s+(мой|моя|мое)\s+(заказ|посылка))/,
    ],
  },
  {
    category: "return",
    patterns: [
      /\bzwrot\w*|zwroc\w*|odstapien\w*\s+od\s+umowy|odstepuje\s+od\s+umowy/,
      /\breturn(ing)?\b\s+(the|my|this|an?)?\s*(item|order|product|it)|refund|i want to return/,
      /rucksendung|zuruckgeben|zurucksenden|widerruf|erstattung/,
      /возврат\w*|вернуть\s+(товар|заказ|деньги)/,
    ],
  },
  {
    category: "invoice",
    patterns: [
      /faktur\w*|\bfv\b|paragon\w*\s+(na\s+)?(firm|nip)|\bnip\b/,
      /\binvoice\b|\bvat\s+(invoice|receipt)\b/,
      /\brechnung\b/,
      /фактур\w*|счет-фактур\w*|инвойс/,
    ],
  },
];

const CRITICAL_PATTERNS = [
  /\bpilne\b|\bpilnie\b|natychmiast|\burgent\w*|\basap\b|\bdringend\b|\bsofort\b|срочн\w*/,
  /rzecznik\w*\s+(praw\s+)?konsument|uokik|prawnik|adwokat|kancelari|\bsad\w*\s+(polubown|rejonow)|policj|pozew|wezwanie do zaplaty|ostateczne wezwanie/,
  /chargeback|dispute|spor\w*\s+(w\s+)?(allegro|paypal)|otworz\w*\s+(spor|dyskusj)|zglos\w*\s+do\s+(allegro|banku|paypal)/,
  /negatywn\w*\s+(opini|komentarz|ocen)|negative\s+(review|feedback)|1\s*gwiazdk/,
  /anwalt|verbraucherzentrale|юрист|суд\b|полици/,
];

const QUESTION_OR_REQUEST = [
  /\?/,
  /prosze|prosimy|potrzebuje|czy\s+(moge|mozna|mozecie)|chcial(bym|abym)|bardzo prosze/,
  /please|could you|can you|i need|i would like/,
  /bitte|konnen sie|ich mochte/,
  /пожалуйста|прошу|нужно|можно ли|подскажите/,
];

const NOREPLY = /no-?reply|do-?not-?reply|nie-?odpowiadaj|notifications?@|mailer-daemon|newsletter/i;

export type Classification = {
  categories: string[];
  critical: boolean;
  needsReplyHint: boolean;
};

export function classify(subject: string | null | undefined, body: string | null | undefined, fromAddr?: string | null): Classification {
  // Цитаты предыдущих писем (строки с ">" и блоки «W dniu ... napisał») не учитываем.
  const cleanBody = stripQuoted(body || "");
  const text = fold(`${subject || ""}\n${cleanBody}`.slice(0, 8000));
  const categories: string[] = [];
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) categories.push(rule.category);
  }
  // «Ожидание возврата» и «этикетка» точнее, чем общий «возврат».
  if (categories.includes("return") && (categories.includes("return_wait") || categories.includes("return_label"))) {
    categories.splice(categories.indexOf("return"), 1);
  }
  if (categories.includes("return_wait") && categories.includes("return_label")) {
    categories.splice(categories.indexOf("return_label"), 1);
  }
  // Жалоба на перевозчика без клиента — carrier; клиентское «не дошло» — delivery. Оба не нужны.
  if (categories.includes("carrier") && categories.includes("delivery")) {
    categories.splice(categories.indexOf("delivery"), 1);
  }
  const critical = CRITICAL_PATTERNS.some((p) => p.test(text));
  const automated = NOREPLY.test(fromAddr || "");
  const needsReplyHint = !automated && QUESTION_OR_REQUEST.some((p) => p.test(text));
  return { categories, critical, needsReplyHint };
}

export function stripQuoted(body: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (/^(w dniu|dnia|on\s.+wrote:|am\s.+schrieb|-----\s*(original|oryginalna|ursprungliche)|_{5,}|от:\s|from:\s.+@)/i.test(l)) break;
    if (l.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n");
}

const BASE_PRIORITY: Record<string, PriorityId> = {
  complaint: "high",
  carrier: "high",
  delivery: "high",
  return_label: "normal",
  return: "normal",
  invoice: "normal",
  reply: "normal",
  return_wait: "low",
};

const LEVELS: PriorityId[] = ["low", "normal", "high", "critical"];

/**
 * Автоприоритет: базовый по категории, «критический» при угрозах/срочности,
 * +1 уровень если клиент ждёт ответа дольше 48 часов.
 */
export function suggestPriority(category: string, opts: { critical?: boolean; waitingSince?: string | null; now?: Date }): PriorityId {
  if (opts.critical) return "critical";
  let p = BASE_PRIORITY[category] ?? "normal";
  if (opts.waitingSince) {
    const hours = ((opts.now ?? new Date()).getTime() - new Date(opts.waitingSince).getTime()) / 36e5;
    if (hours > 48) p = LEVELS[Math.min(LEVELS.indexOf(p) + 1, 3)];
  }
  return p;
}

/** Короткое описание: первые содержательные строки без цитат и подписи. */
export function summarize(body: string, max = 220): string {
  const text = stripQuoted(body)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^(dzien dobry|dzień dobry|witam|hello|hi|guten tag|здравствуйте|добрый день)[,!.]?$/i.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function isAutomatedSender(addr: string | null | undefined): boolean {
  return NOREPLY.test(addr || "");
}
