"use client";

import { useState } from "react";
import { EMPTY_FILTERS, FilterBar, NewTaskModal, TaskListView, useTasks, type Filters } from "./TaskList";

export default function CategoryPage({ title, hint, categories, stages, newCategory, doneStages }: {
  title: string;
  hint: string;
  categories: string[];
  stages: Record<string, string>;
  newCategory: string;
  doneStages: string[];
}) {
  const [view, setView] = useState("active");
  const [stage, setStage] = useState("");
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [creating, setCreating] = useState(false);
  const { tasks, error, reload } = useTasks({ ...f, view, categories: categories.join(",") });
  const counts: Record<string, number> = {};
  for (const t of tasks ?? []) counts[t.stage ?? ""] = (counts[t.stage ?? ""] ?? 0) + 1;
  const shown = (tasks ?? []).filter((t) => (stage === "__open" ? !doneStages.includes(t.stage ?? "") : !stage || t.stage === stage));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="muted">{hint}</div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + Добавить вручную
        </button>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={`btn ${view === "active" ? "primary" : ""}`} onClick={() => setView("active")}>
          Открытые
        </button>
        <button className={`btn ${view === "done" ? "primary" : ""}`} onClick={() => setView("done")}>
          Закрытые
        </button>
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className="chip" style={!stage ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}} onClick={() => setStage("")}>
          Все этапы ({tasks?.length ?? 0})
        </button>
        <button className="chip" style={stage === "__open" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}} onClick={() => setStage("__open")}>
          Не завершены ({(tasks ?? []).filter((t) => !doneStages.includes(t.stage ?? "")).length})
        </button>
        {Object.entries(stages).map(([k, v]) => (
          <button key={k} className="chip" style={stage === k ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}} onClick={() => setStage(k)}>
            {v} ({counts[k] ?? 0})
          </button>
        ))}
      </div>
      <FilterBar f={f} setF={setF} statuses={false} categories={false} />
      <TaskListView tasks={tasks ? shown : null} error={error} reload={reload} empty="Здесь пока пусто." stages={stages} />
      {creating && <NewTaskModal onClose={() => setCreating(false)} onDone={reload} initial={{ category: newCategory }} />}
    </>
  );
}
