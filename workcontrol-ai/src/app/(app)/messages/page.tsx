"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { call, relTime, toast, fmtDate } from "@/components/client";
import { MessageCard } from "@/components/MessageCard";
import { NewTaskModal, type Task } from "@/components/TaskList";
import { DemoBadge, SourceBadge, SourceSelect, StatusBadge } from "@/components/ui";
import type { MessageRow } from "@/lib/ingest";
import type { ThreadSummary } from "@/lib/tasks";

type ThreadDetail = { messages: MessageRow[]; tasks: Task[]; dismissed_at: string | null };

function MessagesInner() {
  const sp = useSearchParams();
  const [filter, setFilter] = useState(sp.get("filter") || "");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [key, setKey] = useState<string | null>(sp.get("t"));
  const [highlight, setHighlight] = useState<number | null>(sp.get("m") ? Number(sp.get("m")) : null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(() => {
    const qs = new URLSearchParams({ filter, q, source }).toString();
    call<{ threads: ThreadSummary[] }>(`/api/threads?${qs}`)
      .then((r) => setThreads(r.threads))
      .catch((e) => toast(e.message, "error"));
  }, [filter, q, source]);
  useEffect(() => {
    const t = setTimeout(loadList, 200);
    return () => clearTimeout(t);
  }, [loadList]);

  useEffect(() => {
    const m = sp.get("m");
    if (m)
      call<{ thread_key: string }>(`/api/messages/${m}`)
        .then((r) => {
          setKey(r.thread_key);
          setHighlight(Number(m));
        })
        .catch((e) => toast(e.message, "error"));
  }, [sp]);

  const loadDetail = useCallback(() => {
    if (!key) return setDetail(null);
    call<ThreadDetail>(`/api/threads/detail?key=${encodeURIComponent(key)}`)
      .then(setDetail)
      .catch((e) => toast(e.message, "error"));
  }, [key]);
  useEffect(loadDetail, [loadDetail]);
  useEffect(() => {
    if (highlight && detail) document.getElementById(`m${highlight}`)?.scrollIntoView({ block: "center" });
  }, [highlight, detail]);

  const dismiss = async () => {
    if (!key) return;
    await call("/api/threads/dismiss", { body: { key } });
    toast("Отмечено: не требует ответа");
    loadList();
    loadDetail();
  };

  const last = detail?.messages[detail.messages.length - 1];
  const lastIn = detail ? [...detail.messages].reverse().find((m) => m.direction !== "out") : undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Сообщения</h1>
          <div className="muted">Все импортированные письма и чаты, сгруппированные по перепискам.</div>
        </div>
      </div>
      <div className="filters">
        <input type="search" placeholder="Поиск по тексту, отправителю, заказу…" value={q} onChange={(e) => setQ(e.target.value)} />
        <SourceSelect value={source} onChange={setSource} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Фильтр">
          <option value="">Все переписки</option>
          <option value="unanswered">Последнее сообщение — от клиента</option>
          <option value="missed">Возможно пропущенные (без задачи)</option>
        </select>
      </div>
      {filter === "missed" && (
        <div className="notice warn small" style={{ marginBottom: 12 }}>
          Здесь переписки, где последнее сообщение от человека (не робота), после него нет вашего ответа в загруженной истории и нет активной задачи. Это
          подсказка, а не утверждение: если отправленные письма не импортированы, ответ мог быть.
        </div>
      )}
      <div className="split">
        <div className="card" style={{ padding: 0, maxHeight: "75vh", overflow: "auto" }}>
          {!threads ? (
            <div className="empty">Загрузка…</div>
          ) : !threads.length ? (
            <div className="empty" style={{ border: 0 }}>
              Ничего не найдено.
            </div>
          ) : (
            <div className="threads">
              {threads.map((t) => (
                <div
                  key={t.thread_key}
                  className={`thread-row ${t.thread_key === key ? "active" : ""}`}
                  onClick={() => {
                    setKey(t.thread_key);
                    setHighlight(null);
                  }}
                >
                  <span className="who">
                    {t.last_direction === "out" ? "Вы → " : ""}
                    {t.from_name || t.from_addr || "?"}
                  </span>
                  <span className="small muted">{relTime(t.last_at)}</span>
                  <span className="small" style={{ gridColumn: "1 / -1" }}>
                    {t.subject || "(без темы)"}
                  </span>
                  <span className="snip">{t.snippet}</span>
                  <span className="row small" style={{ gridColumn: "1 / -1", gap: 6 }}>
                    <SourceBadge s={t.source} />
                    <span className="muted">{t.count} сообщ.</span>
                    {t.active_tasks > 0 && <span className="badge normal">задач: {t.active_tasks}</span>}
                    {t.last_direction !== "out" && t.active_tasks === 0 && <span className="badge warn">без задачи</span>}
                    <DemoBadge on={t.is_demo} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          {!detail ? (
            <div className="empty">Выберите переписку слева.</div>
          ) : (
            <div className="stack">
              <div className="card">
                <div className="row">
                  <h2 style={{ margin: 0 }}>{detail.messages[0]?.subject || "(без темы)"}</h2>
                  <span className="spacer" />
                  <button className="btn sm primary" onClick={() => setCreating(true)}>
                    + Создать задачу
                  </button>
                  {last?.direction !== "out" && (
                    <button className="btn sm" onClick={dismiss} title="Убрать из «Возможно пропущенных»">
                      Не требует ответа
                    </button>
                  )}
                </div>
                {detail.dismissed_at && <div className="small muted">Отмечено как не требующее ответа: {fmtDate(detail.dismissed_at)}</div>}
                {detail.tasks.length > 0 && (
                  <div className="stack" style={{ marginTop: 10, gap: 6 }}>
                    {detail.tasks.map((t) => (
                      <div key={t.id} className="row small">
                        <StatusBadge s={t.status} />
                        <Link href={`/tasks/${t.id}`}>
                          T{t.id} · {t.title}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {detail.messages.map((m) => (
                <MessageCard key={m.id} m={m} highlight={m.id === highlight} />
              ))}
            </div>
          )}
        </div>
      </div>
      {creating && detail && (
        <NewTaskModal
          onClose={() => setCreating(false)}
          onDone={() => {
            loadDetail();
            loadList();
          }}
          initial={{
            title: `Ответить: ${lastIn?.subject || "сообщение"}`.slice(0, 200),
            category: "reply",
            source: lastIn?.source ?? "other",
            customer_name: lastIn?.from_name ?? "",
            customer_contact: lastIn?.from_addr ?? "",
            order_number: (JSON.parse(lastIn?.order_numbers || "[]") as string[])[0] ?? "",
            messageId: (lastIn ?? last)!.id,
          }}
        />
      )}
    </>
  );
}

export default function Messages() {
  return (
    <Suspense fallback={<div className="empty">Загрузка…</div>}>
      <MessagesInner />
    </Suspense>
  );
}
