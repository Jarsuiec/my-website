"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CATEGORIES, PRIORITIES, SOURCES, STATUSES, RETURN_STAGES, COMPLAINT_STAGES } from "@/lib/constants";
import { linkify } from "./client";

export function Toasts() {
  const [items, setItems] = useState<{ id: number; message: string; kind: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { message: string; kind: string };
      const id = ++n;
      setItems((l) => [...l, { id, ...d }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), d.kind === "error" ? 6000 : 3000);
    };
    window.addEventListener("wc-toast", h);
    return () => window.removeEventListener("wc-toast", h);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind === "error" ? "error" : ""}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const PRIORITY_ICON: Record<string, string> = { critical: "🔴", high: "🟠", normal: "🔵", low: "⚪" };

export function PriorityBadge({ p }: { p: string }) {
  return <span className={`badge ${p}`}>{PRIORITY_ICON[p]} {PRIORITIES[p as keyof typeof PRIORITIES] ?? p}</span>;
}

export function StatusBadge({ s }: { s: string }) {
  const cls = s === "done" ? "ok" : s === "waiting" ? "warn" : s === "snoozed" ? "low" : "normal";
  return <span className={`badge ${cls}`}>{STATUSES[s as keyof typeof STATUSES] ?? s}</span>;
}

export function SourceBadge({ s }: { s: string | null }) {
  if (!s) return null;
  return <span className="badge">{SOURCES[s as keyof typeof SOURCES] ?? s}</span>;
}

export function CategoryLabel({ c }: { c: string }) {
  return <>{CATEGORIES[c as keyof typeof CATEGORIES] ?? c}</>;
}

export function stageLabel(stage: string | null): string | null {
  if (!stage) return null;
  return (RETURN_STAGES as Record<string, string>)[stage] ?? (COMPLAINT_STAGES as Record<string, string>)[stage] ?? stage;
}

export function DemoBadge({ on }: { on: number | boolean }) {
  return on ? <span className="badge demo" title="Тестовые данные — не настоящие">ДЕМО</span> : null;
}

/** Текст с кликабельными ссылками [T..] и [M..] */
export function RefText({ text }: { text: string }) {
  return (
    <div className="pre">
      {linkify(text).map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <Link key={i} href={p.kind === "T" ? `/tasks/${p.id}` : `/messages?m=${p.id}`}>
            {p.raw}
          </Link>
        ),
      )}
    </div>
  );
}

export function SourceSelect({ value, onChange, withAll = true, allLabel = "Все источники", includeAuto = false }: {
  value: string;
  onChange: (v: string) => void;
  withAll?: boolean;
  allLabel?: string;
  includeAuto?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Источник">
      {withAll && <option value="">{allLabel}</option>}
      {includeAuto && <option value="auto">Определить автоматически</option>}
      {Object.entries(SOURCES).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}
