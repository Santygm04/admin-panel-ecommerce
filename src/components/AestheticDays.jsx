import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Info, Power, RefreshCw, Sparkles, Store, XCircle } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Card, Field, Input, Skeleton } from "./ui";
import { API_URL, authHeaders } from "../utils/api";
import { notify } from "../utils/toast";
import "./AestheticDays.css";

const API = `${API_URL}/api/aesthetic-days`;
const DEFAULT_DATA = {
  state: {
    active: false,
    effectiveActive: false,
    status: "inactive",
    scope: "online-store",
    startsAt: null,
    endsAt: null,
    activatedAt: null,
    activatedBy: null,
    updatedAt: null,
  },
  stats: { totalProducts: 0, eligibleProducts: 0, withoutWholesalePrice: 0 },
};

const pad = (value) => String(value).padStart(2, "0");

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value) {
  if (!value) return "No configurada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No configurada"
    : date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function statusMeta(state) {
  if (state.status === "active") return { label: "Activo", tone: "success", icon: <CheckCircle2 size={18} /> };
  if (state.status === "scheduled") return { label: "Programado", tone: "info", icon: <CalendarClock size={18} /> };
  if (state.status === "expired") return { label: "Vencido", tone: "warning", icon: <CalendarClock size={18} /> };
  return { label: "Inactivo", tone: "neutral", icon: <XCircle size={18} /> };
}

export default function AestheticDays() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [form, setForm] = useState({ startsAt: "", endsAt: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const load = async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(API, { headers: authHeaders() });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.message || "No se pudo cargar Aesthetic Days");
      setData(next);
      setForm({ startsAt: toDateTimeLocal(next.state?.startsAt), endsAt: toDateTimeLocal(next.state?.endsAt) });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (quiet) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const meta = statusMeta(data.state);
  const nextActive = !data.state.active;
  const activationMessage = "Se aplicará en el ecommerce online (online-store) desde la primera unidad para los productos con precio mayorista válido. ¿Querés activarlo?";

  const submit = async () => {
    if (!pendingAction) return;
    setSaving(true);
    try {
      const startsAt = form.startsAt ? new Date(form.startsAt).toISOString() : null;
      const endsAt = form.endsAt ? new Date(form.endsAt).toISOString() : null;
      const response = await fetch(API, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ active: pendingAction.active, startsAt, endsAt }),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.message || "No se pudo actualizar Aesthetic Days");
      setData(next);
      setForm({ startsAt: toDateTimeLocal(next.state?.startsAt), endsAt: toDateTimeLocal(next.state?.endsAt) });
      setPendingAction(null);
       notify.success(pendingAction.updateOnly
         ? "Vigencia de Aesthetic Days actualizada"
         : pendingAction.active ? "Aesthetic Days activado" : "Aesthetic Days desactivado");
    } catch (saveError) {
      notify.error(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const requestUpdate = () => {
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      notify.error("La fecha de finalización debe ser posterior al inicio");
      return;
    }
    setPendingAction({ active: data.state.active, updateOnly: true });
  };

  return (
    <section className="ui-page aesthetic-days-page">
      <div className="aesthetic-days-head">
        <div>
          <div className="aesthetic-days-eyebrow"><Sparkles size={15} /> PROMOCIONES / REGLA DE PRECIOS</div>
          <h1 className="ui-page-title">Aesthetic Days</h1>
          <p className="ui-page-sub">Precio mayorista desde la primera unidad, sin modificar permanentemente los precios del catálogo.</p>
        </div>
        <Button variant={data.state.active ? "danger" : "primary"} onClick={() => setPendingAction({ active: nextActive })} disabled={loading || saving}>
          <Power size={16} /> {data.state.active ? "Desactivar" : "Activar Aesthetic Days"}
        </Button>
      </div>

      {error && <div className="ui-banner ui-banner--danger aesthetic-days-error" role="alert">{error}<Button size="sm" variant="secondary" onClick={() => load()}>Reintentar</Button></div>}

      {loading ? (
        <Card className="aesthetic-days-loading" pad>
          <Skeleton variant="text" width="42%" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </Card>
      ) : (
        <>
          <Card className={`aesthetic-days-status aesthetic-days-status--${meta.tone}`} pad>
            <div className="aesthetic-days-status-icon" aria-hidden="true">{meta.icon}</div>
            <div className="aesthetic-days-status-copy">
              <div className="aesthetic-days-status-topline"><span>Estado actual</span><Badge tone={meta.tone} dot>{meta.label}</Badge></div>
              <h2>{data.state.effectiveActive ? "Los precios mayoristas están disponibles desde 1 unidad" : "La promoción no está aplicando precios especiales"}</h2>
              <p>{data.state.effectiveActive ? `Activo desde ${formatDate(data.state.activatedAt || data.state.startsAt)}.` : data.state.status === "scheduled" ? `Comienza el ${formatDate(data.state.startsAt)}.` : "Activá la regla para que el checkout la aplique de forma segura."}</p>
            </div>
            <Button variant={data.state.active ? "danger-ghost" : "secondary"} onClick={() => setPendingAction({ active: nextActive })} disabled={saving}>
              <Power size={16} /> {data.state.active ? "Desactivar" : "Activar"}
            </Button>
          </Card>

          <div className="aesthetic-days-kpis">
            <Card className="aesthetic-days-kpi" pad><span className="aesthetic-days-kpi-label">Con precio mayorista</span><strong>{data.stats.eligibleProducts}</strong><small>productos alcanzados</small></Card>
            <Card className="aesthetic-days-kpi" pad><span className="aesthetic-days-kpi-label">Sin precio mayorista</span><strong>{data.stats.withoutWholesalePrice}</strong><small>mantienen precio normal</small></Card>
            <Card className="aesthetic-days-kpi" pad><span className="aesthetic-days-kpi-label">Catálogo visible</span><strong>{data.stats.totalProducts}</strong><small>productos revisados</small></Card>
          </div>

          <div className="aesthetic-days-grid">
            <Card className="aesthetic-days-card" pad>
              <div className="aesthetic-days-card-heading"><div><h2>Vigencia</h2><p>Podés dejarla inmediata o programar una ventana.</p></div><CalendarClock size={20} aria-hidden="true" /></div>
              <div className="aesthetic-days-form-grid">
                <Field label="Inicio"><Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></Field>
                <Field label="Finalización opcional"><Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></Field>
              </div>
              <div className="aesthetic-days-card-footer"><span>Última modificación: {formatDate(data.state.updatedAt)}</span><Button variant="secondary" onClick={requestUpdate} loading={saving} disabled={saving}>Guardar vigencia</Button></div>
            </Card>

            <Card className="aesthetic-days-card" pad>
              <div className="aesthetic-days-card-heading"><div><h2>Alcance y regla</h2><p>La configuración se aplica solo al ecommerce principal.</p></div><Store size={20} aria-hidden="true" /></div>
              <div className="aesthetic-days-rule-list">
                <div><strong>Scope</strong><span>online-store</span></div>
                <div><strong>Prioridad</strong><span>Aesthetic Days → mayorista → especial → unitario</span></div>
                <div><strong>Unidad</strong><span>Respeta cajas, medias cajas y packs configurados</span></div>
              </div>
            </Card>
          </div>

          <div className="aesthetic-days-notes">
            <div className="aesthetic-days-note"><Info size={17} aria-hidden="true" /><div><strong>Aesthetic Days</strong><p>Durante Aesthetic Days, los clientes acceden al precio mayorista comprando desde la primera unidad. La promoción es temporal y reversible.</p></div></div>
            {data.stats.withoutWholesalePrice > 0 && <div className="aesthetic-days-note aesthetic-days-note--warning"><AlertTriangle size={17} aria-hidden="true" /><div><strong>Hay productos fuera de la promoción</strong><p>{data.stats.withoutWholesalePrice} producto{data.stats.withoutWholesalePrice === 1 ? "" : "s"} visible{data.stats.withoutWholesalePrice === 1 ? "" : "s"} no tiene{data.stats.withoutWholesalePrice === 1 ? "" : "n"} precio mayorista válido y mantendrá su precio habitual.</p></div></div>}
          </div>
        </>
      )}

      <div className="aesthetic-days-refresh"><Button size="sm" variant="ghost" onClick={() => load({ quiet: true })} disabled={loading || refreshing}><RefreshCw size={15} /> Actualizar información</Button></div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.updateOnly ? "Guardar vigencia" : pendingAction?.active ? "Activar Aesthetic Days" : "Desactivar Aesthetic Days"}
        message={pendingAction?.updateOnly ? "Se actualizarán las fechas de vigencia de Aesthetic Days sin cambiar su estado actual. ¿Querés continuar?" : pendingAction?.active ? activationMessage : "Los nuevos cálculos volverán a la lógica normal de precios. Los pedidos ya creados conservarán el precio con el que fueron calculados. ¿Querés desactivarlo?"}
        confirmText={pendingAction?.updateOnly ? "Guardar vigencia" : pendingAction?.active ? "Activar promoción" : "Desactivar promoción"}
        cancelText="Cancelar"
        danger={!pendingAction?.active && !pendingAction?.updateOnly}
        onConfirm={submit}
        onCancel={() => setPendingAction(null)}
        loading={saving}
      />
    </section>
  );
}
