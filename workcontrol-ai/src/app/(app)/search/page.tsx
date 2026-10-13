"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { call, fmtDate } from "@/components/client";
import { TaskItem, type Task } from "@/components/TaskList";
import { SourceBadge } from "@/components/ui";

type Msg = { id: number; source: string; direction: string; from_name: string | null; from_addr: string | null; subject: string | null; at: string; snippet: string };

function SearchInner() {
  const q = useSearchParams().get("q") || "";
  const [r, setR] = useState<{ tasks: Task[]; messages: Msg[] } | null>(null);
  const load = useCallback(() => {
    call<{ tasks: Task[]; messages: Msg[] }>(`/api/search?q=${encodeURIComponent(q)}`).then(setR).catch(() => setR({ tasks: [], messages: [] }));
  }, [q]);
  useEffect(load, [load]);
  return (
    <>
      <div className="page-head">
        <h1>Поиск: «{q}»</h1>
      </div>
      {!r ? (
        <div className="empty">Ищу…</div>
      ) : (
        <div className="grid grid-2">
          <div>
            <h2>Задачи ({r.tasks.length})</h2>
            <div className="tasks">
              {r.tasks.map((t) => (
                <TaskItem key={t.id} t={t} onChanged={load} />
              ))}
              {!r.tasks.length && <div className="empty">Нет задач</div>}
            </div>
          </div>
          <div>
            <h2>Сообщения ({r.messages.length})</h2>
            <div className="stack">
              {r.messages.map((m) => (
                <Link key={m.id} href={`/messages?m=${m.id}`} className="msg" style={{ color: "var(--text)", display: "block" }}>
                  <div className="msg-head">
                    <b>{m.direction === "out" ? "Вы" : m.from_name || m.from_addr || "?"}</b>
                    <SourceBadge s={m.source} />
                    <span className="spacer" />
                    {fmtDate(m.at)}
                  </div>
                  <div style={{ fontWeight: 600 }}>{m.subject || "(без темы)"}</div>
                  <div className="small muted">{m.snippet}</div>
                </Link>
              ))}
              {!r.messages.length && <div className="empty">Нет сообщений</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="empty">Ищу…</div>}>
      <SearchInner />
    </Suspense>
  );
}
