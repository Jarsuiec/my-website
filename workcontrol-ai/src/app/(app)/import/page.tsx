"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { call, fmtDate, relTime, toast } from "@/components/client";
import { NewTaskModal } from "@/components/TaskList";
import { SourceSelect } from "@/components/ui";

type Result = { filename: string; format: string; added: number; duplicates: number; tasksCreated: number; tasksUpdated: number; tasksReopened: number; errors: string[] };
type ImportRow = { id: number; created_at: string; filename: string; format: string; source: string; added: number; duplicates: number; tasks_created: number; tasks_updated: number; errors: string; is_demo: number };
type Source = { id: string; label: string; messages: number; last_import_at: string | null; last_message_at: string | null };

const ACCEPT = ".eml,.mbox,.csv,.xlsx,.json,.txt,.pdf,.zip";

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [source, setSource] = useState("auto");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [history, setHistory] = useState<ImportRow[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [creating, setCreating] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(() => {
    call<{ imports: ImportRow[]; sources: Source[] }>("/api/imports")
      .then((r) => {
        setHistory(r.imports);
        setSources(r.sources);
      })
      .catch(() => {});
  }, []);
  useEffect(loadHistory, [loadHistory]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const bad = arr.filter((f) => !ACCEPT.split(",").some((e) => f.name.toLowerCase().endsWith(e)));
    if (bad.length) toast(`Не поддерживается: ${bad.map((f) => f.name).join(", ")}`, "error");
    setFiles((cur) => [...cur, ...arr.filter((f) => !bad.includes(f))]);
  };

  const submit = async () => {
    setBusy(true);
    setResults(null);
    try {
      // Отправляем порциями, чтобы большие пачки писем не упирались в один огромный запрос.
      const all: Result[] = [];
      if (text.trim()) {
        const fd = new FormData();
        fd.set("source", source);
        fd.set("text", text);
        all.push(...(await call<{ results: Result[] }>("/api/import", { form: fd })).results);
      }
      const batch = 25;
      for (let i = 0; i < files.length; i += batch) {
        const fd = new FormData();
        fd.set("source", source);
        for (const f of files.slice(i, i + batch)) fd.append("files", f);
        all.push(...(await call<{ results: Result[] }>("/api/import", { form: fd })).results);
      }
      setResults(all);
      const added = all.reduce((s, r) => s + r.added, 0);
      const created = all.reduce((s, r) => s + r.tasksCreated, 0);
      toast(`Импорт завершён: новых сообщений ${added}, новых задач ${created}`);
      setFiles([]);
      setText("");
      loadHistory();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const total = (k: keyof Result) => (results ?? []).reduce((s, r) => s + (r[k] as number), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Загрузить данные</h1>
          <div className="muted">Повторная загрузка тех же писем безопасна: дубликаты распознаются, ваши статусы и заметки сохраняются.</div>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>
          + Задача вручную
        </button>
      </div>

      <div className="grid grid-2">
        <div className="stack">
          <div
            className={`drop ${over ? "over" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <div style={{ fontSize: 28 }}>⬆️</div>
            <div style={{ fontWeight: 600 }}>Перетащите файлы сюда или нажмите, чтобы выбрать</div>
            <div className="muted small">EML · MBOX · CSV · XLSX · JSON · TXT (в т.ч. экспорт WhatsApp) · PDF с текстом · ZIP-архив с письмами</div>
            <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => addFiles(e.target.files)} />
          </div>
          {files.length > 0 && (
            <div className="row">
              {files.map((f, i) => (
                <span key={i} className="file-chip">
                  {f.name} <span className="muted">{(f.size / 1024).toFixed(0)} КБ</span>
                  <button className="btn ghost sm" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Убрать">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <label className="field">
            Или вставьте текст переписки (письмо, чат WhatsApp, сообщение Allegro…)
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ minHeight: 160 }}
              placeholder={"Od: Anna Kowalska <anna@example.pl>\nTemat: Zwrot zamówienia 12345\nData: 12.10.2026 10:15\n\nDzień dobry, proszę o etykietę zwrotną…"}
            />
          </label>
          <div className="row">
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              Источник:
              <SourceSelect value={source} onChange={setSource} withAll={false} includeAuto />
            </label>
            <span className="spacer" />
            <button className="btn primary" disabled={busy || (!files.length && !text.trim())} onClick={submit}>
              {busy ? "Импорт…" : "Импортировать"}
            </button>
          </div>
          <div className="muted small">
            Подсказка: Gmail → «Показать оригинал» → «Скачать оригинал» даёт .eml; Google Takeout даёт .mbox со всеми письмами (включая отправленные —
            тогда приложение видит ваши ответы). WhatsApp → чат → «Экспорт чата» → «Без медиафайлов».
          </div>
        </div>

        <div className="stack">
          {results && (
            <div className="card">
              <h2>Результат импорта</h2>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="badge ok">новых сообщений: {total("added")}</span>
                <span className="badge">дубликатов пропущено: {total("duplicates")}</span>
                <span className="badge normal">задач создано: {total("tasksCreated")}</span>
                <span className="badge">задач обновлено: {total("tasksUpdated")}</span>
                {total("tasksReopened") > 0 && <span className="badge warn">открыто снова: {total("tasksReopened")}</span>}
              </div>
              <div className="stack" style={{ gap: 6 }}>
                {results.map((r, i) => (
                  <div key={i} className="small">
                    <b>{r.filename}</b> — +{r.added}, дубл. {r.duplicates}, задач +{r.tasksCreated}
                    {r.errors.length > 0 && (
                      <details>
                        <summary style={{ color: "var(--critical)" }}>Предупреждения: {r.errors.length}</summary>
                        <ul>
                          {r.errors.slice(0, 50).map((e, j) => (
                            <li key={j}>{e}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card">
            <h2>Источники: последнее обновление</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Источник</th>
                    <th>Последний импорт</th>
                    <th>Сообщений</th>
                  </tr>
                </thead>
                <tbody>
                  {sources
                    .filter((s) => !["manual", "other", "website", "reseller"].includes(s.id) || s.messages)
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{s.label}</td>
                        <td>{s.last_import_at ? `${fmtDate(s.last_import_at)} (${relTime(s.last_import_at)})` : <span className="muted">не загружался</span>}</td>
                        <td>{s.messages}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>История импорта</h2>
        {history.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Файл</th>
                  <th>Формат</th>
                  <th>Новых</th>
                  <th>Дубликатов</th>
                  <th>Задач +</th>
                  <th>Обновлено</th>
                  <th>Ошибок</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{fmtDate(h.created_at)}</td>
                    <td>
                      {h.filename} {h.is_demo ? <span className="badge demo">ДЕМО</span> : null}
                    </td>
                    <td>{h.format}</td>
                    <td>{h.added}</td>
                    <td>{h.duplicates}</td>
                    <td>{h.tasks_created}</td>
                    <td>{h.tasks_updated}</td>
                    <td>{(JSON.parse(h.errors) as string[]).length || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">Импортов ещё не было.</div>
        )}
      </div>
      {creating && <NewTaskModal onClose={() => setCreating(false)} onDone={() => toast("Задача добавлена на главную")} />}
    </>
  );
}
