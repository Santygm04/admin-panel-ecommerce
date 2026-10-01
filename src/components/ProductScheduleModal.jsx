// src/components/ProductScheduleModal.jsx
import { useEffect, useRef, useState } from "react";
import { CalendarClock, RefreshCw, Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Field, Input, Modal, Select } from "./ui";
import {
  SCHEDULE_KINDS,
  computeEndFromDuration,
  formatScheduleDateTime,
  getScheduleStatus,
  inferDurationMode,
  summarizeSchedule,
  validateScheduleRange,
} from "../utils/schedule";
import "./ProductScheduleModal.css";

const DURATION_OPTIONS = [
  { value: "7", label: "7 días" },
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días" },
  { value: "custom", label: "Personalizado" },
  { value: "none", label: "Sin vencimiento" },
];

const normalizeState = ({ activo, desde, hasta } = {}) => ({
  activo: activo === true,
  desde: desde || "",
  hasta: hasta || "",
});

const statesMatch = (a, b) => (
  a.activo === b.activo && a.desde === b.desde && a.hasta === b.hasta
);

/**
 * Modal reutilizable para configurar la vigencia de "Nuevos ingresos" o
 * "Destacados". Trabaja con fechas en formato `datetime-local` (hora local);
 * la conversión a ISO se hace al guardar el producto.
 */
export default function ProductScheduleModal({
  open,
  kind = "nuevo",
  value,
  productName = "",
  onSave,
  onClose,
}) {
  const meta = SCHEDULE_KINDS[kind] || SCHEDULE_KINDS.nuevo;
  const [initial, setInitial] = useState(() => normalizeState(value));
  const [state, setState] = useState(() => normalizeState(value));
  const [mode, setMode] = useState(() => inferDurationMode(normalizeState(value)));
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    // Solo se sincroniza al abrir para no pisar ediciones en curso.
    if (open && !wasOpenRef.current) {
      const next = normalizeState(value);
      setInitial(next);
      setState(next);
      setMode(inferDurationMode(next));
      setError("");
      setConfirmClose(false);
    }
    wasOpenRef.current = open;
  }, [open, value]);

  if (!open) return null;

  const status = getScheduleStatus(state);
  const dirty = !statesMatch(state, initial);
  const summary = summarizeSchedule(kind, state);

  const requestClose = () => {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    onClose?.();
  };

  const setField = (field, fieldValue) => {
    setState((current) => ({ ...current, [field]: fieldValue }));
    setError("");
  };

  const setDuration = (nextMode) => {
    setMode(nextMode);
    if (nextMode === "none") {
      setField("hasta", "");
      return;
    }
    if (nextMode === "custom") return;
    const days = Number(nextMode);
    if (!Number.isFinite(days) || days <= 0) return;
    setField("hasta", computeEndFromDuration(state.desde, days));
  };

  const setSince = (nextDesde) => {
    setState((current) => {
      const next = { ...current, desde: nextDesde };
      if (mode !== "custom" && mode !== "none") {
        const days = Number(mode);
        if (Number.isFinite(days) && days > 0) {
          next.hasta = computeEndFromDuration(nextDesde, days);
        }
      }
      return next;
    });
    setError("");
  };

  const renew = (days = 15) => {
    setState((current) => ({
      ...current,
      activo: true,
      desde: "",
      hasta: computeEndFromDuration("", days),
    }));
    setMode(String(days));
    setError("");
  };

  const clearConfig = () => {
    setState({ activo: false, desde: "", hasta: "" });
    setMode("none");
    setError("");
  };

  const submit = () => {
    const rangeError = validateScheduleRange(state.desde, state.hasta);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    onSave?.({
      activo: state.activo,
      desde: state.desde || "",
      hasta: state.hasta || "",
    });
  };

  return (
    <>
      <Modal
        open={open}
        wide
        title={`${meta.title} · vigencia`}
        subtitle={productName ? `Configuración para “${productName}”.` : undefined}
        onClose={requestClose}
        footer={(
          <>
            <Button
              variant="ghost"
              onClick={clearConfig}
              disabled={!state.activo && !state.desde && !state.hasta}
            >
              <Trash2 size={15} aria-hidden="true" /> Quitar
            </Button>
            <span className="psm-footer-gap" />
            <Button variant="secondary" onClick={requestClose}>Cancelar</Button>
            <Button onClick={submit}>Guardar</Button>
          </>
        )}
      >
        <div className="psm-body">
          <label className="ui-check psm-toggle">
            <input
              type="checkbox"
              checked={state.activo}
              onChange={(event) => setField("activo", event.target.checked)}
            />
            {meta.checkbox}
          </label>

          <div className="psm-summary" aria-live="polite">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{summary}</span>
          </div>

          {status.key === "expired" && (
            <div className="psm-alert psm-alert--warning" role="status">
              <span>La vigencia terminó el {formatScheduleDateTime(state.hasta, "—")}.</span>
              <Button variant="secondary" onClick={() => renew(15)}>
                <RefreshCw size={14} aria-hidden="true" /> Renovar 15 días
              </Button>
            </div>
          )}

          {state.activo && !state.hasta && (
            <p className="psm-hint">
              Sin fecha de finalización la etiqueta queda <b>vigente de forma indefinida</b> hasta desactivarla.
            </p>
          )}

          <div className="psm-grid">
            <Field label="Duración rápida">
              <Select value={mode} onChange={(event) => setDuration(event.target.value)}>
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Inicio" hint="Opcional. Vacío = comienza ahora.">
              <Input
                type="datetime-local"
                value={state.desde}
                onChange={(event) => setSince(event.target.value)}
              />
            </Field>

            <Field label="Finalización" hint="Vacío = sin vencimiento.">
              <Input
                type="datetime-local"
                value={state.hasta}
                onChange={(event) => {
                  setField("hasta", event.target.value);
                  setMode("custom");
                }}
              />
            </Field>
          </div>

          {error && <p className="psm-error" role="alert">{error}</p>}

          <p className="psm-hint">
            Mientras la vigencia esté activa, el producto aparece en la sección y muestra su badge.
            Al vencer deja de listarse automáticamente y sigue visible en el catálogo general.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClose}
        title="Descartar cambios"
        message="Tenés cambios sin guardar en la vigencia. ¿Querés descartarlos?"
        confirmText="Descartar"
        cancelText="Seguir editando"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          onClose?.();
        }}
      />
    </>
  );
}

/** Fila compacta para el formulario: abre el modal y resume el estado. */
export function ProductScheduleSwitch({ kind = "nuevo", value, onConfigure }) {
  const meta = SCHEDULE_KINDS[kind] || SCHEDULE_KINDS.nuevo;
  const status = getScheduleStatus(value);
  return (
    <div className={`pf-schedule pf-schedule--${status.key}`}>
      <label className="ui-check pf-schedule-check">
        <input
          type="checkbox"
          checked={value?.activo === true}
          onChange={() => onConfigure?.()}
        />
        {meta.checkbox}
      </label>
      <button type="button" className="pf-schedule-edit" onClick={() => onConfigure?.()}>
        <CalendarClock size={14} aria-hidden="true" />
        {value?.activo ? "Editar vigencia" : "Programar"}
      </button>
      <div className="pf-schedule-summary">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span>{summarizeSchedule(kind, value)}</span>
      </div>
    </div>
  );
}
