import { useState } from "react";
import { Button, Field, Input } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import { API_URL } from "../utils/api";

const localToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export default function StatsAdminControls({ onAfterAction, className = "" }) {
  const [days, setDays] = useState(30);
  const [activeAction, setActiveAction] = useState("");
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [confirmation, setConfirmation] = useState(null);

  const token = sessionStorage.getItem("aesthetic:token") || "";

  async function call(action, method, path, body, successText) {
    if (!token) {
      setMsg({ text: "Sesión de administrador no disponible", ok: false });
      return null;
    }

    setActiveAction(action);
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

      setMsg({ text: successText, ok: true });
      onAfterAction?.(data);
      return data;
    } catch (e) {
      setMsg({ text: e.message || "Error", ok: false });
      return null;
    } finally {
      setActiveAction("");
    }
  }

  const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
  const handleClear = () => call("clear", "DELETE", "/api/payments/stats/snapshot/clear", undefined, "Histórico eliminado correctamente");
  const handleRun = () => call("run", "POST", "/api/payments/stats/snapshot/run", { days: safeDays }, "Días faltantes reconstruidos correctamente");
  const handleReset = () => call("reset", "POST", "/api/payments/stats/snapshot/reset", { days: safeDays }, "Histórico recalculado correctamente");

  const handleRecalcToday = () => call("today", "POST", `/api/payments/stats/snapshot/day/${localToday()}`, undefined, "Datos de hoy actualizados correctamente");

  const confirmAction = async () => {
    const action = confirmation?.action;
    setConfirmation(null);
    if (action === "clear") await handleClear();
    if (action === "reset") await handleReset();
  };

  return (
    <>
      <div className={`stats-admin ${className}`.trim()}>
        <div className="sa-row">
          <div className="sa-copy">
            <h3>Administrar datos históricos</h3>
            <p>Usá estas acciones sólo si el histórico está incompleto o necesita recalcularse.</p>
          </div>

          <div className="sa-controls">
            <Field label="Período" hint="1 a 365 días" className="sa-days">
              <Input
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                value={days}
                onChange={(event) => setDays(event.target.value)}
                onBlur={() => setDays(safeDays)}
              />
            </Field>

            <div className="sa-btns">
              <Button variant="secondary" size="sm" loading={activeAction === "run"} disabled={Boolean(activeAction)} onClick={handleRun}>
                Crear faltantes
              </Button>
              <Button variant="secondary" size="sm" loading={activeAction === "today"} disabled={Boolean(activeAction)} onClick={handleRecalcToday}>
                Actualizar hoy
              </Button>
              <Button variant="primary" size="sm" loading={activeAction === "reset"} disabled={Boolean(activeAction)} onClick={() => setConfirmation({ action: "reset" })}>
                Recalcular período
              </Button>
              <Button variant="danger-ghost" size="sm" loading={activeAction === "clear"} disabled={Boolean(activeAction)} onClick={() => setConfirmation({ action: "clear" })}>
                Vaciar histórico
              </Button>
            </div>
          </div>
        </div>

        {msg.text && (
          <div className={`ui-banner ${msg.ok ? "ui-banner--success" : "ui-banner--danger"}`} role="status">
            {msg.text}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.action === "clear" ? "Vaciar todo el histórico" : "Recalcular el período"}
        message={confirmation?.action === "clear"
          ? "Se eliminarán todos los snapshots históricos. Esta acción no se puede deshacer."
          : `Se reemplazarán los snapshots de los últimos ${safeDays} días con datos recalculados.`}
        confirmText={confirmation?.action === "clear" ? "Vaciar histórico" : "Recalcular"}
        onConfirm={confirmAction}
        onCancel={() => setConfirmation(null)}
        loading={Boolean(activeAction)}
        danger={confirmation?.action === "clear"}
      />
    </>
  );
}
