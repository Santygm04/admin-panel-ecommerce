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
  const handleRun = () =>
    call("POST", "/api/payments/stats/snapshot/run", { days: Number(days) || 30 });
  const handleReset = () =>
    call("POST", "/api/payments/stats/snapshot/reset", { days: Number(days) || 30 });

  const todayYMD = new Date().toISOString().slice(0, 10);
  const handleRecalcToday = () =>
    call("POST", `/api/payments/stats/snapshot/day/${todayYMD}`);

  return (
    <div className={`stats-admin ${className}`}>
      <div className="sa-row">
        <div className="sa-days-group">
          <label className="sa-lbl">Días</label>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="sa-in"
          />
        </div>

        <div className="sa-btns">
          <button className="sa-btn sa-btn--ghost" disabled={busy} onClick={handleRun} type="button">
            Reconstruir
          </button>
          <button className="sa-btn sa-btn--danger" disabled={busy} onClick={handleClear} type="button">
            Limpiar
          </button>
          <button className="sa-btn sa-btn--primary" disabled={busy} onClick={handleReset} type="button">
            Reset
          </button>
          <button className="sa-btn sa-btn--ghost" disabled={busy} onClick={handleRecalcToday} type="button">
            Recalcular hoy
          </button>
        </div>
      </div>

      {msg && <p className="sa-msg">{msg}</p>}

      <style>{`
        .stats-admin {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          min-width: 0;
        }

        .sa-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
          width: 100%;
        }

        .sa-days-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sa-btns {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          width: 100%;
        }

        .sa-lbl {
          color: #6b6b6b;
          font-size: .9rem;
          white-space: nowrap;
          font-weight: 700;
        }

        .sa-in {
          width: 84px;
          height: 40px;
          border: 1.5px solid #f4c5df;
          border-radius: 12px;
          padding: 0 .7rem;
          outline: none;
          background: #fff;
          font-size: .92rem;
        }

        .sa-msg {
          margin: 2px 0 0;
          color: #6b6b6b;
          font-size: .88rem;
          overflow-wrap: anywhere;
        }

        .sa-btn {
          border: none;
          border-radius: 999px;
          padding: .65rem .85rem;
          font-weight: 900;
          font-size: .85rem;
          cursor: pointer;
          white-space: normal;
          transition: .15s;
          min-height: 42px;
          width: 100%;
        }

        .sa-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .sa-btn--primary {
          background: linear-gradient(95deg,#10b981 0%,#22c55e 100%);
          color: #fff;
        }

        .sa-btn--ghost {
          background: #fff;
          color: #b51775;
          border: 2px solid #ffd0ea;
        }

        .sa-btn--danger {
          background: #fff;
          color: #ef4444;
          border: 2px solid #fecaca;
        }

        @media (min-width: 680px) {
          .sa-row {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }

          .sa-btns {
            display: flex;
            flex-wrap: wrap;
            width: auto;
          }

          .sa-btn {
            width: auto;
            white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
}