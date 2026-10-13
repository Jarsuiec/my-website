"use client";

import { useCallback, useEffect, useState } from "react";
import { call, fmtDate, toast } from "@/components/client";
import { Modal } from "@/components/ui";

type Snapshot = { name: string; size: number; created_at: string };

export default function Archive() {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [preview, setPreview] = useState<{ title: string; text: string; download: string } | null>(null);
  const [mask, setMask] = useState(true);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    call<{ snapshots: Snapshot[] }>("/api/archive/snapshots").then((r) => setSnaps(r.snapshots)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    try {
      const r = await call<{ name: string }>("/api/archive/snapshot", { method: "POST" });
      toast(`Архив сохранён: ${r.name}`);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const show = async (type: "report" | "claude") => {
    try {
      const r = await call<{ text: string }>(`/api/archive?type=${type}.preview&mask=${mask ? 1 : 0}`);
      setPreview({
        title: type === "report" ? "Отчёт" : "Данные для Claude",
        text: r.text,
        download: type === "report" ? "/api/archive?type=report.md" : `/api/archive?type=claude.md&mask=${mask ? 1 : 0}`,
      });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const restore = async () => {
    if (!restoreFile) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", restoreFile);
      fd.set("confirm", "yes");
      const r = await call<{ safetyCopy: string; counts: Record<string, number>; backup_created_at: string }>("/api/archive/restore", { form: fd });
      toast(`Восстановлено: задач ${r.counts.tasks}, сообщений ${r.counts.messages}. Прежние данные сохранены в ${r.safetyCopy}`);
      setConfirm(false);
      setRestoreFile(null);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Архив</h1>
          <div className="muted">Полная резервная копия, восстановление, экспорт и отчёты. В каждом файле указано точное время создания.</div>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card stack">
          <h2>Резервная копия</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Включает сообщения, переписки, задачи, статусы, заметки, историю действий, историю импорта и даты обновления источников. Ключи API и пароли в
            копию не попадают.
          </p>
          <div className="row">
            <button className="btn primary" onClick={save}>
              💾 Сохранить архив на сервере
            </button>
            <a className="btn" href="/api/archive?type=zip">
              ⬇ Скачать ZIP (всё)
            </a>
            <a className="btn" href="/api/archive?type=json">
              ⬇ Скачать JSON
            </a>
          </div>
          <h3 style={{ marginTop: 8 }}>Экспорт таблиц</h3>
          <div className="row">
            <a className="btn sm" href="/api/archive?type=tasks.csv">
              Задачи CSV
            </a>
            <a className="btn sm" href="/api/archive?type=messages.csv">
              Сообщения CSV
            </a>
          </div>
        </div>

        <div className="card stack">
          <h2>Отчёты</h2>
          <div className="row">
            <button className="btn" onClick={() => show("report")}>
              📄 Создать отчёт
            </button>
            <button className="btn primary" onClick={() => show("claude")}>
              ✨ Подготовить данные для Claude
            </button>
          </div>
          <label className="row small">
            <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} /> Скрыть e-mail, телефоны и фамилии в данных для Claude
          </label>
          <p className="muted small" style={{ margin: 0 }}>
            «Данные для Claude» — структурированная сводка открытых задач, возможно пропущенных писем и действий за 48 часов. Её можно вставить в чат
            Claude вручную. Передавайте рабочие данные во внешние сервисы только с разрешения работодателя.
          </p>
        </div>

        <div className="card stack">
          <h2>Восстановить из копии</h2>
          <input type="file" accept=".zip,.json" onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />
          <button className="btn danger" disabled={!restoreFile} onClick={() => setConfirm(true)}>
            Восстановить…
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            Текущие данные будут заменены данными из копии. Перед этим текущее состояние автоматически сохраняется на сервере.
          </p>
        </div>

        <div className="card">
          <h2>Сохранённые на сервере</h2>
          <p className="muted small">Автоматическая копия создаётся раз в день при открытии главной (хранятся 14 последних).</p>
          {snaps.length ? (
            <table className="tbl">
              <tbody>
                {snaps.slice(0, 30).map((s) => (
                  <tr key={s.name}>
                    <td>{fmtDate(s.created_at)}</td>
                    <td className="small">{s.name}</td>
                    <td className="small muted">{(s.size / 1024).toFixed(0)} КБ</td>
                    <td>
                      <a className="btn sm" href={`/api/archive/snapshots/${encodeURIComponent(s.name)}`}>
                        ⬇
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="muted">Пока нет сохранённых архивов.</div>
          )}
        </div>
      </div>

      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <div className="stack">
            <textarea readOnly value={preview.text} style={{ minHeight: 360, fontSize: 12.5 }} />
            <div className="row">
              <span className="spacer" />
              <button className="btn" onClick={() => navigator.clipboard.writeText(preview.text).then(() => toast("Скопировано"))}>
                Копировать
              </button>
              <a className="btn primary" href={preview.download}>
                Скачать .md
              </a>
            </div>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title="Заменить данные?" onClose={() => setConfirm(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              Все текущие задачи, сообщения и заметки будут заменены содержимым файла <b>{restoreFile?.name}</b>. Текущее состояние будет сохранено в
              архив на сервере.
            </p>
            <div className="row">
              <span className="spacer" />
              <button className="btn" onClick={() => setConfirm(false)}>
                Отмена
              </button>
              <button className="btn primary" disabled={busy} onClick={restore}>
                {busy ? "Восстанавливаю…" : "Да, восстановить"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
