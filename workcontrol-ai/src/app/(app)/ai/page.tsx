"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { call } from "@/components/client";
import { RefText } from "@/components/ui";

type Ref = { kind: "task" | "message"; id: number; label: string; sub?: string };
type Msg = { role: "user" | "assistant"; content: string; refs?: Ref[]; notice?: string; mode?: string };
type Status = { keyPresent: boolean; allowed: boolean; enabled: boolean; maskPii: boolean; model: string };

const EXAMPLES = [
  "Что у меня самое срочное сегодня?",
  "Кому я ещё не ответил?",
  "Какие рекламации UPS открыты?",
  "Какие возвраты не поступили на склад?",
  "Покажи все проблемы с DPD",
  "Найди заказ 100234",
  "Какие фактуры нужно сделать?",
  "Что осталось со вчера?",
  "Что я сегодня уже выполнил?",
  "Подготовь отчёт директору",
];

export default function AskAI() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    call<{ status: Status }>("/api/ai").then((r) => setStatus(r.status)).catch(() => {});
    try {
      const saved = sessionStorage.getItem("wc-ai-chat");
      if (saved) setMsgs(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("wc-ai-chat", JSON.stringify(msgs.slice(-40)));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await call<{ text: string; refs: Ref[]; notice?: string; mode: string }>("/api/ai", { body: { question, history } });
      setMsgs((m) => [...m, { role: "assistant", content: r.text, refs: r.refs, notice: r.notice, mode: r.mode }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `Ошибка: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Спросить AI</h1>
          <div className="muted">Отвечает только по данным приложения, со ссылками на задачи [T…] и сообщения [M…]. Ничего не отправляет и не меняет.</div>
        </div>
        {msgs.length > 0 && (
          <button className="btn sm" onClick={() => setMsgs([])}>
            Очистить чат
          </button>
        )}
      </div>
      {status && (
        <div className={`notice ${status.enabled ? "ok" : ""}`} style={{ marginBottom: 16 }}>
          {status.enabled ? (
            <>
              Режим: <b>Claude API</b> ({status.model}). Перед отправкой {status.maskPii ? "персональные данные маскируются" : "данные НЕ маскируются"}.{" "}
              <Link href="/settings">Настройки</Link>
            </>
          ) : (
            <>
              Режим: <b>локальный</b> — правила и поиск по базе, данные никуда не отправляются.{" "}
              {status.keyPresent ? "Ключ API задан, но отправка не разрешена в " : "Для умных ответов задайте ANTHROPIC_API_KEY и разрешите в "}
              <Link href="/settings">Настройках</Link> (только с согласия работодателя).
            </>
          )}
        </div>
      )}
      <div className="chat">
        {!msgs.length && (
          <div className="chips">
            {EXAMPLES.map((e) => (
              <button key={e} className="chip" onClick={() => send(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "me" : ""}`}>
            {m.role === "user" ? (
              <div className="pre">{m.content}</div>
            ) : (
              <>
                <RefText text={m.content} />
                {m.refs && m.refs.length > 0 && (
                  <div className="refs">
                    <span className="muted">Источники:</span>
                    {m.refs.map((r) => (
                      <Link key={r.kind + r.id} href={r.kind === "task" ? `/tasks/${r.id}` : `/messages?m=${r.id}`}>
                        {r.kind === "task" ? "T" : "M"}
                        {r.id} · {r.label} {r.sub && <span className="muted">— {r.sub}</span>}
                      </Link>
                    ))}
                  </div>
                )}
                {m.notice && <div className="small muted" style={{ marginTop: 8 }}>{m.notice}</div>}
              </>
            )}
          </div>
        ))}
        {busy && <div className="bubble muted">Думаю…</div>}
        <div ref={end} />
      </div>
      <form
        className="row"
        style={{ marginTop: 16, position: "sticky", bottom: 0, background: "var(--bg)", padding: "10px 0" }}
        onSubmit={(e) => {
          e.preventDefault();
          send(q);
        }}
      >
        <input style={{ flex: 1, minHeight: 40 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Например: «Напиши клиенту ответ на польском по T12»" />
        <button className="btn primary" style={{ height: 40 }} disabled={busy || !q.trim()}>
          Спросить
        </button>
      </form>
    </>
  );
}
