import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { Link, useLocation } from "react-router-dom";
import ProductList from "../../src/components/ProductList";
import ProductForm from "../../src/components/ProductForm";
import StatsAdminControls from "../../src/components/StatsAdminControls";
import "../../src/components/DashBoard.css";
import CategoryManager from "./CategoryManager";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const SHOW_ADVANCED_DEFAULT =
  String(import.meta.env.VITE_STATS_SHOW_ADVANCED ?? "true").toLowerCase() === "true";

/* ─── Chart.js loader (singleton, no rompe el bundle) ─── */
let _cjsReady = false;
let _cjsCbs   = [];
function loadChartJs(cb) {
  if (_cjsReady) return cb();
  _cjsCbs.push(cb);
  if (_cjsCbs.length > 1) return;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
  s.onload = () => { _cjsReady = true; _cjsCbs.forEach((f) => f()); _cjsCbs = []; };
  document.head.appendChild(s);
}

/* ─── Helpers ─── */
const money = (n) =>
  Number(n || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const moneyShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
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

/* ══════════════════════════════════════════
   DASHBOARD PRINCIPAL
══════════════════════════════════════════ */
export default function DashBoard() {
  const { user, logout } = useAuth();
  const [vista, setVista] = useState("stock");
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab) setVista(tab);
  }, [location.search]);
  const adminSecret = useMemo(() => sessionStorage.getItem("ADMIN_SECRET") || "", []);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!adminSecret) return;
    let abort = false;
    const fetch_ = async () => {
      try {
        const url = new URL(`${API_URL}/api/payments/orders`);
        url.searchParams.set("status", "pending");
        const res  = await fetch(url, { headers: { "x-admin-secret": adminSecret } });
        const data = await res.json();
        if (!res.ok) throw new Error();
        if (!abort) setPendingCount((data.orders || []).length);
      } catch { if (!abort) setPendingCount(0); }
    };
    fetch_();
    const id = setInterval(fetch_, 10000);
    return () => { abort = true; clearInterval(id); };
  }, [adminSecret]);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const TabBtn = ({ id, icon, label }) => (
    <button
      className={`tab-btn ${vista === id ? "active" : ""}`}
      onClick={() => setVista(id)}
      type="button"
    >
      <span className="tab-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="dash">
      {/* Topbar */}
      <header className="dash-topbar">
        <div className="brand">
          <span className="brand-badge">A</span>
          <div className="brand-text">
            <strong>Aesthetic</strong>
            <small>Panel de Administración</small>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn-outline" onClick={handleLogout} type="button">
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="dash-row">
        <nav className="dash-tabs" role="tablist">
          {(user?.role === "admin" || user?.permissions?.verOrdenes) && (
            <TabBtn id="stock" icon="📦" label="Ver stock" />
          )}
          {(user?.role === "admin" || user?.permissions?.crearProductos) && (
            <TabBtn id="crear" icon="⬆️" label="Subir producto" />
          )}
          {(user?.role === "admin" || user?.permissions?.editarCategorias) && (
            <TabBtn id="categorias" icon="🗂️" label="Categorías" />
          )}
          {(user?.role === "admin" || user?.permissions?.verEstadisticas) && (
            <TabBtn id="estadisticas" icon="📈" label="Estadísticas" />
          )}
          <TabBtn id="cuenta" icon="🔐" label="Mi cuenta" />
          {user?.role === "admin" && (
            <TabBtn id="usuarios" icon="👥" label="Usuarios" />
          )}
        </nav>
        <Link to="/orders" className="tab-btn tab-cta orders-link">
          <span className="tab-icon">🧾</span>
          <span>Órdenes</span>
          {adminSecret && pendingCount > 0 && (
            <span className="notif-badge">{pendingCount}</span>
          )}
        </Link>
      </div>

      {/* Contenido */}
      <main className="dash-content">
        {vista === "stock"        && <ProductList />}
        {vista === "crear"        && <ProductForm onCreated={() => setVista("stock")} />}
        {vista === "categorias"   && (
          user?.role === "admin" || user?.permissions?.editarCategorias
            ? <CategoryManager />
            : <SolicitarPermisoSection permiso="editarCategorias" />
        )}
        {vista === "estadisticas" && <StatsSection />}
{vista === "cuenta"       && <CuentaSection />}
{vista === "usuarios"     && <UsuariosSection />}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════
   STATS SECTION  —  diseño nuevo con Chart.js
══════════════════════════════════════════ */
function StatsSection() {
  const [range,        setRange]        = useState("7d");
  const [useSnapshots, setUseSnapshots] = useState(false);
  const [stats,        setStats]        = useState(null);
  const [live,         setLive]         = useState(false);
  const [error,        setError]        = useState("");
  const [showAdvanced, setShowAdvanced] = useState(SHOW_ADVANCED_DEFAULT);

  const esRef   = useRef(null);
  const pollRef = useRef(null);
  const adminSecret = useMemo(() => sessionStorage.getItem("ADMIN_SECRET") || "", []);

  /* ── fetch ── */
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

  /* ── SSE ── */
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
      es.onopen    = () => { setLive(true); setError(""); };
      es.onerror   = () => { setLive(false); startPoll(); };
    } catch { startPoll(); }

    return () => {
      esRef.current?.close();
      pollRef.current && clearInterval(pollRef.current);
      esRef.current = pollRef.current = null;
    };
  }, [range, adminSecret, useSnapshots]); // eslint-disable-line

  const data   = stats?.seriesByDay || [];
  const totals = stats?.totals || {};
  const conv   = totals.ordersAll ? Math.round((totals.ordersPaid / totals.ordersAll) * 100) : 0;

  return (
    <div className="st-wrap">

      {/* ── HEAD ── */}
      <div className="st-head">
        <div className="st-head-left">
          <h2 className="st-title">Estadísticas</h2>
          {!useSnapshots && <LivePill live={live} />}
        </div>
        <div className="st-head-right">
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </div>

      {/* ── CONTROLES ── */}
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
          <button
            className="st-adv-btn"
            onClick={() => setShowAdvanced((s) => !s)}
            type="button"
          >
            {showAdvanced ? "Ocultar avanzado" : "⚙️ Avanzado"}
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="st-adv-bar">
          <StatsAdminControls onAfterAction={() => refetchSummary(range, true)} />
        </div>
      )}

      {/* ── BANNERS ── */}
      {!adminSecret && (
        <div className="st-banner st-banner--info">
          Necesitás iniciar sesión en <b>Órdenes</b> para guardar el <code>ADMIN_SECRET</code>.{" "}
          <Link to="/orders">Ir a Órdenes →</Link>
        </div>
      )}
      {error && <div className="st-banner st-banner--err">{error}</div>}

      {/* ── KPIs ── */}
      <div className="st-kpis">
        <KPICard icon="💰" label="Ingresos pagados"
          value={stats ? moneyShort(totals.paidRevenue) : "…"}
          sub={stats ? money(totals.paidRevenue) : "cargando…"}
          accent="#D4537E" bg="#FBEAF0"
        />
        <KPICard icon="✅" label="Órdenes pagadas"
          value={stats ? String(totals.ordersPaid ?? 0) : "…"}
          sub={`de ${totals.ordersAll ?? 0} totales`}
          accent="#1D9E75" bg="#E1F5EE"
        />
        <KPICard icon="📊" label="Conversión"
          value={stats ? `${conv}%` : "…"}
          sub="pagadas / totales"
          accent="#534AB7" bg="#EEEDFE"
        />
        <KPICard icon="🎯" label="Ticket promedio"
          value={stats ? moneyShort(totals.aov) : "…"}
          sub={stats ? money(totals.aov) : "cargando…"}
          accent="#BA7517" bg="#FAEEDA"
        />
      </div>

      {/* ── GRÁFICOS ── */}
      <div className="st-charts">
        {/* Ingresos */}
        <div className="st-chart-card">
          <p className="st-chart-title">Ingresos por día</p>
          <p className="st-chart-sub">Ventas confirmadas en ARS</p>
          <AreaChart data={data} />
        </div>

        {/* Órdenes */}
        <div className="st-chart-card">
          <div className="st-chart-head">
            <div>
              <p className="st-chart-title">Órdenes por día</p>
              <p className="st-chart-sub">Pagadas vs. totales</p>
            </div>
            <div className="st-legend">
              <span><i style={{ background: "#D4537E" }} />Pagadas</span>
              <span><i style={{ background: "#F4C0D1" }} />Totales</span>
            </div>
          </div>
          <BarChart data={data} />
        </div>
      </div>

      {/* ── TABLA SEMANAL ── */}
      <div className="st-table-card">
        <div className="st-table-head">
          <div>
            <p className="st-chart-title">Resumen semanal</p>
            <p className="st-chart-sub">Últimos 7 días · órdenes pagadas</p>
          </div>
          {stats && (
            <span className="st-range-chip">{stats.from} → {stats.to}</span>
          )}
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
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
              {data.slice(-7).map((row, i) => (
                <tr key={row.date} className={i % 2 ? "st-tr-alt" : ""}>
                  <td><b>{fmtDay(row.date)}</b></td>
                  <td>
                    <span className="st-badge">{row.ordersPaid}</span>
                  </td>
                  <td style={{ color: "#888780" }}>{row.ordersAll}</td>
                  <td className="st-td-money">{money(row.paidRevenue)}</td>
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#888780", padding: "20px 0" }}>
                    Sin datos para este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="st-foot">Actualizado: {fmtDT(stats?.generatedAt)}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   CHART COMPONENTS
══════════════════════════════════════════ */
function AreaChart({ data }) {
  const ref  = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      inst.current?.destroy();
      inst.current = new window.Chart(ref.current, {
        type: "line",
        data: {
          labels: data.map((d) => fmtDay(d.date)),
          datasets: [{
            label: "Ingresos",
            data: data.map((d) => d.paidRevenue),
            borderColor: "#D4537E",
            borderWidth: 2.5,
            pointBackgroundColor: "#D4537E",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: data.length > 20 ? 0 : 3,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: (ctx) => {
              const { chartArea, ctx: c } = ctx.chart;
              if (!chartArea) return "rgba(212,83,126,.15)";
              const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, "rgba(212,83,126,.22)");
              g.addColorStop(1, "rgba(212,83,126,0)");
              return g;
            },
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#fff",
              titleColor: "#2C2C2A",
              bodyColor: "#D4537E",
              borderColor: "#F4D6E8",
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              callbacks: { label: (ctx) => `  ${money(ctx.parsed.y)}` },
            },
          },
          scales: {
            x: {
              grid: { color: "rgba(0,0,0,.04)" },
              ticks: { color: "#888780", font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 },
            },
            y: {
              grid: { color: "rgba(0,0,0,.04)" },
              ticks: { color: "#888780", font: { size: 10 }, callback: (v) => moneyShort(v) },
              beginAtZero: true,
            },
          },
        },
      });
    });
    return () => { inst.current?.destroy(); inst.current = null; };
  }, [data]);

  return (
    <div style={{ position: "relative", height: 210 }}>
      <canvas ref={ref} />
      {!data.length && <ChartEmpty />}
    </div>
  );
}

