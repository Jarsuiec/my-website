"use client";

import { useState } from "react";
import { EMPTY_FILTERS, FilterBar, NewTaskModal, TaskListView, useTasks, type Filters } from "@/components/TaskList";

const TABS = [
  ["active", "Активные"],
  ["done", "История (выполненные)"],
  ["all", "Все"],
] as const;

export default function AllTasks() {
  const [view, setView] = useState<string>("active");
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [creating, setCreating] = useState(false);
  const { tasks, error, reload } = useTasks({ ...f, view });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Все задачи</h1>
          <div className="muted">Выполненные задачи не удаляются — они хранятся в истории.</div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + Новая задача
        </button>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        {TABS.map(([k, l]) => (
          <button key={k} className={`btn ${view === k ? "primary" : ""}`} onClick={() => setView(k)}>
            {l}
          </button>
        ))}
        <span className="spacer" />
        {tasks && <span className="muted small">Найдено: {tasks.length}</span>}
      </div>
      <FilterBar f={f} setF={setF} statuses={view !== "done"} />
      <TaskListView tasks={tasks} error={error} reload={reload} empty="Задач не найдено." />
      {creating && <NewTaskModal onClose={() => setCreating(false)} onDone={reload} />}
    </>
  );
}
