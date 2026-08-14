import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { Link, useLocation } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import ProductList from "./ProductList";
import ProductForm from "./ProductForm";
import StatsAdminControls from "./StatsAdminControls";
import CategoryManager from "./CategoryManager";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Select, Tabs } from "./ui";
import { useTheme } from "../theme/ThemeContext";
import {
  PlusIcon, ChartIcon, LockIcon, UsersIcon,
  CoinsIcon, CheckCircleIcon, PercentIcon, TargetIcon,
} from "./ui/icons";
import "./DashBoard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const SHOW_ADVANCED_DEFAULT =
  String(import.meta.env.VITE_STATS_SHOW_ADVANCED ?? "true").toLowerCase() === "true";

/* ─── Helpers ─── */
const money = (n) =>
  Number(n || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const moneyShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
};

const fmtDay = (s) => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  if (!y) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

const fmtDT = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR");
};

/* Paleta de gráficos leída de los tokens (se refresca con el tema) */
function useChartPalette() {
  useTheme();
  const css = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  return {
    brand: css("--adm-brand", "#ff5aa8"),
    brandSoft: css("--adm-brand-soft", "rgba(255,90,168,.14)"),
    gold: css("--adm-gold", "#e8c56a"),
    grid: css("--adm-border", "#332b49"),
    tick: css("--adm-muted", "#a89fbb"),
  };
}

