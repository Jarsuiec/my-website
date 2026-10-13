"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { call } from "./client";
import { Toasts } from "./ui";

const NAV = [
  ["/", "🏠", "Главная"],
  ["/tasks", "✅", "Все задачи"],
  ["/messages", "✉️", "Сообщения"],
  ["/returns", "↩️", "Возвраты"],
  ["/complaints", "⚠️", "Рекламации"],
  ["/ai", "✨", "Спросить AI"],
  ["/import", "⬆️", "Загрузить данные"],
  ["/archive", "🗄️", "Архив"],
  ["/integrations", "🔌", "Интеграции"],
  ["/settings", "⚙️", "Настройки"],
] as const;

function applyTheme(t: string) {
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
}

export default function Shell({ children, authEnabled }: { children: ReactNode; authEnabled: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("system");
  const [urgent, setUrgent] = useState<number | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      setTheme(localStorage.getItem("wc-theme") || "system");
    } catch {}
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    call<{ stats: { urgent: number } }>("/api/stats")
      .then((r) => setUrgent(r.stats.urgent))
      .catch(() => {});
  }, [path]);

  const cycleTheme = () => {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem("wc-theme", next);
    } catch {}
  };

  const logout = async () => {
    await call("/api/auth/logout", { method: "POST" }).catch(() => {});
    location.href = "/login";
  };

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">WC</div>
          <div>
            WorkControl AI
            <div className="muted small" style={{ fontWeight: 400 }}>
              рабочий центр
            </div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(([href, icon, label]) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "active" : ""}>
                <span aria-hidden>{icon}</span>
                {label}
                {href === "/" && urgent ? <span className="count" title="Срочные задачи">{urgent}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <button className="btn sm" onClick={cycleTheme}>
            Тема: {theme === "system" ? "как в системе" : theme === "light" ? "светлая" : "тёмная"}
          </button>
          {authEnabled ? (
            <button className="btn sm" onClick={logout}>
              Выйти
            </button>
          ) : (
            <span className="small muted">Вход без пароля (только этот компьютер)</span>
          )}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Меню">
            ☰
          </button>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <input className="search-input" type="search" placeholder="Поиск по клиенту, номеру заказа, трекингу, тексту…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </header>
        <main className="content">{children}</main>
      </div>
      {open && <div className="modal-bg" style={{ zIndex: 15, background: "rgba(0,0,0,.3)" }} onClick={() => setOpen(false)} />}
      <Toasts />
    </div>
  );
}
