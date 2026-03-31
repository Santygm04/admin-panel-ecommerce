import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/* ─── helpers de formato ─── */
const money = (n) =>
  Number(n || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const moneyCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
};

const formatDay = (s) => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  if (!y) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR");
};

/* ─── Chart.js loader singleton ─── */
let cjsReady = false;
let cjsCbs = [];
function loadCjs(cb) {
  if (cjsReady) return cb();
  cjsCbs.push(cb);
  if (cjsCbs.length > 1) return;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
  s.onload = () => { cjsReady = true; cjsCbs.forEach((f) => f()); cjsCbs = []; };
  document.head.appendChild(s);
}

/* ─── Paleta brand ─── */
const C = {
  brand:      "#D4537E",
  brandLight: "#F4C0D1",
  brandBg:    "#FBEAF0",
  brandDark:  "#72243E",
  teal:       "#1D9E75",
  tealBg:     "#E1F5EE",
  purple:     "#534AB7",
  purpleBg:   "#EEEDFE",
  amber:      "#BA7517",
  amberBg:    "#FAEEDA",
  gray:       "#888780",
  grayLight:  "#F1EFE8",
  border:     "#F4D6E8",
  ink:        "#2C2C2A",
};

/* ════════════════════════════════════════
   EXPORT PRINCIPAL
════════════════════════════════════════ */
export default function AdminStats() {
  const [range, setRange] = useState("7d");
  const [stats, setStats] = useState(null);
  const [live,  setLive]  = useState(false);
  const [error, setError] = useState("");
  const esRef   = useRef(null);
  const pollRef = useRef(null);
  const adminSecret = useMemo(() => sessionStorage.getItem("ADMIN_SECRET") || "", []);

  /* fetch inicial */
  useEffect(() => {
    if (!adminSecret) return;
    setError("");
    fetch(`${API_URL}/api/payments/stats/summary?range=${range}`, {
      headers: { "x-admin-secret": adminSecret },
    })
      .then((r) => r.json())
      .then((d) => { if (d?.totals) setStats(d); else setError(d?.message || "Sin datos"); })
      .catch(() => setError("No se pudieron cargar estadísticas"));
  }, [range, adminSecret]);

  /* SSE + polling */
  useEffect(() => {
    if (!adminSecret) return;
    esRef.current?.close();
    pollRef.current && clearInterval(pollRef.current);
    esRef.current = pollRef.current = null;
    setLive(false);

    const enc = encodeURIComponent(adminSecret);
    const url = `${API_URL}/api/payments/stats/stream?range=${range}&admin_secret=${enc}`;
    const poll = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        fetch(`${API_URL}/api/payments/stats/summary?range=${range}`, {
          headers: { "x-admin-secret": adminSecret },
        }).then((r) => r.json()).then((d) => { if (d?.totals) setStats(d); }).catch(() => {});
      }, 25000);
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
      es.onerror   = () => { setLive(false); poll(); };
    } catch { poll(); }

    return () => {
      esRef.current?.close();
      pollRef.current && clearInterval(pollRef.current);
      esRef.current = pollRef.current = null;
    };
  }, [range, adminSecret]);

  const data    = stats?.seriesByDay || [];
  const totals  = stats?.totals || {};
  const conv    = totals.ordersAll ? Math.round((totals.ordersPaid / totals.ordersAll) * 100) : 0;

  /* sin auth */
  if (!adminSecret) return (
    <div style={S.wrap}>
      <div style={S.emptyWrap}>
        <div style={S.emptyIcon}>📊</div>
        <p style={S.emptyTitle}>Panel de estadísticas</p>
        <p style={S.emptyText}>Iniciá sesión en <b>Órdenes</b> para ver las métricas.</p>
      </div>
    </div>
  );

  return (
    <div style={S.wrap}>

      {/* ── HEAD ── */}
      <div style={S.head}>
        <div style={S.headLeft}>
          <span style={S.headIcon}>📈</span>
          <h2 style={S.h2}>Estadísticas</h2>
          <LivePill live={live} />
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {/* ── KPIs ── */}
      <div style={S.kpiRow} data-astat-kpi="1">
        <KPI icon="💰" label="Ingresos pagados"  value={stats ? moneyCompact(totals.paidRevenue) : "…"} sub={stats ? money(totals.paidRevenue) : "cargando"} accent={C.brand}  bg={C.brandBg} />
        <KPI icon="✅" label="Órdenes pagadas"   value={stats ? String(totals.ordersPaid ?? 0) : "…"}  sub={`de ${totals.ordersAll ?? 0} totales`}            accent={C.teal}   bg={C.tealBg} />
        <KPI icon="📦" label="Conversión"        value={stats ? `${conv}%` : "…"}                      sub="pagadas / totales"                                accent={C.purple} bg={C.purpleBg} />
        <KPI icon="🎯" label="Ticket promedio"   value={stats ? moneyCompact(totals.aov) : "…"}         sub={stats ? money(totals.aov) : "cargando"}           accent={C.amber}  bg={C.amberBg} />
      </div>

      {/* ── CHARTS ── */}
      <div style={S.chartRow} data-astat-chart="1">
        <ChartCard title="Ingresos por día" sub="Ventas confirmadas en ARS">
          <AreaChart data={data} />
        </ChartCard>
        <ChartCard title="Órdenes por día" sub="Pagadas vs. totales"
          legend={[
            { color: C.brand,      label: "Pagadas" },
            { color: C.brandLight, label: "Totales" },
          ]}
        >
          <BarChart data={data} />
        </ChartCard>
      </div>

      {/* ── TABLE ── */}
      <div style={S.tableCard}>
        <div style={S.tableTopRow}>
          <div>
            <p style={S.tableTitle}>Resumen semanal</p>
            <p style={S.tableSub}>Últimos 7 días · órdenes pagadas</p>
          </div>
          {stats && (
            <span style={S.rangeChip}>{stats.from} → {stats.to}</span>
          )}
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["Fecha", "Pagadas", "Totales", "Ingresos"].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(-7).map((row, i) => (
                <tr key={row.date} style={{ background: i % 2 ? "rgba(244,214,232,.06)" : "transparent" }}>
                  <td style={S.td}><b>{formatDay(row.date)}</b></td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <span style={{ ...S.badge, background: C.brandBg, color: C.brandDark }}>{row.ordersPaid}</span>
                  </td>
                  <td style={{ ...S.td, textAlign: "right", color: C.gray }}>{row.ordersAll}</td>
                  <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: C.brand }}>{money(row.paidRevenue)}</td>
                </tr>
              ))}
              {!data.length && (
                <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: C.gray }}>Sin datos para este período</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={S.tableFoot}>Actualizado: {formatDateTime(stats?.generatedAt)}</p>
      </div>

    </div>
  );
}