/* ══════════════════════════════════════════
   DASHBOARD PRINCIPAL
══════════════════════════════════════════ */
export default function DashBoard() {
  const { user } = useAuth();
  const [vista, setVista] = useState("stock");
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    setVista(tab || "stock");
  }, [location.search]);

  const is = (perm) => user?.role === "admin" || Boolean(user?.permissions?.[perm]);

  return (
    <div className="dash">
      <main className="dash-content">
        {vista === "stock" && <ProductList />}
        {vista === "crear" && <ProductForm onCreated={() => setVista("stock")} />}
        {vista === "categorias" && (is("editarCategorias") ? <CategoryManager /> : <SolicitarPermisoSection permiso="editarCategorias" />)}
        {vista === "estadisticas" && <StatsSection />}
        {vista === "cuenta" && <CuentaSection />}
        {vista === "usuarios" && <UsuariosSection />}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════
   STATS SECTION
══════════════════════════════════════════ */
function StatsSection() {
  const [range, setRange] = useState("7d");
  const [useSnapshots, setUseSnapshots] = useState(false);
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(SHOW_ADVANCED_DEFAULT);

  const esRef = useRef(null);
  const pollRef = useRef(null);
  const adminSecret = useMemo(() => sessionStorage.getItem("ADMIN_SECRET") || "", []);

  async function refetchSummary(r = range, snap = useSnapshots) {
    if (!adminSecret) return;
    const base = snap ? "/api/payments/stats/snapshot/summary" : "/api/payments/stats/summary";
    try {
      setError("");
      const res = await fetch(`${API_URL}${base}?range=${r}`, {
        headers: { "x-admin-secret": adminSecret },
      });
      const d = await res.json();
      if (!res.ok) { setError(d?.message || "Error en estadísticas"); setStats(null); return; }
      setStats(d);
    } catch { setError("No se pudieron cargar estadísticas"); }
  }

  useEffect(() => { refetchSummary(range, useSnapshots); }, [range, adminSecret, useSnapshots]); // eslint-disable-line

  useEffect(() => {
    if (!adminSecret) return;
    esRef.current?.close();
    pollRef.current && clearInterval(pollRef.current);
    esRef.current = pollRef.current = null;
    setLive(false);
    if (useSnapshots) return;

    const enc = encodeURIComponent(adminSecret);
    const url = `${API_URL}/api/payments/stats/stream?range=${range}&admin_secret=${enc}`;
    const startPoll = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => refetchSummary(range, false), 30000);
    };

    try {
      const es = new EventSource(url);
      esRef.current = es;
      const onMsg = (e) => {
        try { const d = JSON.parse(e.data); if (d?.totals) { setStats(d); setLive(true); } } catch {}
      };
      es.addEventListener("stats", onMsg);
      es.onmessage = onMsg;
      es.onopen = () => { setLive(true); setError(""); };
      es.onerror = () => { setLive(false); startPoll(); };
    } catch { startPoll(); }

    return () => {
      esRef.current?.close();
      pollRef.current && clearInterval(pollRef.current);
      esRef.current = pollRef.current = null;
    };
  }, [range, adminSecret, useSnapshots]); // eslint-disable-line

  const data = stats?.seriesByDay || [];
  const totals = stats?.totals || {};
  const conv = totals.ordersAll ? Math.round((totals.ordersPaid / totals.ordersAll) * 100) : 0;

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div className="st-head-left">
          <h2 className="st-title">Estadísticas</h2>
          {!useSnapshots && (
            <Badge tone={live ? "success" : "neutral"} dot>{live ? "En vivo" : "Offline"}</Badge>
          )}
        </div>
        <div className="st-head-right">
          <Tabs
            variant="pill"
            active={range}
            onChange={setRange}
            items={[
              { key: "7d", label: "7d" },
              { key: "30d", label: "30d" },
              { key: "12w", label: "12s" },
            ]}
          />
        </div>
      </div>

      <div className="st-toolbar">
        <label className="st-check">
          <input
            type="checkbox"
            checked={useSnapshots}
            onChange={(e) => setUseSnapshots(e.target.checked)}
          />
          Snapshots históricos
        </label>

        {SHOW_ADVANCED_DEFAULT && (
          <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? "Ocultar avanzado" : "Avanzado"}
          </Button>
        )}
      </div>

      {showAdvanced && (
        <div className="st-adv-bar">
          <StatsAdminControls onAfterAction={() => refetchSummary(range, true)} />
        </div>
      )}

      {!adminSecret && (
        <div className="ui-banner ui-banner--info">
          Necesitás iniciar sesión en <b>Órdenes</b> para guardar el <code>ADMIN_SECRET</code>.{" "}
          <Link to="/orders">Ir a Órdenes →</Link>
        </div>
      )}
      {error && (
        <div className="ui-banner ui-banner--danger" role="alert">{error}</div>
      )}

      <div className="st-kpis">
        <KPICard tone="brand" icon={<CoinsIcon size={20} />} label="Ingresos pagados"
          value={stats ? moneyShort(totals.paidRevenue) : "…"}
          sub={stats ? money(totals.paidRevenue) : "cargando…"} />
        <KPICard tone="success" icon={<CheckCircleIcon size={20} />} label="Órdenes pagadas"
          value={stats ? String(totals.ordersPaid ?? 0) : "…"}
          sub={`de ${totals.ordersAll ?? 0} totales`} />
        <KPICard tone="info" icon={<PercentIcon size={20} />} label="Conversión"
          value={stats ? `${conv}%` : "…"}
          sub="pagadas / totales" />
        <KPICard tone="gold" icon={<TargetIcon size={20} />} label="Ticket promedio"
          value={stats ? moneyShort(totals.aov) : "…"}
          sub={stats ? money(totals.aov) : "cargando…"} />
      </div>

      <div className="st-charts">
        <Card className="st-chart-card" pad>
          <p className="st-chart-title">Ingresos por día</p>
          <p className="st-chart-sub">Ventas confirmadas en ARS</p>
          <RevenueChart data={data} />
        </Card>

        <Card className="st-chart-card" pad>
          <div className="st-chart-head">
            <div>
              <p className="st-chart-title">Órdenes por día</p>
              <p className="st-chart-sub">Pagadas vs. totales</p>
            </div>
            <div className="st-legend">
              <span><i className="st-legend-dot st-legend-dot--brand" />Pagadas</span>
              <span><i className="st-legend-dot st-legend-dot--soft" />Totales</span>
            </div>
          </div>
          <OrdersChart data={data} />
        </Card>
      </div>

      <Card className="st-table-card">
        <div className="st-table-head">
          <div>
            <p className="st-chart-title">Resumen semanal</p>
            <p className="st-chart-sub">Últimos 7 días · órdenes pagadas</p>
          </div>
          {stats && <span className="st-range-chip">{stats.from} → {stats.to}</span>}
        </div>
        <div className="st-table-scroll">
          <table className="st-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pagadas</th>
                <th>Totales</th>
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(-7).map((row) => (
                <tr key={row.date}>
                  <td><b>{fmtDay(row.date)}</b></td>
                  <td><Badge tone="success">{row.ordersPaid}</Badge></td>
                  <td className="st-td-muted">{row.ordersAll}</td>
                  <td className="st-td-money">{money(row.paidRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length && (
            <EmptyState
              icon={<ChartIcon size={24} />}
              title="Sin datos para este período"
              description="Todavía no hay ventas registradas en el rango seleccionado."
            />
          )}
        </div>
        <p className="st-foot">Actualizado: {fmtDT(stats?.generatedAt)}</p>
      </Card>
    </div>
  );
}

/* ── Gráficos recharts ── */
function ChartTip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <span className="chart-tip-label">{label}</span>
      {payload.map((p) => (
        <span key={p.dataKey} className="chart-tip-row">
          <i style={{ background: p.color || p.fill }} />
          {p.name}: <b>{format ? format(p.value) : money(p.value)}</b>
        </span>
      ))}
    </div>
  );
}

