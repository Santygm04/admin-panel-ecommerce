// src/components/StatsAdminControls.jsx
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function StatsAdminControls({ onAfterAction, className = "" }) {
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const adminSecret = sessionStorage.getItem("ADMIN_SECRET") || "";

  async function call(method, path, body) {
    if (!adminSecret) {
      setMsg("Falta ADMIN_SECRET en sessionStorage (loggate en Órdenes)");
      return null;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Error de servidor");
      setMsg("✅ Listo");
      onAfterAction?.(data);
      return data;
    } catch (e) {
      setMsg("❌ " + (e.message || "Error"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const handleClear = () => call("DELETE", "/api/payments/stats/snapshot/clear");
  const handleRun = () => call("POST", "/api/payments/stats/snapshot/run", { days: Number(days) || 30 });
  const handleReset = () => call("POST", "/api/payments/stats/snapshot/reset", { days: Number(days) || 30 });

  const todayYMD = new Date().toISOString().slice(0, 10);
  const handleRecalcToday = () => call("POST", `/api/payments/stats/snapshot/day/${todayYMD}`);

  return (
    <div className={`stats-admin ${className}`}>
      <div className="row">
        <label className="lbl">Días</label>
        <input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="in"
        />
        <button className="btn btn--ghost" disabled={busy} onClick={handleRun}>Reconstruir</button>
        <button className="btn btn--danger-ghost" disabled={busy} onClick={handleClear}>Limpiar</button>
        <button className="btn btn--primary" disabled={busy} onClick={handleReset}>Reset (clear+run)</button>
        <button className="btn btn--ghost" disabled={busy} onClick={handleRecalcToday}>Recalcular hoy</button>
      </div>
      {msg && <p className="mini-msg">{msg}</p>}

      {/* Estilos mínimos locales (no pisa tu theme) */}
      <style>{`
        .stats-admin { display:flex; flex-direction:column; gap:6px; }
        .stats-admin .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .stats-admin .lbl { color:#6b6b6b; font-size:.9rem; }
        .stats-admin .in {
          width:80px; height:36px; border:1.5px solid #f4c5df; border-radius:10px; padding:0 .6rem;
          outline:none; background:#fff;
        }
        .stats-admin .mini-msg { margin:4px 0 0; color:#6b6b6b; font-size:.9rem; }
        .btn{
          border:none; border-radius:999px; padding:.45rem .85rem; font-weight:900; cursor:pointer;
        }
        .btn--primary{
          background: linear-gradient(95deg,#10b981 0%,#22c55e 100%); color:#fff;
        }
        .btn--ghost{
          background:#fff; color:#b51775; border:2px solid #ffd0ea;
        }
        .btn--danger-ghost{
          background:#fff; color:#ef4444; border:2px solid #fecaca;
        }
      `}</style>
    </div>
  );
}
