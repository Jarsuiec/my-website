"use client";

import { fmtDate } from "./client";
import { DemoBadge, SourceBadge } from "./ui";
import type { MessageRow } from "@/lib/ingest";

export function MessageCard({ m, highlight }: { m: MessageRow; highlight?: boolean }) {
  const orders = JSON.parse(m.order_numbers || "[]") as string[];
  const tracking = JSON.parse(m.tracking_numbers || "[]") as string[];
  return (
    <div className={`msg ${m.direction === "out" ? "out" : ""} ${highlight ? "highlight" : ""}`} id={`m${m.id}`}>
      <div className="msg-head">
        <b style={{ color: "var(--text)" }}>{m.direction === "out" ? "Вы" : m.from_name || m.from_addr || "Неизвестный отправитель"}</b>
        {m.from_addr && m.direction !== "out" && m.from_name && <span>&lt;{m.from_addr}&gt;</span>}
        {m.direction === "out" && m.to_addr && <span>→ {m.to_addr}</span>}
        <SourceBadge s={m.source} />
        {m.direction === "unknown" && <span className="badge" title="Укажите свои адреса в Настройках">направление не определено</span>}
        <DemoBadge on={m.is_demo} />
        <span className="spacer" />
        <span title={m.sent_at ? "" : "В файле не было даты; показано время импорта"}>{m.sent_at ? fmtDate(m.sent_at) : `дата неизвестна (импорт ${fmtDate(m.created_at)})`}</span>
        <span>M{m.id}</span>
      </div>
      {m.subject && <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.subject}</div>}
      <div className="msg-body pre">{m.body}</div>
      {(orders.length > 0 || tracking.length > 0 || m.mailbox) && (
        <div className="row small muted" style={{ marginTop: 6 }}>
          {orders.length > 0 && <span>Заказ: {orders.join(", ")}</span>}
          {tracking.length > 0 && <span>Трекинг: {tracking.join(", ")}</span>}
          {m.mailbox && <span>Ящик: {m.mailbox}</span>}
        </div>
      )}
    </div>
  );
}