function BarChart({ data }) {
  const ref  = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      inst.current?.destroy();
      inst.current = new window.Chart(ref.current, {
        type: "bar",
        data: {
          labels: data.map((d) => fmtDay(d.date)),
          datasets: [
            {
              label: "Pagadas",
              data: data.map((d) => d.ordersPaid),
              backgroundColor: "#D4537E",
              borderRadius: 5,
              borderSkipped: false,
              barPercentage: 0.65,
              categoryPercentage: 0.8,
            },
            {
              label: "Totales",
              data: data.map((d) => d.ordersAll),
              backgroundColor: "#F4C0D1",
              borderRadius: 5,
              borderSkipped: false,
              barPercentage: 0.65,
              categoryPercentage: 0.8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#fff",
              titleColor: "#2C2C2A",
              bodyColor: "#2C2C2A",
              borderColor: "#F4D6E8",
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#888780", font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 },
            },
            y: {
              grid: { color: "rgba(0,0,0,.04)" },
              ticks: { color: "#888780", font: { size: 10 }, stepSize: 1 },
              beginAtZero: true,
            },
          },
        },
      });
    });
    return () => { inst.current?.destroy(); inst.current = null; };
  }, [data]);

  return (
    <div style={{ position: "relative", height: 210 }}>
      <canvas ref={ref} />
      {!data.length && <ChartEmpty />}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, color: "#888780",
    }}>
      Sin datos para este período
    </div>
  );
}

