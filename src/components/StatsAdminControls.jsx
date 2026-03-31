// src/components/StatsAdminControls.jsx
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function StatsAdminControls({ onAfterAction, className = "" }) {
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState("");

  const adminSecret = sessionStorage.getItem("ADMIN_SECRET") || "";

  async function call(method, path, body) {
    if (!adminSecret) {
      setMsg("Falta ADMIN_SECRET (loggate en Órdenes)");
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

  const todayYMD = new Date().toISOString().slice(0, 10);

  const BTNS = [
    {
      label: "Reconstruir",
      variant: "ghost",
      onClick: () => call("POST",   "/api/payments/stats/snapshot/run",          { days: Number(days) || 30 }),
    },
    {
      label: "Limpiar",
      variant: "danger",
      onClick: () => call("DELETE", "/api/payments/stats/snapshot/clear"),
    },
    {
      label: "Reset",
      variant: "primary",
      onClick: () => call("POST",   "/api/payments/stats/snapshot/reset",         { days: Number(days) || 30 }),
    },
    {
      label: "Hoy",
      variant: "ghost",
      onClick: () => call("POST",   `/api/payments/stats/snapshot/day/${todayYMD}`),
    },
  ];

  const variantCls = {
    primary: "bg-gradient-to-r from-[#10b981] to-[#22c55e] text-white",
    ghost:   "bg-white text-[#b51775] border-2 border-[#ffd0ea]",
    danger:  "bg-white text-[#ef4444] border-2 border-[#fecaca]",
  };

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>

      {/* Fila 1: input días */}
      <div className="flex items-center gap-2">
        <label htmlFor="sa-days" className="text-[#6b6b6b] text-sm whitespace-nowrap">
          Días
        </label>
        <input
          id="sa-days"
          type="number" min={1} max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          disabled={busy}
          className="w-20 h-9 border-2 border-[#f4c5df] rounded-xl px-2 outline-none bg-white text-sm focus:border-[#d63384] disabled:opacity-50"
        />
      </div>

      {/* Fila 2: botones
          Móvil:  grilla 2×2
          sm+:    fila flex
      */}
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
        {BTNS.map(({ label, variant, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={busy}
            className={[
              "rounded-xl px-3 py-2 text-xs font-black cursor-pointer transition-all duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "sm:rounded-full sm:flex-1 sm:min-w-[90px]",
              variantCls[variant],
            ].join(" ")}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mensaje de resultado */}
      {msg && (
        <p className="text-[#6b6b6b] text-xs m-0">{msg}</p>
      )}
    </div>
  );
}