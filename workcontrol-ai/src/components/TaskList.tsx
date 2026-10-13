"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { call, fmtDate, relTime, toast } from "./client";
import { CategoryLabel, DemoBadge, Modal, PriorityBadge, SourceBadge, SourceSelect, StatusBadge, stageLabel } from "./ui";
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/constants";
import type { Task } from "@/lib/tasks";

export type { Task };

function tomorrowAt8(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SnoozeModal({ taskId, onClose, onDone }: { taskId: number; onClose: () => void; onDone: () => void }) {
  const [custom, setCustom] = useState(toLocalInput(tomorrowAt8()));
  const go = async (until: string) => {
    try {
      await call(`/api/tasks/${taskId}/action`, { body: { action: "snooze", until } });
      toast(`Отложено до ${fmtDate(until)}`);
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const presets: [string, () => string][] = [
    ["На 3 часа", () => new Date(Date.now() + 3 * 36e5).toISOString()],
    ["До завтра 8:00", tomorrowAt8],
    ["На 3 дня", () => new Date(Date.now() + 3 * 864e5).toISOString()],
    ["На неделю", () => new Date(Date.now() + 7 * 864e5).toISOString()],
  ];
  return (
    <Modal title="Отложить задачу" onClose={onClose}>
      <div className="stack">
        <div className="row">
          {presets.map(([l, f]) => (
            <button key={l} className="btn" onClick={() => go(f())}>
              {l}
            </button>
          ))}
        </div>
        <div className="row">
          <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn primary" onClick={() => go(new Date(custom).toISOString())}>
            Отложить
          </button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          В указанное время задача сама вернётся в список активных.
        </p>
      </div>
    </Modal>
  );
}

export function NoteModal({ taskId, onClose, onDone }: { taskId: number; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await call(`/api/tasks/${taskId}/notes`, { body: { body: text } });
      toast("Заметка сохранена");
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Заметка к задаче" onClose={onClose}>
      <div className="stack">
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: позвонил в DPD, обещали ответ до 14:00" />
        <div className="row">
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" disabled={!text.trim() || busy} onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TaskActions({ t, onChanged, compact = true }: { t: Task; onChanged: () => void; compact?: boolean }) {
  const [modal, setModal] = useState<"snooze" | "note" | null>(null);
  const act = async (action: string, label: string) => {
    try {
      await call(`/api/tasks/${t.id}/action`, { body: { action } });
      toast(label);
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const sm = compact ? "sm" : "";
  return (
    <>
      {t.status !== "done" ? (
        <>
          <button className={`btn ${sm} ok`} onClick={() => act("done", "Выполнено ✓ — задача перенесена в историю")}>
            ✓ Выполнено
          </button>
          <button className={`btn ${sm}`} onClick={() => act("replied", "Отмечено: ответил клиенту")}>
            ↩ Ответил
          </button>
          {t.status !== "waiting" && (
            <button className={`btn ${sm}`} onClick={() => act("waiting", "Отмечено: ожидаю")}>
              ⏳ Ожидаю
            </button>
          )}
          {(t.status === "waiting" || t.status === "snoozed") && (
            <button className={`btn ${sm}`} onClick={() => act("reopen", "Задача снова в работе")}>
              ▶ В работу
            </button>
          )}
          <button className={`btn ${sm}`} onClick={() => setModal("snooze")}>
            🕓 Отложить
          </button>
        </>
      ) : (
        <button className={`btn ${sm}`} onClick={() => act("reopen", "Задача возвращена в работу")}>
          ▶ Вернуть в работу
        </button>
      )}
      {compact && (
        <Link className={`btn ${sm}`} href={`/tasks/${t.id}`}>
          Открыть
        </Link>
      )}
      <button className={`btn ${sm}`} onClick={() => setModal("note")}>
        ✎ Заметка{t.notes_count ? ` (${t.notes_count})` : ""}
      </button>
      {modal === "snooze" && <SnoozeModal taskId={t.id} onClose={() => setModal(null)} onDone={onChanged} />}
      {modal === "note" && <NoteModal taskId={t.id} onClose={() => setModal(null)} onDone={onChanged} />}
    </>
  );
}

function StageSelect({ t, stages, onChanged }: { t: Task; stages: Record<string, string>; onChanged: () => void }) {
  const change = async (stage: string) => {
    try {
      await call(`/api/tasks/${t.id}`, { method: "PATCH", body: { stage } });
      toast(`Этап: ${stages[stage]}`);
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <select className="small" style={{ minHeight: 26, padding: "0 6px" }} value={t.stage ?? ""} onChange={(e) => change(e.target.value)} aria-label="Этап">
      <option value="">Этап не указан</option>
      {Object.entries(stages).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

export function TaskItem({ t, onChanged, stages }: { t: Task; onChanged: () => void; stages?: Record<string, string> }) {
  const stage = stageLabel(t.stage);
  return (
    <div className={`task p-${t.priority} ${t.status === "done" ? "done" : ""}`}>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <Link href={`/tasks/${t.id}`} className="task-title">
            {t.title}
          </Link>
          <span className="muted small">T{t.id}</span>
          <DemoBadge on={t.is_demo} />
        </div>
        <div className="task-meta">
          <SourceBadge s={t.source} />
          <span>
            <CategoryLabel c={t.category} />
          </span>
          {t.customer_name && (
            <span>
              Клиент: <b>{t.customer_name}</b>
            </span>
          )}
          {!t.customer_name && t.customer_contact && <span>{t.customer_contact}</span>}
          {t.order_number && (
            <span>
              Заказ: <b>{t.order_number}</b>
            </span>
          )}
          <span title={fmtDate(t.last_message_at)}>Посл. сообщение: {t.last_message_at ? relTime(t.last_message_at) : "—"}</span>
          {stage && <span>Этап: {stage}</span>}
        </div>
        {t.summary && <div className="task-summary">{t.summary}</div>}
        {t.next_action && t.status !== "done" && (
          <div className="task-next">
            <span className="muted">Следующее действие:</span> {t.next_action}
          </div>
        )}
      </div>
      <div className="task-side">
        <PriorityBadge p={t.priority} />
        <StatusBadge s={t.status} />
        {t.needs_reply ? (
          <span className="badge warn" title={t.history_incomplete ? "Ваших ответов в загруженной истории нет — она может быть неполной" : ""}>
            ✉ Возможно, клиент ожидает ответа
          </span>
        ) : null}
        {t.deadline && (
          <span className={`badge ${new Date(t.deadline) < new Date() && t.status !== "done" ? "critical" : ""}`}>Дедлайн: {fmtDate(t.deadline, false)}</span>
        )}
        {t.status === "snoozed" && t.snoozed_until && <span className="small muted">до {fmtDate(t.snoozed_until)}</span>}
        {t.status === "done" && <span className="small muted">выполнено {fmtDate(t.completed_at)}</span>}
      </div>
      <div className="task-actions">
        {stages && <StageSelect t={t} stages={stages} onChanged={onChanged} />}
        <TaskActions t={t} onChanged={onChanged} />
      </div>
    </div>
  );
}

export type Filters = { q: string; source: string; status: string; priority: string; category: string; from: string; to: string };
export const EMPTY_FILTERS: Filters = { q: "", source: "", status: "", priority: "", category: "", from: "", to: "" };

export function FilterBar({ f, setF, statuses = true, categories = true }: { f: Filters; setF: (f: Filters) => void; statuses?: boolean; categories?: boolean }) {
  const set = (k: keyof Filters) => (v: string) => setF({ ...f, [k]: v });
  const any = Object.values(f).some(Boolean);
  return (
    <div className="filters">
      <input type="search" placeholder="Поиск: клиент, заказ, текст…" value={f.q} onChange={(e) => set("q")(e.target.value)} />
      <SourceSelect value={f.source} onChange={set("source")} />
      {statuses && (
        <select value={f.status} onChange={(e) => set("status")(e.target.value)} aria-label="Статус">
          <option value="">Все статусы</option>
          {Object.entries(STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      )}
      <select value={f.priority} onChange={(e) => set("priority")(e.target.value)} aria-label="Срочность">
        <option value="">Любая срочность</option>
        {Object.entries(PRIORITIES).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {categories && (
        <select value={f.category} onChange={(e) => set("category")(e.target.value)} aria-label="Категория">
          <option value="">Все категории</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      )}
      <input type="date" value={f.from} onChange={(e) => set("from")(e.target.value)} title="С даты" aria-label="С даты" />
      <input type="date" value={f.to} onChange={(e) => set("to")(e.target.value)} title="По дату" aria-label="По дату" />
      {any && (
        <button className="btn ghost sm" onClick={() => setF(EMPTY_FILTERS)}>
          Сбросить
        </button>
      )}
    </div>
  );
}

export function useTasks(params: Record<string, string | undefined>, deps: unknown[] = []) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  const load = useCallback(async () => {
    try {
      const r = await call<{ tasks: Task[] }>(`/api/tasks?${qs}`);
      setTasks(r.tasks);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, ...deps]);
  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);
  return { tasks, error, reload: load };
}

export function TaskListView({ tasks, error, reload, empty, stages }: { tasks: Task[] | null; error: string | null; reload: () => void; empty: string; stages?: Record<string, string> }) {
  if (error) return <div className="notice error">Не удалось загрузить задачи: {error}</div>;
  if (!tasks) return <div className="empty">Загрузка…</div>;
  if (!tasks.length) return <div className="empty">{empty}</div>;
  return (
    <div className="tasks">
      {tasks.map((t) => (
        <TaskItem key={t.id} t={t} onChanged={reload} stages={stages} />
      ))}
    </div>
  );
}

export function NewTaskModal({ onClose, onDone, initial }: { onClose: () => void; onDone: (id: number) => void; initial?: Record<string, string | number> }) {
  const [d, setD] = useState<Record<string, string>>({ category: "other", source: "manual", priority: "auto", ...(initial as Record<string, string>) });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const r = await call<{ id: number }>("/api/tasks", { body: { ...d, deadline: d.deadline ? new Date(d.deadline).toISOString() : null } });
      toast("Задача создана");
      onDone(r.id);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Новая задача" onClose={onClose}>
      <div className="stack">
        <label className="field">
          Что нужно сделать *
          <input autoFocus value={d.title ?? ""} onChange={set("title")} placeholder="Например: отправить фактуру для заказа 1234" />
        </label>
        <div className="grid grid-2" style={{ gap: 10 }}>
          <label className="field">
            Категория
            <select value={d.category} onChange={set("category")}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Источник
            <SourceSelect value={d.source} onChange={(v) => setD({ ...d, source: v })} withAll={false} />
          </label>
          <label className="field">
            Клиент
            <input value={d.customer_name ?? ""} onChange={set("customer_name")} />
          </label>
          <label className="field">
            Номер заказа
            <input value={d.order_number ?? ""} onChange={set("order_number")} />
          </label>
          <label className="field">
            Приоритет
            <select value={d.priority} onChange={set("priority")}>
              <option value="auto">Автоматически</option>
              {Object.entries(PRIORITIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Дедлайн (если известен)
            <input type="datetime-local" value={d.deadline ?? ""} onChange={set("deadline")} />
          </label>
        </div>
        <label className="field">
          Описание
          <textarea value={d.summary ?? ""} onChange={set("summary")} style={{ minHeight: 70 }} />
        </label>
        <div className="row">
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" disabled={!d.title?.trim() || busy} onClick={save}>
            Создать
          </button>
        </div>
      </div>
    </Modal>
  );
}
