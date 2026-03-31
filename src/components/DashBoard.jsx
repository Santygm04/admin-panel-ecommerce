import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ProductList from "../../src/components/ProductList";
import ProductForm from "../../src/components/ProductForm";
import "../../src/components/DashBoard.css";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import StatsAdminControls from "../../src/components/StatsAdminControls";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const SHOW_ADVANCED_DEFAULT =
  String(import.meta.env.VITE_STATS_SHOW_ADVANCED ?? "true").toLowerCase() === "true";

export default function DashBoard() {
  const [vista, setVista] = useState("stock");

  const adminSecret = useMemo(() => sessionStorage.getItem("ADMIN_SECRET") || "", []);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!adminSecret) return;

    let abort = false;

    const fetchCount = async () => {
      try {
        const url = new URL(`${API_URL}/api/payments/orders`);
        url.searchParams.set("status", "pending");

        const res = await fetch(url, {
          headers: { "x-admin-secret": adminSecret },
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.message || "Error");
        if (!abort) setPendingCount((data.orders || []).length);
      } catch {
        if (!abort) setPendingCount(0);
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, 10000);

    return () => {
      abort = true;
      clearInterval(id);
    };
  }, [adminSecret]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("ADMIN_SECRET");
    window.location.href = "/login";
  };

  const TabBtn = ({ id, icon, label }) => (
    <button
      className={`tab-btn ${vista === id ? "active" : ""}`}
      onClick={() => setVista(id)}
      type="button"
      aria-pressed={vista === id}
    >
      <span className="tab-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="dash">
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

      <div className="dash-row">
        <nav className="dash-tabs" role="tablist" aria-label="Secciones del panel">
          <TabBtn id="stock" icon="📦" label="Ver stock" />
          <TabBtn id="crear" icon="⬆️" label="Subir producto" />
          <TabBtn id="estadisticas" icon="📈" label="Estadísticas" />
        </nav>

        <Link to="/orders" className="tab-btn tab-cta orders-link" title="Órdenes de compra">
          <span className="tab-icon" aria-hidden="true">
            🧾
          </span>
          <span>Órdenes</span>
          {adminSecret && pendingCount > 0 && (
            <span className="notif-badge" aria-label={`${pendingCount} pendientes`}>
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      <main className="dash-content" role="tabpanel">
        {vista === "stock" && <ProductList />}
        {vista === "crear" && <ProductForm />}
        {vista === "estadisticas" && <StatsSection />}
      </main>
    </div>
  );
}

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

  async function refetchSummary(currentRange = range, snapshots = useSnapshots) {
    if (!adminSecret) return;

    const base = snapshots
      ? "/api/payments/stats/snapshot/summary"
      : "/api/payments/stats/summary";

    try {
      setError("");
      const r = await fetch(`${API_URL}${base}?range=${currentRange}`, {
        headers: { "x-admin-secret": adminSecret },
      });
      const d = await r.json();

      if (!r.ok) {
        setError(d?.message || "No autorizado o error en estadísticas");
        setStats(null);
        return;
      }

      setStats(d);
    } catch {
      setError("No se pudieron cargar estadísticas");
    }
  }

  useEffect(() => {
    refetchSummary(range, useSnapshots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, adminSecret, useSnapshots]);

  useEffect(() => {
    if (!adminSecret) return;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    setLive(false);

    if (useSnapshots) return;

    const enc = encodeURIComponent(adminSecret);
    const url = `${API_URL}/api/payments/stats/stream?range=${range}&admin_secret=${enc}`;

    try {
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        setLive(true);
        setError("");
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };

      const onMsg = (e) => {
        try {
          const data = JSON.parse(e.data);
          setStats(data);
          setLive(true);
          setError("");
        } catch {
          //
        }
      };

      es.addEventListener("stats", onMsg);
      es.onmessage = onMsg;

      es.onerror = () => {
        setLive(false);
        if (!pollRef.current) {
          pollRef.current = setInterval(() => refetchSummary(range, false), 30000);
        }
      };
    } catch {
      pollRef.current = setInterval(() => refetchSummary(range, false), 30000);
    }

    return () => {
      if (esRef.current) esRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
      esRef.current = null;
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, adminSecret, useSnapshots]);

  const data = stats?.seriesByDay || [];

  return (
    <section className="card">
      <div className="stats-head">
        <div className="stats-title">
          <span className="emoji" aria-hidden>
            📈
          </span>
          <h2 className="card-title">Estadísticas</h2>
          {!useSnapshots && <LiveDot live={live} />}
        </div>

        <div className="stats-controls">
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="12w">Últimas 12 semanas</option>
          </select>

          <label>
            <input
              type="checkbox"
              checked={useSnapshots}
              onChange={(e) => setUseSnapshots(e.target.checked)}
            />
            Usar snapshots históricos
          </label>

          {SHOW_ADVANCED_DEFAULT && (
            <button className="tab-btn" onClick={() => setShowAdvanced((s) => !s)} type="button">
              {showAdvanced ? "Ocultar avanzado" : "⚙️ Avanzado"}
            </button>
          )}

          {showAdvanced && (
            <div className="stats-admin-bar">
              <StatsAdminControls onAfterAction={() => refetchSummary(range, true)} />
            </div>
          )}
        </div>
      </div>

      {!adminSecret && (
        <div className="banner" style={{ marginBottom: 12 }}>
          Necesitás iniciar sesión en <b>Órdenes</b> para guardar el <code>ADMIN_SECRET</code>.{" "}
          <Link to="/orders">Ir a Órdenes</Link>
        </div>
      )}

      {error && (
        <div
          className="banner"
          style={{
            marginBottom: 12,
            background: "#fef2f2",
            color: "#991b1b",
            borderColor: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      <div className="kpi-grid">
        <KPI label="Ingresos (pagado)" value={money(stats?.totals?.paidRevenue)} />
        <KPI label="Órdenes pagadas" value={stats?.totals?.ordersPaid ?? 0} />
        <KPI label="Órdenes totales" value={stats?.totals?.ordersAll ?? 0} />
        <KPI label="Ticket promedio" value={money(stats?.totals?.aov ?? 0)} />
      </div>

      <div className="charts">
        <div className="chart-card">
          <h3>Ingresos por día</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopOpacity={0.35} />
                  <stop offset="95%" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={42} />
              <Tooltip formatter={(v) => money(v)} />
              <Area
                type="monotone"
                dataKey="paidRevenue"
                name="Ingresos"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradRev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Órdenes por día</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={42} />
              <Tooltip />
              <Bar dataKey="ordersPaid" name="Pagadas" />
              <Bar dataKey="ordersAll" name="Totales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="ventas-card">
        <h3>Ventas semanales</h3>
        <p className="muted">Resumen de los últimos 7 días (pagado).</p>

        <div className="ventas-table-wrap">
          <table className="ventas-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Órdenes</th>
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(-7).map((d) => (
                <tr key={d.date}>
                  <td>{formatDay(d.date)}</td>
                  <td>{d.ordersPaid}</td>
                  <td>{money(d.paidRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="stats-foot">
          Rango: <b>{stats?.from}</b> → <b>{stats?.to}</b> • Actualizado:{" "}
          {formatDateTime(stats?.generatedAt)}
        </p>
      </div>
    </section>
  );
}

function KPI({ label, value }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}

function LiveDot({ live }) {
  return (
    <span
      className={`live-dot ${live ? "on" : ""}`}
      title={live ? "En vivo" : "Reconectando…"}
    />
  );
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR");
}

function formatDay(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd || "").split("-").map(Number);
  if (!y || !m || !d) return "—";
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}