"use client";

import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) location.href = "/";
    else {
      setErr(((await r.json().catch(() => ({}))) as { error?: string }).error || "Ошибка входа");
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <form className="card stack" style={{ width: 360 }} onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">WC</div>
          WorkControl AI
        </div>
        <label className="field">
          Пароль
          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <div className="notice error">{err}</div>}
        <button className="btn primary" disabled={busy || !pw}>
          Войти
        </button>
      </form>
    </div>
  );
}
