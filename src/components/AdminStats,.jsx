import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function AdminStats() {
  const [range, setRange] = useState("7d"); // 7d | 30d | 12w
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState(false);
  const esRef = useRef(null);
  const pollRef = useRef(null);

  const adminSecret = useMemo(() => sessionStorage.getItem("ADMIN_SECRET") || "", []);

  // 1) Primer fetch
  useEffect(() => {
    if (!adminSecret) return;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/payments/stats/summary?range=${range}`, {
          headers: { "x-admin-secret": adminSecret },
        });
        const d = await r.json();
        setStats(d);
      } catch (e) {
        // opcional: console.error(e);
      }
    })();
  }, [range, adminSecret]);

  // 2) SSE en tiempo real + fallback a polling
  useEffect(() => {
    if (!adminSecret) return;

    // limpiar anteriores
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    // Enviamos ambos nombres por compat: ?secret= y ?admin_secret=
    const enc = encodeURIComponent(adminSecret);
    const url = `${API_URL}/api/payments/stats/stream?range=${range}&secret=${enc}&admin_secret=${enc}`;
    let es;

    try {
      es = new EventSource(url);
      esRef.current = es;

      const onMsg = (e) => {
        try {
          const data = JSON.parse(e.data || "{}");
          setStats(data);
          setLive(true);
        } catch {
          /* noop */
        }
      };

      es.addEventListener("stats", onMsg);
      es.onmessage = onMsg;
      es.onerror = () => {
        setLive(false);
        // Polling cada 25s si se corta
        if (!pollRef.current) {
          pollRef.current = setInterval(async () => {
            try {
              const r = await fetch(`${API_URL}/api/payments/stats/summary?range=${range}`, {
                headers: { "x-admin-secret": adminSecret },
              });
              const d = await r.json();
              setStats(d);
            } catch {}
          }, 25000);
        }
      };
    } catch {
      // Navegadores sin SSE
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${API_URL}/api/payments/stats/summary?range=${range}`, {
            headers: { "x-admin-secret": adminSecret },
          });
          const d = await r.json();
          setStats(d);
        } catch {}
      }, 25000);
    }

    return () => {
      if (esRef.current) esRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
      esRef.current = null;
      pollRef.current = null;
    };
  }, [range, adminSecret]);

  const data = stats?.seriesByDay || [];

  if (!adminSecret) {
    return (
      <section className="card">
        <div className="stats-head">
          <div className="stats-title">
            <span className="emoji" aria-hidden>📈</span>
            <h2 className="card-title">Estadísticas</h2>
          </div>
        </div>
        <p className="muted">Ingresá primero en el panel de Órdenes para guardar tu <b>ADMIN_SECRET</b> en sessionStorage.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="stats-head">
        <div className="stats-title">
          <span className="emoji" aria-hidden>📈</span>
          <h2 className="card-title">Estadísticas</h2>
          <LiveDot live={live} />
        </div>

        <div className="stats-controls">
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="12w">Últimas 12 semanas</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPI label="Ingresos (pagado)" value={money(stats?.totals?.paidRevenue)} />
        <KPI label="Órdenes pagadas" value={stats?.totals?.ordersPaid ?? 0} />
        <KPI label="Órdenes totales" value={stats?.totals?.ordersAll ?? 0} />
        <KPI label="Ticket promedio" value={money(stats?.totals?.aov ?? 0)} />
      </div>

      {/* Gráficos */}
      <div className="charts">
        <div className="chart-card">
          <h3>Ingresos por día</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopOpacity={0.35}/>
                  <stop offset="95%" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v)=>money(v)} />
              <Area type="monotone" dataKey="paidRevenue" name="Ingresos" strokeWidth={2} fillOpacity={1} fill="url(#gradRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Órdenes por día</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="ordersPaid" name="Pagadas" />
              <Bar dataKey="ordersAll" name="Totales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ventas semanales */}
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
              {(data.slice(-7)).map((d) => (
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
          Rango: <b>{stats?.from}</b> → <b>{stats?.to}</b> • Actualizado: {formatDateTime(stats?.generatedAt)}
        </p>
      </div>
    </section>
  );
}

/* Helpers UI */
function KPI({ label, value }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}

function LiveDot({ live }) {
  return <span className={`live-dot ${live ? "on" : ""}`} title={live ? "En vivo" : "Reconectando…"} />;
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR");
}
function formatDay(yyyyMmDd) {
  const [y,m,d] = String(yyyyMmDd || "").split("-").map(Number);
  if (!y || !m || !d) return "—";
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" });
}
