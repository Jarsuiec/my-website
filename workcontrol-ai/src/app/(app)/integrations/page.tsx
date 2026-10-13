import Link from "next/link";
import { sourcesOverview } from "@/lib/tasks";

export const dynamic = "force-dynamic";

type Integration = {
  id: string;
  name: string;
  how: string;
  env: string[];
  plan: string;
  manual: string;
};

const LIST: Integration[] = [
  {
    id: "gmail",
    name: "Gmail (8–9 рабочих ящиков)",
    how: "Официальный Google OAuth 2.0 + Gmail API (только чтение: gmail.readonly). Каждый ящик подключается отдельно, токены хранятся зашифрованными на сервере.",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    plan: "Этап 3: подключение аккаунтов, загрузка входящих и отправленных (чтобы видеть ваши ответы), инкрементальная синхронизация по historyId.",
    manual: "Сейчас: Google Takeout → .mbox, или «Скачать оригинал» письма → .eml.",
  },
  {
    id: "allegro",
    name: "Allegro",
    how: "Официальный REST API Allegro (OAuth): Centrum Wiadomości (messaging/threads), дискуссии и рекламации (post-purchase issues), возвраты (customer-returns).",
    env: ["ALLEGRO_CLIENT_ID", "ALLEGRO_CLIENT_SECRET"],
    plan: "Этап 3: регистрация приложения в apps.developer.allegro.pl, чтение сообщений и обращений.",
    manual: "Сейчас: уведомления Allegro на почту (импорт писем) или копирование переписки в поле «Вставить текст».",
  },
  {
    id: "decathlon",
    name: "Decathlon (Mirakl)",
    how: "Mirakl Marketplace Seller API (если оператор выдал ключ): сообщения по заказам и инциденты.",
    env: ["MIRAKL_API_URL", "MIRAKL_API_KEY"],
    plan: "Этап 3: при наличии ключа от Decathlon — синхронизация сообщений.",
    manual: "Сейчас: уведомления на почту или вставка текста.",
  },
  {
    id: "etsy",
    name: "Etsy",
    how: "Etsy Open API v3 не даёт доступа к переписке (Messages). Доступны заказы (receipts).",
    env: ["ETSY_API_KEY"],
    plan: "Этап 3: заказы через API; сообщения — через уведомления Etsy на почту.",
    manual: "Сейчас: письма-уведомления Etsy (импорт EML/MBOX) или вставка текста.",
  },
  {
    id: "shopify",
    name: "Shopify",
    how: "Shopify Admin API (custom app token, только чтение): заказы, статусы отправки (fulfillments).",
    env: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN"],
    plan: "Этап 3: сверка заказов дня с отправками и этикетками.",
    manual: "Сейчас: экспорт заказов CSV можно импортировать как задачи (колонка title) или сообщения.",
  },
  {
    id: "apilo",
    name: "Apilo",
    how: "Apilo REST API (OAuth клиента): заказы, отправки, транспортные этикетки.",
    env: ["APILO_API_URL", "APILO_CLIENT_ID", "APILO_CLIENT_SECRET"],
    plan: "Этап 3: контроль соответствия реестра Shopify и этикеток Apilo.",
    manual: "Сейчас: выгрузка CSV/XLSX из Apilo.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp (перепродавцы)",
    how: "Официальный WhatsApp Business Platform (Cloud API) — только для бизнес-номера и с вебхуками. Личный WhatsApp официального API не имеет.",
    env: [],
    plan: "Этап 3–4: при переходе на WhatsApp Business Platform — приём сообщений через вебхук.",
    manual: "Сейчас работает: чат → «Экспорт чата» → .txt → импорт. Ваши сообщения распознаются по имени из Настроек.",
  },
  {
    id: "ups",
    name: "UPS / DPD",
    how: "UPS Tracking API и DPD API (по договору) — статусы посылок по трекингу.",
    env: [],
    plan: "Этап 3–4: автоматическая проверка статусов трекинга из писем.",
    manual: "Сейчас: письма-уведомления перевозчиков импортируются, трекинги извлекаются и ищутся.",
  },
];

export default function Integrations() {
  const sources = sourcesOverview();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Интеграции</h1>
          <div className="muted">Только официальные API. Никакого скрейпинга, обхода защиты или хранения паролей от сервисов.</div>
        </div>
      </div>
      <div className="notice" style={{ marginBottom: 16 }}>
        <b>Ручной импорт работает уже сейчас</b> для всех источников — <Link href="/import">Загрузить данные</Link>. Прямые подключения ниже ещё{" "}
        <b>не реализованы</b>; страница показывает, что для них понадобится.
      </div>
      <div className="grid grid-2">
        {LIST.map((i) => {
          const configured = i.env.length > 0 && i.env.every((e) => !!process.env[e]);
          const src = sources.find((s) => s.id === i.id);
          return (
            <div key={i.id} className="card stack" style={{ gap: 8 }}>
              <div className="row">
                <h2 style={{ margin: 0 }}>{i.name}</h2>
                <span className="spacer" />
                <span className="badge">Не подключено</span>
              </div>
              <div className="small">{i.how}</div>
              <div className="small">
                <span className="muted">Что дальше:</span> {i.plan}
              </div>
              <div className="small">
                <span className="muted">Как работать сейчас:</span> {i.manual}
              </div>
              {i.env.length > 0 && (
                <div className="small muted">
                  Переменные окружения: {i.env.map((e) => <code key={e} style={{ marginRight: 4 }}>{e}</code>)}
                  {configured ? " — заданы (синхронизация появится на этапе 3)" : " — не заданы"}
                </div>
              )}
              {src && src.messages > 0 && <div className="small">Импортировано вручную: {src.messages} сообщ.</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