/* ══════════════════════════════════════════
   UI HELPERS
══════════════════════════════════════════ */
function LivePill({ live }) {
  return (
    <div className={`st-live-pill ${live ? "on" : ""}`}>
      <span className="st-live-dot" />
      {live ? "En vivo" : "Offline"}
    </div>
  );
}

function RangeTabs({ value, onChange }) {
  const opts = [
    { v: "7d",  l: "7d"  },
    { v: "30d", l: "30d" },
    { v: "12w", l: "12s" },
  ];
  return (
    <div className="st-range-tabs">
      {opts.map(({ v, l }) => (
        <button
          key={v}
          className={`st-range-btn ${value === v ? "active" : ""}`}
          onClick={() => onChange(v)}
          type="button"
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   CUENTA — Cambiar contraseña
══════════════════════════════════════════ */
function CuentaSection() {
  const { changePassword, user } = useAuth();
  const [form, setForm]   = useState({ actual: "", nueva: "", repetir: "" });
  const [msg, setMsg]     = useState({ text: "", ok: false });
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
      setMsg({ text: "✅ Contraseña actualizada correctamente.", ok: true });
      setForm({ actual: "", nueva: "", repetir: "" });
    } catch (err) {
      setMsg({ text: err?.message || "Error al cambiar contraseña.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "8px 0" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 }}>Mi cuenta</h2>
      {user && (
        <p style={{ fontSize: ".85rem", color: "var(--adm-muted)", marginBottom: 20 }}>
          Usuario: <strong>{user.username}</strong> · Rol: <strong>{user.role}</strong>
        </p>
      )}

      <div className="card">
        <p className="card-title">Cambiar contraseña</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {msg.text && (
            <div className="st-banner" style={{
              background: msg.ok ? "var(--adm-success-soft)" : "var(--adm-danger-soft)",
              color:      msg.ok ? "#065f46"                 : "#991b1b",
              borderColor: msg.ok ? "#6ee7b7"               : "#fca5a5",
              marginBottom: 0,
            }}>
              {msg.text}
            </div>
          )}
          <input
            className="adm-input"
            type="password"
            placeholder="Contraseña actual"
            autoComplete="current-password"
            value={form.actual}
            onChange={(e) => setForm({ ...form, actual: e.target.value })}
            required
          />
          <input
            className="adm-input"
            type="password"
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            autoComplete="new-password"
            value={form.nueva}
            onChange={(e) => setForm({ ...form, nueva: e.target.value })}
            required
          />
          <input
            className="adm-input"
            type="password"
            placeholder="Repetir nueva contraseña"
            autoComplete="new-password"
            value={form.repetir}
            onChange={(e) => setForm({ ...form, repetir: e.target.value })}
            required
          />
          <button className="adm-btn-brand" disabled={loading} type="submit">
            {loading ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   USUARIOS — Gestión de vendedores
══════════════════════════════════════════ */
function UsuariosSection() {
  const { getUsers, createUser, updateUser, deleteUser, user: me } = useAuth();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
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

  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar usuario "${u.username}"?`)) return;
    try { await deleteUser(u._id); await load(); }
    catch (err) { setMsg(err.message); }
  };

  const togglePerm = (key) =>
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));

  const PERMS = [
    { key: "verEstadisticas",  label: "Ver estadísticas" },
    { key: "verOrdenes",       label: "Ver órdenes"      },
    { key: "editarCategorias", label: "Editar categorías"},
    { key: "crearProductos",   label: "Crear productos"  },
    { key: "editarStockSolo",  label: "Solo editar stock"},
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Gestión de usuarios</h2>
        <button className="adm-btn-brand" onClick={() => { resetForm(); setShowForm(true); }} type="button">
          + Nuevo usuario
        </button>
      </div>

      {msg && (
        <div className="st-banner st-banner--err" style={{ marginBottom: 12 }}>{msg}</div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="card-title">{editTarget ? `Editar: ${editTarget.username}` : "Nuevo usuario"}</p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!editTarget && (
              <input
                className="adm-input"
                placeholder="Usuario (ej: vendedora1)"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            )}
            <input
              className="adm-input"
              placeholder="Nombre visible"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="adm-input"
              type="password"
              placeholder={editTarget ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña (mín. 8 caracteres)"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              {...(!editTarget && { required: true })}
            />
            <select
              className="adm-input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Admin</option>
            </select>

            <p style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--adm-muted)", margin: "4px 0 2px" }}>
              Permisos
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PERMS.map(({ key, label }) => (
                <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".82rem", cursor: "pointer", color: "var(--adm-ink-2)" }}>
                  <input
                    type="checkbox"
                    checked={!!form.permissions[key]}
                    onChange={() => togglePerm(key)}
                    style={{ accentColor: "var(--adm-brand)" }}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="adm-btn-brand" disabled={saving} type="submit" style={{ flex: 1 }}>
                {saving ? "Guardando…" : editTarget ? "Guardar cambios" : "Crear usuario"}
              </button>
              <button className="btn-outline" onClick={resetForm} type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ color: "var(--adm-muted)", fontSize: ".9rem" }}>Cargando usuarios…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => (
            <div key={u._id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: ".9rem" }}>
                  {u.name || u.username}
                  {u._id === me?._id && <span style={{ marginLeft: 6, fontSize: ".7rem", background: "var(--adm-brand-soft)", color: "var(--adm-brand)", borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>Vos</span>}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: ".78rem", color: "var(--adm-muted)" }}>
                  @{u.username} · {u.role} · {u.active ? "✅ activo" : "❌ inactivo"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn-outline" onClick={() => startEdit(u)} type="button" style={{ fontSize: ".8rem", padding: "0.4rem 0.8rem" }}>
                  Editar
                </button>
                {u._id !== me?._id && (
                  <button
                    onClick={() => handleDelete(u)}
                    type="button"
                    style={{ fontSize: ".8rem", padding: "0.4rem 0.8rem", border: "1px solid var(--adm-danger)", color: "var(--adm-danger)", background: "var(--adm-danger-soft)", borderRadius: "var(--adm-r-md)", cursor: "pointer", fontWeight: 600 }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
          {!users.length && <p style={{ color: "var(--adm-muted)", fontSize: ".9rem" }}>No hay usuarios.</p>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   SOLICITAR PERMISO — para vendedores sin acceso
══════════════════════════════════════════ */
function SolicitarPermisoSection({ permiso }) {
  const { user, token } = useAuth();
  const [estado, setEstado] = useState("idle"); // idle | loading | ok | err
  const [msg, setMsg] = useState("");

  const LABELS = {
    editarCategorias: "Editar categorías",
    crearProductos:   "Crear productos",
    verEstadisticas:  "Ver estadísticas",
    verOrdenes:       "Ver órdenes",
    editarStockSolo:  "Editar stock",
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
      setMsg("✅ Solicitud enviada. La administradora recibirá un email para aprobarte.");
    } catch (err) {
      setEstado("err");
      setMsg(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", textAlign: "center", padding: "0 16px" }}>
      <div style={{ fontSize: "3rem", marginBottom: 12 }}>🔒</div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>
        Sin acceso a "{LABELS[permiso] || permiso}"
      </h3>
      <p style={{ color: "var(--adm-muted)", fontSize: ".88rem", marginBottom: 20 }}>
        No tenés permiso para esta sección. Podés enviarle una solicitud a la administradora para que te lo habilite.
      </p>
      {msg && (
        <div className="st-banner" style={{
          background: estado === "ok" ? "var(--adm-success-soft)" : "var(--adm-danger-soft)",
          color: estado === "ok" ? "#065f46" : "#991b1b",
          borderColor: estado === "ok" ? "#6ee7b7" : "#fca5a5",
          marginBottom: 16,
        }}>
          {msg}
        </div>
      )}
      {estado !== "ok" && (
        <button
          className="adm-btn-brand"
          onClick={enviarSolicitud}
          disabled={estado === "loading"}
          type="button"
        >
          {estado === "loading" ? "Enviando…" : "Solicitar permiso"}
        </button>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, sub, accent, bg }) {
  return (
    <div className="st-kpi">
      <div className="st-kpi-top">
        <span className="st-kpi-icon" style={{ background: bg }}>{icon}</span>
        <span className="st-kpi-label">{label}</span>
      </div>
      <div className="st-kpi-value" style={{ color: accent }}>{value}</div>
      <div className="st-kpi-sub">{sub}</div>
    </div>
  );
}