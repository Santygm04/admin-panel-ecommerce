import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ProductList from "../../src/components/ProductList";
import ProductForm from "../../src/components/ProductForm";
import StatsAdminControls from "../../src/components/StatsAdminControls";
import "../../src/components/DashBoard.css";

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
  const [vista, setVista] = useState("stock");
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
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("ADMIN_SECRET");
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
          <TabBtn id="stock"       icon="📦" label="Ver stock"     />
          <TabBtn id="crear"       icon="⬆️" label="Subir producto"/>
          <TabBtn id="estadisticas"icon="📈" label="Estadísticas"  />
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
        {vista === "crear"        && <ProductForm />}
        {vista === "estadisticas" && <StatsSection />}
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