/* ════════════════════════════════════════
   SUB-COMPONENTES
════════════════════════════════════════ */

function LivePill({ live }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: live ? C.tealBg  : C.grayLight,
      color:      live ? "#0F6E56" : C.gray,
      border:     `1px solid ${live ? "#9FE1CB" : "#D3D1C7"}`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: live ? C.teal : C.gray,
        animation: live ? "lp 1.5s infinite" : "none",
      }} />
      {live ? "En vivo" : "Offline"}
      <style>{`@keyframes lp{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
    </div>
  );
}

function RangeTabs({ value, onChange }) {
  const opts = [{ v: "7d", l: "7d" }, { v: "30d", l: "30d" }, { v: "12w", l: "12s" }];
  return (
    <div style={{ display: "flex", background: C.grayLight, borderRadius: 10, padding: 3, gap: 3 }}>
      {opts.map(({ v, l }) => (
        <button key={v} onClick={() => onChange(v)} style={{
          border: "none", cursor: "pointer", borderRadius: 7,
          padding: "5px 13px", fontSize: 12, fontWeight: 800,
          background: value === v ? "#fff" : "transparent",
          color: value === v ? C.brand : C.gray,
          boxShadow: value === v ? "0 1px 4px rgba(0,0,0,.1)" : "none",
          transition: ".12s",
        }}>{l}</button>
      ))}
    </div>
  );
}

function KPI({ icon, label, value, sub, accent, bg }) {
  return (
    <div style={S.kpi}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: "grid", placeItems: "center", fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: "-0.5px", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.gray }}>{sub}</div>
    </div>
  );
}

function ChartCard({ title, sub, legend, children }) {
  return (
    <div style={S.chartCard}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.ink }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.gray }}>{sub}</p>
        </div>
        {legend && (
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.gray, flexShrink: 0 }}>
            {legend.map((l) => (
              <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function AreaChart({ data }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    loadCjs(() => {
      if (!canvasRef.current) return;
      chartRef.current?.destroy();

      chartRef.current = new window.Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: data.map((d) => formatDay(d.date)),
          datasets: [{
            label: "Ingresos",
            data: data.map((d) => d.paidRevenue),
            borderColor: C.brand,
            borderWidth: 2.5,
            pointBackgroundColor: C.brand,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: data.length > 20 ? 0 : 3,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: (ctx) => {
              const { chartArea, ctx: c } = ctx.chart;
              if (!chartArea) return "rgba(212,83,126,.15)";
              const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0,   "rgba(212,83,126,.22)");
              g.addColorStop(1,   "rgba(212,83,126,0)");
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
              titleColor: C.ink,
              bodyColor: C.brand,
              borderColor: C.border,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              callbacks: { label: (ctx) => `  ${money(ctx.parsed.y)}` },
            },
          },
          scales: {
            x: { grid: { color: "rgba(0,0,0,.04)" }, ticks: { color: C.gray, font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 } },
            y: {
              grid: { color: "rgba(0,0,0,.04)" },
              ticks: { color: C.gray, font: { size: 10 }, callback: (v) => moneyCompact(v) },
              beginAtZero: true,
            },
          },
        },
      });
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  return (
    <div style={{ position: "relative", height: 200 }}>
      <canvas ref={canvasRef} />
      {!data.length && <EmptyChart />}
    </div>
  );
}

function BarChart({ data }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    loadCjs(() => {
      if (!canvasRef.current) return;
      chartRef.current?.destroy();

      chartRef.current = new window.Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => formatDay(d.date)),
          datasets: [
            {
              label: "Pagadas",
              data: data.map((d) => d.ordersPaid),
              backgroundColor: C.brand,
              borderRadius: 5,
              borderSkipped: false,
              barPercentage: 0.65,
              categoryPercentage: 0.8,
            },
            {
              label: "Totales",
              data: data.map((d) => d.ordersAll),
              backgroundColor: C.brandLight,
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
              titleColor: C.ink,
              bodyColor: C.ink,
              borderColor: C.border,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: C.gray, font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 } },
            y: {
              grid: { color: "rgba(0,0,0,.04)" },
              ticks: { color: C.gray, font: { size: 10 }, stepSize: 1 },
              beginAtZero: true,
            },
          },
        },
      });
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  return (
    <div style={{ position: "relative", height: 200 }}>
      <canvas ref={canvasRef} />
      {!data.length && <EmptyChart />}
    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, color: C.gray,
    }}>Sin datos para este período</div>
  );
}

/* ════════════════════════════════════════
   ESTILOS
════════════════════════════════════════ */
const S = {
  wrap: {
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    padding: "2px 0 12px",
    color: C.ink,
  },
  head: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 10, marginBottom: 18,
  },
  headLeft:  { display: "flex", alignItems: "center", gap: 10 },
  headIcon:  { fontSize: 18 },
  h2: { margin: 0, fontSize: 17, fontWeight: 900, color: C.ink },

  errorBanner: {
    background: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F",
    borderRadius: 10, padding: "8px 12px", fontSize: 12, marginBottom: 14,
  },

  /* KPIs: 2 col en móvil, 4 col en desktop via @container / media */
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10, marginBottom: 12,
  },
  kpi: {
    background: "#fff",
    border: `1.5px solid ${C.border}`,
    borderRadius: 14, padding: "14px",
    boxShadow: "0 2px 8px rgba(0,0,0,.04)",
  },

  /* Charts: 1 col en móvil */
  chartRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10, marginBottom: 12,
  },
  chartCard: {
    background: "#fff",
    border: `1.5px solid ${C.border}`,
    borderRadius: 14, padding: "16px 14px",
    boxShadow: "0 2px 8px rgba(0,0,0,.04)",
  },

  tableCard: {
    background: "#fff",
    border: `1.5px solid ${C.border}`,
    borderRadius: 14, padding: "16px 14px",
    boxShadow: "0 2px 8px rgba(0,0,0,.04)",
  },
  tableTopRow: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between", flexWrap: "wrap",
    gap: 8, marginBottom: 12,
  },
  tableTitle: { margin: 0, fontSize: 13, fontWeight: 700, color: C.ink },
  tableSub:   { margin: "2px 0 0", fontSize: 11, color: C.gray },
  rangeChip: {
    fontSize: 11, color: C.gray,
    background: C.grayLight, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 300 },
  th: {
    padding: "7px 10px", textAlign: "left",
    color: C.gray, fontWeight: 700, fontSize: 11,
    borderBottom: `1.5px solid ${C.border}`, whiteSpace: "nowrap",
  },
  td: { padding: "9px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.ink },
  badge: {
    display: "inline-block", padding: "2px 8px",
    borderRadius: 999, fontSize: 11, fontWeight: 800,
  },
  tableFoot: { margin: "10px 0 0", fontSize: 11, color: C.gray, textAlign: "right" },

  emptyWrap:  { display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 10 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 15, fontWeight: 800, color: C.ink, margin: 0 },
  emptyText:  { fontSize: 13, color: C.gray, textAlign: "center", margin: 0 },
};

/* ─── Media query: 2 col charts y 4 col KPIs en pantallas grandes ─── */
if (typeof window !== "undefined") {
  const styleId = "__astat-mq";
  if (!document.getElementById(styleId)) {
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `
      @media (min-width: 900px) {
        [data-astat-kpi]   { grid-template-columns: repeat(4,1fr) !important; }
        [data-astat-chart] { grid-template-columns: 1fr 1fr !important; }
      }
    `;
    document.head.appendChild(el);
  }
}