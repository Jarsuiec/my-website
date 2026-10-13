"use client";

import { useEffect, useState } from "react";
import { call, toast } from "@/components/client";
import { Modal } from "@/components/ui";

type S = {
  settings: Record<string, string>;
  ai: { keyPresent: boolean; allowed: boolean; enabled: boolean; maskPii: boolean; model: string };
  auth: boolean;
  dataDir: string;
  tz: string;
};

export default function Settings() {
  const [s, setS] = useState<S | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [wipe, setWipe] = useState(false);
  const [word, setWord] = useState("");

  const load = () =>
    call<S>("/api/settings").then((r) => {
      setS(r);
      setV(r.settings);
    });
  useEffect(() => {
    load().catch((e) => toast(e.message, "error"));
  }, []);

  const save = async (patch: Record<string, string>) => {
    try {
      const r = await call<{ recomputed: { messages: number } | null }>("/api/settings", { body: patch });
      toast(r.recomputed ? `Сохранено. Пересчитано направление у ${r.recomputed.messages} сообщений` : "Сохранено");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const demo = async (action: string) => {
    try {
      const r = await call<{ result: Record<string, number> }>("/api/demo", { body: { action } });
      toast(action === "load" ? `Демо-данные загружены: задач ${r.result.tasksCreated}` : `Демо-данные удалены: задач ${r.result.tasks}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const doWipe = async () => {
    try {
      await call("/api/wipe", { body: { confirm: word } });
      toast("Все данные удалены (копия сохранена в архиве на сервере)");
      setWipe(false);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (!s) return <div className="empty">Загрузка…</div>;
  return (
    <>
      <div className="page-head">
        <h1>Настройки</h1>
      </div>
      <div className="grid grid-2">
        <div className="card stack">
          <h2>Мои адреса и имена</h2>
          <label className="field">
            Мои рабочие e-mail (через запятую). Можно домен целиком: @moj-sklep.pl
            <textarea value={v.my_addresses ?? ""} onChange={(e) => setV({ ...v, my_addresses: e.target.value })} style={{ minHeight: 70 }} placeholder="sklep@firma.pl, allegro@firma.pl, @firma.pl" />
          </label>
          <label className="field">
            Моё имя в WhatsApp (как в экспорте чата)
            <input value={v.my_whatsapp_names ?? ""} onChange={(e) => setV({ ...v, my_whatsapp_names: e.target.value })} placeholder="Например: Michał Sklep" />
          </label>
          <div className="small muted">Нужно, чтобы отличать ваши ответы от сообщений клиентов. После сохранения направление уже загруженных писем пересчитывается.</div>
          <div className="row">
            <span className="spacer" />
            <button className="btn primary" onClick={() => save({ my_addresses: v.my_addresses ?? "", my_whatsapp_names: v.my_whatsapp_names ?? "" })}>
              Сохранить
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>AI и защита данных (GDPR)</h2>
          <div className="small">
            Ключ <code>ANTHROPIC_API_KEY</code>: {s.ai.keyPresent ? <span className="badge ok">задан</span> : <span className="badge">не задан</span>} · модель{" "}
            <code>{s.ai.model}</code>
          </div>
          <label className="row">
            <input type="checkbox" checked={v.ai_external_allowed === "1"} disabled={!s.ai.keyPresent} onChange={(e) => save({ ai_external_allowed: e.target.checked ? "1" : "0" })} />
            Разрешить отправку рабочих данных в Claude API
          </label>
          <label className="row">
            <input type="checkbox" checked={v.ai_mask_pii !== "0"} onChange={(e) => save({ ai_mask_pii: e.target.checked ? "1" : "0" })} />
            Маскировать e-mail, телефоны и IBAN перед отправкой
          </label>
          <div className="notice warn small">
            Включайте отправку только при наличии разрешения работодателя и правового основания (договор поручения обработки данных, DPA). По умолчанию
            всё работает локально: правила, поиск и шаблоны ответов.
          </div>
        </div>

        <div className="card stack" id="demo">
          <h2>Демо-данные</h2>
          <div className="small muted">Тестовые письма и задачи с пометкой «ДЕМО». Не смешиваются с настоящими и удаляются отдельно.</div>
          <div className="row">
            <button className="btn" onClick={() => demo("load")}>
              Загрузить демо-данные
            </button>
            <button className="btn danger" onClick={() => demo("remove")}>
              Удалить демо-данные
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Система</h2>
          <dl className="kv">
            <dt>Вход по паролю</dt>
            <dd>{s.auth ? "включён" : "выключен — задайте APP_PASSWORD в .env"}</dd>
            <dt>Папка данных</dt>
            <dd>
              <code>{s.dataDir}</code>
            </dd>
            <dt>Часовой пояс</dt>
            <dd>{s.tz}</dd>
          </dl>
          <button className="btn danger" onClick={() => setWipe(true)}>
            Удалить все данные…
          </button>
        </div>
      </div>
      {wipe && (
        <Modal title="Удалить все данные?" onClose={() => setWipe(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>Будут удалены все задачи, сообщения, заметки и история. Перед удалением копия сохраняется в архиве на сервере.</p>
            <label className="field">
              Для подтверждения введите УДАЛИТЬ
              <input value={word} onChange={(e) => setWord(e.target.value)} />
            </label>
            <div className="row">
              <span className="spacer" />
              <button className="btn" onClick={() => setWipe(false)}>
                Отмена
              </button>
              <button className="btn primary" disabled={word !== "УДАЛИТЬ"} onClick={doWipe}>
                Удалить
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
