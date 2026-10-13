"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { call, fmtDate, relTime } from "@/components/client";
import { EMPTY_FILTERS, FilterBar, NewTaskModal, TaskListView, useTasks, type Filters } from "@/components/TaskList";

type Stats = {
  urgent: number;
  needs_reply: number;
  waiting: number;
  delivery: number;
  returns: number;
  done_today: number;
  missed: number;
  yesterday: number;
  active: number;
  snoozed: number;
  messages: number;
  has_my_addresses: boolean;
};
type Source = { id: string; label: string; messages: number; last_import_at: string | null; last_message_at: string | null };

const CARDS: { key: keyof Stats; label: string; icon: string; preset: string }[] = [
  { key: "urgent", label: "Срочные задачи", icon: "🔴", preset: "urgent" },
  { key: "needs_reply", label: "Требуют ответа", icon: "🟠", preset: "needs_reply" },
  { key: "waiting", label: "Ожидают клиента", icon: "🟡", preset: "waiting" },
  { key: "delivery", label: "Проблемы с доставкой", icon: "📦", preset: "delivery" },
  { key: "returns", label: "Открытые возвраты", icon: "↩️", preset: "returns" },
  { key: "done_today", label: "Выполнено сегодня", icon: "🟢", preset: "done_today" },
  { key: "missed", label: "Возможно пропущенные", icon: "✉️", preset: "missed" },
];

const PRESET_TITLE: Record<string, string> = {
  "": "Активные задачи",
  urgent: "Срочные задачи",
  needs_reply: "Требуют ответа",
  waiting: "Ожидают действий клиента",
  delivery: "Проблемы с доставкой",
  returns: "Открытые возвраты",
  done_today: "Выполнено сегодня",
  yesterday: "Осталось со вчера и раньше",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [preset, setPreset] = useState("");
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [creating, setCreating] = useState(false);
  const [tick, setTick] = useState(0);

  const loadStats = useCallback(() => {
    call<{ stats: Stats; sources: Source[] }>("/api/stats")
      .then((r) => {
        setStats(r.stats);
        setSources(r.sources);
      })
      .catch(() => {});
  }, []);
  useEffect(loadStats, [loadStats, tick]);

  const { tasks, error, reload } = useTasks(
    { ...f, preset: preset === "missed" ? "" : preset, view: preset === "done_today" ? "done" : f.status === "done" ? "all" : "active" },
    [tick],
  );
  const changed = () => {
    reload();
    setTick((t) => t + 1);
  };

  // Время берём только в браузере, чтобы не расходиться с сервером (другой часовой пояс).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const hello = !now ? "Здравствуйте" : now.getHours() < 12 ? "Доброе утро" : now.getHours() < 18 ? "Добрый день" : "Добрый вечер";
  const withData = sources.filter((s) => s.last_import_at);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{hello}!</h1>
          <div className="muted">
            {now?.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
            {stats && ` · активных задач: ${stats.active}`}
            {stats?.snoozed ? ` · отложено: ${stats.snoozed}` : ""}
          </div>
        </div>
        <div className="row">
          <Link className="btn" href="/import">
            ⬆ Загрузить данные
          </Link>
          <button className="btn primary" onClick={() => setCreating(true)}>
            + Новая задача
          </button>
        </div>
      </div>

      {stats && stats.messages === 0 && stats.active === 0 && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <b>Данных пока нет.</b> Загрузите письма (EML/MBOX), выгрузки CSV/XLSX или вставьте переписку в разделе{" "}
          <Link href="/import">«Загрузить данные»</Link>. Чтобы посмотреть, как всё работает, можно загрузить{" "}
          <Link href="/settings#demo">демо-данные</Link> — они помечены и удаляются одной кнопкой.
        </div>
      )}
      {stats && stats.messages > 0 && !stats.has_my_addresses && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          Укажите свои рабочие адреса в <Link href="/settings">Настройках</Link> — тогда приложение будет отличать ваши ответы от писем клиентов и точнее
          определять, кто ждёт ответа.
        </div>
      )}

      <div className="stats">
        {CARDS.map((c) => (
          <button
            key={c.key}
            className={`stat ${preset === c.preset ? "active" : ""}`}
            onClick={() => (c.preset === "missed" ? (location.href = "/messages?filter=missed") : setPreset(preset === c.preset ? "" : c.preset))}
          >
            <span className="lbl">
              {c.icon} {c.label}
            </span>
            <span className="num">{stats ? (stats[c.key] as number) : "…"}</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{PRESET_TITLE[preset] ?? "Задачи"}</h2>
        {preset && (
          <button className="btn ghost sm" onClick={() => setPreset("")}>
            ✕ показать все активные
          </button>
        )}
        <span className="spacer" />
        {stats && stats.yesterday > 0 && preset !== "yesterday" && (
          <button className="btn sm" onClick={() => setPreset("yesterday")}>
            Осталось со вчера: {stats.yesterday}
          </button>
        )}
      </div>
      <FilterBar f={f} setF={setF} />
      <TaskListView
        tasks={tasks}
        error={error}
        reload={changed}
        empty={preset ? "В этой группе задач нет 🎉" : "Активных задач нет. Загрузите новые данные или добавьте задачу вручную."}
      />

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Последнее обновление источников</h3>
        {withData.length ? (
          <div className="row" style={{ gap: 16 }}>
            {withData.map((s) => (
              <span key={s.id} className="small" title={`Последнее сообщение: ${fmtDate(s.last_message_at)}`}>
                <b>{s.label}</b>: {relTime(s.last_import_at)} <span className="muted">({s.messages} сообщ.)</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="muted small">Ни один источник ещё не загружался.</div>
        )}
      </div>

      {creating && <NewTaskModal onClose={() => setCreating(false)} onDone={changed} />}
    </>
  );
}
