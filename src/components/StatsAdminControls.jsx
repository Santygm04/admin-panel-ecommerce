import { useState } from "react";
import { Button, Field, Input } from "./ui";
import { API_URL } from "../utils/api";


export default function StatsAdminControls({ onAfterAction, className = "" }) {
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  const token = sessionStorage.getItem("aesthetic:token") || "";

  async function call(method, path, body) {
    if (!token) {
      setMsg({ text: "Sesión de administrador no disponible", ok: false });
      return null;
    }

    setBusy(true);
    setMsg({ text: "", ok: false });

    try {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Error de servidor");

      setMsg({ text: "Listo", ok: true });
      onAfterAction?.(data);
      return data;
    } catch (e) {
      setMsg({ text: e.message || "Error", ok: false });
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
    <div className={`stats-admin ${className}`.trim()}>
      <div className="sa-row">
        <Field label="Días" className="sa-days">
          <Input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            style={{ width: 96 }}
          />
        </Field>

        <div className="sa-btns">
          <Button variant="secondary" size="sm" disabled={busy} onClick={handleRun}>
            Reconstruir
          </Button>
          <Button variant="danger-ghost" size="sm" disabled={busy} onClick={handleClear}>
            Limpiar
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={handleReset}>
            Reset
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={handleRecalcToday}>
            Recalcular hoy
          </Button>
        </div>
      </div>

      {msg.text && (
        <div className={`ui-banner ${msg.ok ? "ui-banner--success" : "ui-banner--danger"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
