"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { call, fmtDate, toast } from "@/components/client";
import { TaskActions, type Task } from "@/components/TaskList";
import { CategoryLabel, DemoBadge, PriorityBadge, SourceBadge, SourceSelect, StatusBadge } from "@/components/ui";
import { CATEGORIES, COMPLAINT_CATEGORIES, COMPLAINT_STAGES, PRIORITIES, RETURN_CATEGORIES, RETURN_STAGES } from "@/lib/constants";
import type { MessageRow } from "@/lib/ingest";
import { MessageCard } from "@/components/MessageCard";

type Detail = {
  task: Task;
  messages: MessageRow[];
  notes: { id: number; body: string; created_at: string }[];
  activity: { id: number; action: string; details: string; created_at: string }[];
};

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string> | null>(null);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<{ text: string; notice?: string; mode: string } | null>(null);
  const [lang, setLang] = useState("auto");
  const [drafting, setDrafting] = useState(false);

  const load = useCallback(() => {
    call<Detail>(`/api/tasks/${id}`)
      .then((r) => {
        setD(r);
        setErr(null);
      })
      .catch((e) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (err) return <div className="notice error">{err}</div>;
  if (!d) return <div className="empty">Загрузка…</div>;
  const t = d.task;
  const stages = RETURN_CATEGORIES.includes(t.category) ? RETURN_STAGES : COMPLAINT_CATEGORIES.includes(t.category) ? COMPLAINT_STAGES : null;

  const startEdit = () =>
    setEdit({
      title: t.title,
      category: t.category,
      source: t.source ?? "manual",
      customer_name: t.customer_name ?? "",
      customer_contact: t.customer_contact ?? "",
      order_number: t.order_number ?? "",
      summary: t.summary ?? "",
      priority: t.priority_locked ? t.priority : "auto",
      next_action: t.next_action ?? "",
      deadline: t.deadline ? t.deadline.slice(0, 16) : "",
      stage: t.stage ?? "",
    });

  const saveEdit = async () => {
    if (!edit) return;
    try {
      const patch: Record<string, string | null> = { ...edit, deadline: edit.deadline ? new Date(edit.deadline).toISOString() : null };
      if (patch.priority === "auto" && !t.priority_locked) delete patch.priority;
      await call(`/api/tasks/${id}`, { method: "PATCH", body: patch });
      toast("Изменения сохранены. Они не будут перезаписаны при повторном импорте.");
      setEdit(null);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const addNote = async () => {
    try {
      await call(`/api/tasks/${id}/notes`, { body: { body: note } });
      setNote("");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const makeDraft = async () => {
    setDrafting(true);
    try {
      setDraft(await call(`/api/tasks/${id}/draft`, { body: { lang } }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setDrafting(false);
    }
  };

  const set = (k: string) => (e: { target: { value: string } }) => setEdit({ ...edit!, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="muted small">
            <Link href="/tasks">← Все задачи</Link> · T{t.id}
          </div>
          <h1>{t.title}</h1>
          <div className="row">
            <PriorityBadge p={t.priority} />
            <StatusBadge s={t.status} />
            <SourceBadge s={t.source} />
            <span className="badge">
              <CategoryLabel c={t.category} />
            </span>
            {t.needs_reply ? <span className="badge warn">✉ Возможно, клиент ожидает ответа</span> : null}
            <DemoBadge on={t.is_demo} />
          </div>
        </div>
      </div>

      <div className="card row" style={{ marginBottom: 16 }}>
        <TaskActions t={t} onChanged={load} compact={false} />
      </div>

      <div className="grid grid-2">
        <div className="stack">
          <div className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Данные задачи</h2>
              <span className="spacer" />
              {!edit && (
                <button className="btn sm" onClick={startEdit}>
                  Изменить
                </button>
              )}
            </div>
            {!edit ? (
              <dl className="kv">
                <dt>Клиент</dt>
                <dd>{t.customer_name || "—"}</dd>
                <dt>Контакт</dt>
                <dd>{t.customer_contact || "—"}</dd>
                <dt>Номер заказа</dt>
                <dd>{t.order_number || "—"}</dd>
                <dt>Описание</dt>
                <dd className="pre">{t.summary || "—"}</dd>
                <dt>Следующее действие</dt>
                <dd>{t.next_action || "—"}</dd>
                {stages && (
                  <>
                    <dt>Этап</dt>
                    <dd>{t.stage ? (stages as Record<string, string>)[t.stage] : "—"}</dd>
                  </>
                )}
                <dt>Дедлайн</dt>
                <dd>{t.deadline ? fmtDate(t.deadline) : "не известен"}</dd>
                <dt>Приоритет</dt>
                <dd>{t.priority_locked ? "задан вручную" : "автоматически (по правилам)"}</dd>
                <dt>Последнее сообщение</dt>
                <dd>{fmtDate(t.last_message_at)}</dd>
                <dt>Ваш последний ответ</dt>
                <dd>
                  {t.last_outbound_at || t.last_reply_at
                    ? fmtDate([t.last_outbound_at, t.last_reply_at].filter(Boolean).sort().pop())
                    : "в загруженной истории не найден"}
                </dd>
                <dt>Создана</dt>
                <dd>
                  {fmtDate(t.created_at)} ({t.origin === "auto" ? "автоматически" : t.origin === "import" ? "из таблицы" : "вручную"})
                </dd>
                {t.completed_at && (
                  <>
                    <dt>Выполнена</dt>
                    <dd>{fmtDate(t.completed_at)}</dd>
                  </>
                )}
              </dl>
            ) : (
              <div className="stack">
                <label className="field">
                  Название
                  <input value={edit.title} onChange={set("title")} />
                </label>
                <div className="grid grid-2" style={{ gap: 10 }}>
                  <label className="field">
                    Категория
                    <select value={edit.category} onChange={set("category")}>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Источник
                    <SourceSelect value={edit.source} onChange={(v) => setEdit({ ...edit, source: v })} withAll={false} />
                  </label>
                  <label className="field">
                    Клиент
                    <input value={edit.customer_name} onChange={set("customer_name")} />
                  </label>
                  <label className="field">
                    Контакт
                    <input value={edit.customer_contact} onChange={set("customer_contact")} />
                  </label>
                  <label className="field">
                    Номер заказа
                    <input value={edit.order_number} onChange={set("order_number")} />
                  </label>
                  <label className="field">
                    Приоритет
                    <select value={edit.priority} onChange={set("priority")}>
                      <option value="auto">Автоматически</option>
                      {Object.entries(PRIORITIES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Дедлайн
                    <input type="datetime-local" value={edit.deadline} onChange={set("deadline")} />
                  </label>
                  {stages && (
                    <label className="field">
                      Этап
                      <select value={edit.stage} onChange={set("stage")}>
                        <option value="">—</option>
                        {Object.entries(stages).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <label className="field">
                  Описание
                  <textarea value={edit.summary} onChange={set("summary")} />
                </label>
                <label className="field">
                  Следующее действие
                  <input value={edit.next_action} onChange={set("next_action")} />
                </label>
                <div className="row">
                  <span className="spacer" />
                  <button className="btn" onClick={() => setEdit(null)}>
                    Отмена
                  </button>
                  <button className="btn primary" onClick={saveEdit}>
                    Сохранить
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Заметки</h2>
            <div className="stack">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Добавить заметку…" style={{ minHeight: 60 }} />
              <div className="row">
                <span className="spacer" />
                <button className="btn primary sm" disabled={!note.trim()} onClick={addNote}>
                  Добавить заметку
                </button>
              </div>
              {d.notes.map((n) => (
                <div key={n.id} className="notice">
                  <div className="small muted">{fmtDate(n.created_at)}</div>
                  <div className="pre">{n.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Черновик ответа</h2>
            <div className="row">
              <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Язык">
                <option value="auto">Язык клиента (авто)</option>
                <option value="pl">Польский</option>
                <option value="en">Английский</option>
                <option value="de">Немецкий</option>
                <option value="ru">Русский</option>
              </select>
              <button className="btn" onClick={makeDraft} disabled={drafting}>
                {drafting ? "Готовлю…" : "Подготовить черновик"}
              </button>
            </div>
            {draft && (
              <div className="stack" style={{ marginTop: 10 }}>
                {draft.notice && <div className="small muted">{draft.notice}</div>}
                <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} style={{ minHeight: 180 }} />
                <div className="row">
                  <span className="small muted">Приложение не отправляет письма. Скопируйте текст в Gmail / Allegro / Etsy.</span>
                  <span className="spacer" />
                  <button
                    className="btn sm"
                    onClick={() => navigator.clipboard.writeText(draft.text).then(() => toast("Скопировано"), () => toast("Не удалось скопировать", "error"))}
                  >
                    Копировать
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Переписка ({d.messages.length})</h2>
            {d.messages.length ? (
              <div className="stack">
                {d.messages.map((m) => (
                  <MessageCard key={m.id} m={m} />
                ))}
              </div>
            ) : (
              <div className="muted">Задача создана вручную, связанных сообщений нет.</div>
            )}
            {d.messages.length > 0 && !d.messages.some((m) => m.direction === "out") && (
              <div className="notice warn small" style={{ marginTop: 10 }}>
                В загруженной истории нет ваших ответов. Если вы отвечали, история может быть неполной — импортируйте отправленные письма или
                нажмите «Ответил».
              </div>
            )}
          </div>
          <div className="card">
            <h2>История действий</h2>
            <ul className="timeline">
              {d.activity.map((a) => (
                <li key={a.id}>
                  <span className="t">{fmtDate(a.created_at)}</span>
                  <span>{a.details || a.action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