function RevenueChart({ data }) {
  const colors = useChartPalette();
  const rows = data.map((d) => ({ name: fmtDay(d.date), ingresos: d.paidRevenue }));
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.brand} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={moneyShort} width={56} />
          <Tooltip content={<ChartTip format={money} />} />
          <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={colors.brand}
            strokeWidth={2.5} fill="url(#revGrad)" dot={data.length > 20 ? false : { r: 3, fill: colors.brand }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function OrdersChart({ data }) {
  const colors = useChartPalette();
  const rows = data.map((d) => ({ name: fmtDay(d.date), pagadas: d.ordersPaid, totales: d.ordersAll }));
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={3}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
          <Tooltip content={<ChartTip format={(v) => String(v)} />} />
          <Bar dataKey="pagadas" name="Pagadas" fill={colors.brand} radius={[5, 5, 0, 0]} maxBarSize={26} />
          <Bar dataKey="totales" name="Totales" fill={colors.brandSoft} radius={[5, 5, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ══════════════════════════════════════════
   CUENTA — Cambiar contraseña
══════════════════════════════════════════ */
function CuentaSection() {
  const { changePassword, user } = useAuth();
  const [form, setForm] = useState({ actual: "", nueva: "", repetir: "" });
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });
    if (form.nueva.length < 8)
      return setMsg({ text: "La nueva contraseña debe tener mínimo 8 caracteres.", ok: false });
    if (form.nueva !== form.repetir)
      return setMsg({ text: "Las contraseñas no coinciden.", ok: false });
    setLoading(true);
    try {
      await changePassword(form.actual, form.nueva);
      setMsg({ text: "Contraseña actualizada correctamente.", ok: true });
      setForm({ actual: "", nueva: "", repetir: "" });
    } catch (err) {
      setMsg({ text: err?.message || "Error al cambiar contraseña.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-narrow">
      <h2 className="st-title">Mi cuenta</h2>
      {user && (
        <p className="section-meta">
          Usuario: <strong>{user.username}</strong> · Rol: <strong>{user.role}</strong>
        </p>
      )}

      <Card pad>
        <CardTitle>Cambiar contraseña</CardTitle>
        <form onSubmit={submit} className="section-form">
          {msg.text && (
            <div className={`ui-banner ${msg.ok ? "ui-banner--success" : "ui-banner--danger"}`} role="status">
              {msg.text}
            </div>
          )}
          <Field label="Contraseña actual">
            <Input
              type="password"
              autoComplete="current-password"
              value={form.actual}
              onChange={(e) => setForm({ ...form, actual: e.target.value })}
              required
            />
          </Field>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.nueva}
              onChange={(e) => setForm({ ...form, nueva: e.target.value })}
              required
            />
          </Field>
          <Field label="Repetir nueva contraseña">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.repetir}
              onChange={(e) => setForm({ ...form, repetir: e.target.value })}
              required
            />
          </Field>
          <Button type="submit" loading={loading}>
            {loading ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════
   USUARIOS — Gestión de vendedores
══════════════════════════════════════════ */
function UsuariosSection() {
  const { getUsers, createUser, updateUser, deleteUser, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    username: "", password: "", name: "", role: "vendedor",
    permissions: {
      verEstadisticas: false, verOrdenes: true,
      editarCategorias: false, crearProductos: true, editarStockSolo: true,
    },
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setUsers(await getUsers()); } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const resetForm = () => {
    setForm({
      username: "", password: "", name: "", role: "vendedor",
      permissions: {
        verEstadisticas: false, verOrdenes: true,
        editarCategorias: false, crearProductos: true, editarStockSolo: true,
      },
    });
    setEditTarget(null);
    setShowForm(false);
  };

  const startEdit = (u) => {
    setEditTarget(u);
    setForm({
      username: u.username, password: "", name: u.name || "", role: u.role,
      permissions: { ...u.permissions },
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (editTarget) {
        const payload = { name: form.name, role: form.role, permissions: form.permissions };
        if (form.password) payload.password = form.password;
        await updateUser(editTarget._id, payload);
      } else {
        await createUser(form);
      }
      await load();
      resetForm();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteUser(confirmData._id);
      await load();
      setConfirmData(null);
    } catch (err) {
      setMsg(err.message);
      setConfirmData(null);
    } finally {
      setDeleting(false);
    }
  };

  const togglePerm = (key) =>
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));

  const PERMS = [
    { key: "verEstadisticas", label: "Ver estadísticas" },
    { key: "verOrdenes", label: "Ver órdenes" },
    { key: "editarCategorias", label: "Editar categorías" },
    { key: "crearProductos", label: "Crear productos" },
    { key: "editarStockSolo", label: "Solo editar stock" },
  ];

  return (
    <div className="section-narrow">
      <div className="section-head">
        <h2 className="st-title">Gestión de usuarios</h2>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <PlusIcon size={15} /> Nuevo usuario
        </Button>
      </div>

      {msg && <div className="ui-banner ui-banner--danger" role="alert">{msg}</div>}

      {showForm && (
        <Card pad className="users-form-card">
          <CardTitle>{editTarget ? `Editar: ${editTarget.username}` : "Nuevo usuario"}</CardTitle>
          <form onSubmit={handleSubmit} className="section-form">
            {!editTarget && (
              <Field label="Usuario" hint="Ej: vendedora1">
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </Field>
            )}
            <Field label="Nombre visible">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={editTarget ? "Nueva contraseña" : "Contraseña"}
              hint={editTarget ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                {...(!editTarget && { required: true })}
              />
            </Field>
            <Field label="Rol">
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>

            <Field label="Permisos">
              <div className="users-perms">
                {PERMS.map(({ key, label }) => (
                  <label key={key} className="ui-check">
                    <input
                      type="checkbox"
                      checked={!!form.permissions[key]}
                      onChange={() => togglePerm(key)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>

            <div className="ui-row">
              <Button type="submit" loading={saving}>
                {saving ? "Guardando…" : editTarget ? "Guardar cambios" : "Crear usuario"}
              </Button>
              <Button variant="secondary" onClick={resetForm}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="users-skeleton">
          <div className="ui-skeleton ui-skeleton--block" />
          <div className="ui-skeleton ui-skeleton--block" />
          <div className="ui-skeleton ui-skeleton--block" />
        </div>
      ) : (
        <div className="users-list">
          {users.map((u) => (
            <Card key={u._id} pad className="users-item">
              <div className="users-item-meta">
                <div className="ui-row">
                  <strong className="users-item-name">{u.name || u.username}</strong>
                  {u._id === me?._id && <Badge tone="brand">Vos</Badge>}
                </div>
                <p className="users-item-sub">
                  @{u.username} · {u.role} ·{" "}
                  <Badge tone={u.active ? "success" : "neutral"} outline>
                    {u.active ? "activo" : "inactivo"}
                  </Badge>
                </p>
              </div>
              <div className="ui-row users-item-actions">
                <Button variant="secondary" size="sm" onClick={() => startEdit(u)}>Editar</Button>
                {u._id !== me?._id && (
                  <Button variant="danger-ghost" size="sm" onClick={() => setConfirmData(u)}>
                    Eliminar
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {!users.length && (
            <EmptyState
              icon={<UsersIcon size={24} />}
              title="No hay usuarios"
              description="Creá el primer vendedor con el botón «Nuevo usuario»."
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmData)}
        title="Eliminar usuario"
        message={`¿Eliminar usuario "${confirmData?.username}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmData(null)}
        loading={deleting}
      />
    </div>
  );
}

/* ══════════════════════════════════════════
   SOLICITAR PERMISO — para vendedores sin acceso
══════════════════════════════════════════ */
function SolicitarPermisoSection({ permiso }) {
  const { user, token } = useAuth();
  const [estado, setEstado] = useState("idle");
  const [msg, setMsg] = useState("");

  const LABELS = {
    editarCategorias: "Editar categorías",
    crearProductos: "Crear productos",
    verEstadisticas: "Ver estadísticas",
    verOrdenes: "Ver órdenes",
    editarStockSolo: "Editar stock",
  };

  const enviarSolicitud = async () => {
    setEstado("loading");
    setMsg("");
    try {
      const res = await fetch(`${API_URL}/api/auth/request-permission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permiso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error al enviar solicitud");
      setEstado("ok");
      setMsg("Solicitud enviada. La administradora recibirá un email para aprobarte.");
    } catch (err) {
      setEstado("err");
      setMsg(err.message);
    }
  };

  return (
    <div className="section-narrow">
      <EmptyState
        icon={<LockIcon size={24} />}
        title={`Sin acceso a "${LABELS[permiso] || permiso}"`}
        description="No tenés permiso para esta sección. Podés enviarle una solicitud a la administradora para que te lo habilite."
        action={
          estado === "ok" ? (
            <div className="ui-banner ui-banner--success">{msg}</div>
          ) : (
            <Button onClick={enviarSolicitud} loading={estado === "loading"}>
              {estado === "loading" ? "Enviando…" : "Solicitar permiso"}
            </Button>
          )
        }
      />
      {msg && estado !== "ok" && <div className="ui-banner ui-banner--danger">{msg}</div>}
    </div>
  );
}

function KPICard({ tone, icon, label, value, sub }) {
  return (
    <Card className={`st-kpi st-kpi--${tone}`}>
      <div className="st-kpi-top">
        <span className="st-kpi-icon">{icon}</span>
        <span className="st-kpi-label">{label}</span>
      </div>
      <div className="st-kpi-value">{value}</div>
      <div className="st-kpi-sub">{sub}</div>
    </Card>
  );
}
