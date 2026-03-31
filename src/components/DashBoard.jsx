import { useEffect, useMemo, useRef, useState } from "react";
import ProductList from "../../src/components/ProductList";
import ProductForm from "../../src/components/ProductForm";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  Tooltip, XAxis, YAxis, ResponsiveContainer,
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
        const res  = await fetch(url, { headers: { "x-admin-secret": adminSecret } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Error");
        if (!abort) setPendingCount((data.orders || []).length);
      } catch { if (!abort) setPendingCount(0); }
    };
    fetchCount();
    const id = setInterval(fetchCount, 10000);
    return () => { abort = true; clearInterval(id); };
  }, [adminSecret]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    window.location.href = "/login";
  };

  const TABS = [
    { id: "stock",        icon: "📦", label: "Stock" },
    { id: "crear",        icon: "⬆️", label: "Subir" },
    { id: "estadisticas", icon: "📊", label: "Stats" },
  ];

  return (
    <div className="min-h-screen bg-[#faf8fb]" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      <div className="max-w-[1180px] mx-auto px-3 pt-3 pb-10 sm:px-4 sm:pt-4 lg:pt-6">

        {/* ── Topbar ── */}
        <header className="flex items-center justify-between gap-2 bg-gradient-to-br from-white to-[#fff0f7] border border-[#f4d6e8] shadow-[0_10px_30px_rgba(214,51,132,0.08)] rounded-2xl px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-r from-[#ff2ea6] to-[#ff6fb5] text-white font-black text-sm shadow-[0_8px_20px_rgba(255,46,166,0.25)] flex-shrink-0">
              A
            </span>
            <div>
              <strong className="block text-sm leading-tight">Aesthetic</strong>
              <small className="block text-[#6f6f6f] text-xs">Panel Admin</small>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white text-[#d63384] border border-[#f4d6e8] rounded-xl px-3 py-1.5 text-xs font-black cursor-pointer hover:shadow-md transition-shadow whitespace-nowrap"
          >
            Salir
          </button>
        </header>

        {/* ── Tabs ──
            Móvil:  grilla 2×2 (los 4 botones iguales)
            sm+:    fila flex, tabs se estiran, CTA fijo a la derecha
        ── */}
        <nav className="grid grid-cols-2 gap-1.5 mb-3 sm:flex sm:items-center sm:gap-2" role="tablist">
          {TABS.map(({ id, icon, label }) => {
            const active = vista === id;
            return (
              <button
                key={id}
                onClick={() => setVista(id)}
                role="tab"
                aria-selected={active}
                className={[
                  "flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-black border transition-all duration-150",
                  "rounded-xl sm:rounded-full sm:flex-1",
                  active
                    ? "bg-gradient-to-r from-[#ff2ea6] to-[#ff6fb5] text-white border-transparent shadow-[0_8px_20px_rgba(255,46,166,0.18)]"
                    : "bg-white text-[#d63384] border-[#f4d6e8] hover:shadow-md",
                ].join(" ")}
                type="button"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}

          {/* CTA Órdenes — siempre rosado */}
          <Link
            to="/orders"
            className="relative flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-black text-white bg-gradient-to-r from-[#ff2ea6] to-[#ff6fb5] border-transparent rounded-xl shadow-[0_8px_20px_rgba(255,46,166,0.18)] hover:brightness-105 transition-all sm:rounded-full sm:flex-shrink-0 sm:px-4"
          >
            <span>🧾</span>
            <span>Órdenes</span>
            {adminSecret && pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white border-2 border-white font-black text-[10px] leading-none flex items-center justify-center shadow-md">
                {pendingCount}
              </span>
            )}
          </Link>
        </nav>

        {/* ── Contenido ── */}
        <main className="bg-white border border-[#f4d6e8] shadow-[0_10px_30px_rgba(214,51,132,0.08)] rounded-2xl p-3 sm:p-4">
          {vista === "stock"        && <ProductList />}
          {vista === "crear"        && <ProductForm />}
          {vista === "estadisticas" && <StatsSection />}
        </main>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   StatsSection
═══════════════════════════════════════════════════════ */
function StatsSection() {
  const [range, setRange]               = useState("7d");
  const [useSnapshots, setUseSnapshots] = useState(false);
  const [stats, setStats]               = useState(null);
  const [live, setLive]                 = useState(false);
  const [error, setError]               = useState("");
  const [showAdvanced, setShowAdvanced] = useState(SHOW_ADVANCED_DEFAULT);

  const esRef   = useRef(null);
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
      if (!r.ok) { setError(d?.message || "Error en estadísticas"); setStats(null); return; }
      setStats(d);
    } catch { setError("No se pudieron cargar estadísticas"); }
  }

  useEffect(() => {
    refetchSummary(range, useSnapshots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, adminSecret, useSnapshots]);

  useEffect(() => {
    if (!adminSecret) return;
    if (esRef.current)   { esRef.current.close();          esRef.current  = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setLive(false);
    if (useSnapshots) return;

    const enc = encodeURIComponent(adminSecret);
    const url = `${API_URL}/api/payments/stats/stream?range=${range}&admin_secret=${enc}`;
    try {
      const es = new EventSource(url);
      esRef.current = es;
      es.onopen = () => {
        setLive(true); setError("");
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      };
      const onMsg = (e) => {
        try { setStats(JSON.parse(e.data)); setLive(true); setError(""); } catch {}
      };
      es.addEventListener("stats", onMsg);
      es.onmessage = onMsg;
      es.onerror = () => {
        setLive(false);
        if (!pollRef.current) pollRef.current = setInterval(() => refetchSummary(range, false), 30000);
      };
    } catch {
      pollRef.current = setInterval(() => refetchSummary(range, false), 30000);
    }
    return () => {
      if (esRef.current)   esRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
      esRef.current = null; pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, adminSecret, useSnapshots]);

  const data = stats?.seriesByDay || [];

  const KPIS = [
    { label: "Ingresos",     value: money(stats?.totals?.paidRevenue) },
    { label: "Pagadas",      value: stats?.totals?.ordersPaid ?? 0    },
    { label: "Totales",      value: stats?.totals?.ordersAll  ?? 0    },
    { label: "Ticket prom.", value: money(stats?.totals?.aov  ?? 0)   },
  ];

  return (
    <section>

      {/* Cabecera */}
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-start sm:justify-between">

        {/* Título + live dot */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg">📈</span>
          <h2 className="text-[#d63384] font-black text-base m-0">Estadísticas</h2>
          {!useSnapshots && <LiveDot live={live} />}
        </div>

        {/* Controles: columna en móvil, fila en sm+ */}
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:w-auto">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="w-full sm:w-auto border border-[#f4d6e8] rounded-xl px-3 py-2 bg-[#fffafd] text-[#3b3b3b] text-sm outline-none"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="12w">Últimas 12 sem.</option>
          </select>

          <label className="flex items-center gap-1.5 text-[#6b6b6b] text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useSnapshots}
              onChange={(e) => setUseSnapshots(e.target.checked)}
              className="accent-[#d63384]"
            />
            Snapshots
          </label>

          {SHOW_ADVANCED_DEFAULT && (
            <button
              onClick={() => setShowAdvanced(s => !s)}
              className="self-start bg-white text-[#d63384] border border-[#f4d6e8] rounded-full px-3 py-1.5 text-xs font-black cursor-pointer hover:shadow-md transition-shadow"
              type="button"
            >
              {showAdvanced ? "Ocultar" : "⚙️ Avanzado"}
            </button>
          )}
        </div>
      </div>

      {/* Panel avanzado */}
      {showAdvanced && (
        <div className="w-full mb-4 p-3 border border-dashed border-[#f4d6e8] rounded-2xl bg-[#fffafd]">
          <StatsAdminControls onAfterAction={() => refetchSummary(range, true)} />
        </div>
      )}

      {/* Banners de estado */}
      {!adminSecret && (
        <div className="mb-4 px-3 py-2.5 bg-[#f0f9ff] text-[#075985] border border-[#bae6fd] rounded-xl text-sm font-bold">
          Iniciá sesión en <b>Órdenes</b> para ver estadísticas.{" "}
          <Link to="/orders" className="underline">Ir a Órdenes</Link>
        </div>
      )}
      {error && (
        <div className="mb-4 px-3 py-2.5 bg-[#fef2f2] text-[#991b1b] border border-[#fca5a5] rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      {/* KPIs: 2 col móvil → 4 col lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {KPIS.map(({ label, value }) => (
          <div
            key={label}
            className="bg-white border border-[#f4d6e8] border-l-4 border-l-[#f39ac6] rounded-2xl p-3 shadow-[0_6px_16px_rgba(214,51,132,0.06)]"
          >
            <span className="block text-[#6b6b6b] text-[11px] mb-0.5">{label}</span>
            <span className="block text-[#3b3b3b] font-black text-base leading-tight">{value}</span>
          </div>
        ))}
      </div>

      {/* Gráficos: 1 col móvil → 2 col lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4 overflow-hidden">
        <div className="bg-white border border-[#f4d6e8] rounded-2xl p-3 shadow-[0_10px_30px_rgba(214,51,132,0.06)] overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-[#3b3b3b] mb-3">Ingresos por día</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#d63384" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#d63384" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={52} />
              <Tooltip formatter={(v) => money(v)} />
              <Area type="monotone" dataKey="paidRevenue" name="Ingresos"
                stroke="#d63384" strokeWidth={2} fillOpacity={1} fill="url(#gradRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-[#f4d6e8] rounded-2xl p-3 shadow-[0_10px_30px_rgba(214,51,132,0.06)] overflow-hidden min-w-0">
          <h3 className="text-sm font-bold text-[#3b3b3b] mb-3">Órdenes por día</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={32} />
              <Tooltip />
              <Bar dataKey="ordersPaid" name="Pagadas" fill="#d63384" />
              <Bar dataKey="ordersAll"  name="Totales" fill="#f4d6e8"  />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ventas semanales */}
      <div className="bg-white border border-[#f4d6e8] rounded-2xl p-3 shadow-[0_8px_20px_rgba(214,51,132,0.06)]">
        <h3 className="text-sm font-bold text-[#3b3b3b] mb-1">Ventas semanales</h3>
        <p className="text-[#6f6f6f] text-xs mb-3">Últimos 7 días (pagado).</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {["Fecha", "Órdenes", "Ingresos"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[#6b6b6b] font-bold border-b border-dashed border-[#f4d6e8]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(-7).map((d) => (
                <tr key={d.date} className="hover:bg-[#fffafd]">
                  <td className="px-3 py-2 border-b border-dashed border-[#f4d6e8]">{formatDay(d.date)}</td>
                  <td className="px-3 py-2 border-b border-dashed border-[#f4d6e8]">{d.ordersPaid}</td>
                  <td className="px-3 py-2 border-b border-dashed border-[#f4d6e8]">{money(d.paidRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-right text-[#6b6b6b] text-[11px] mt-2">
          Rango: <b>{stats?.from}</b> → <b>{stats?.to}</b> · {formatDateTime(stats?.generatedAt)}
        </p>
      </div>
    </section>
  );
}

/* ── Helpers ─────────────────────────────────────────── */
function LiveDot({ live }) {
  return (
    <span
      title={live ? "En vivo" : "Reconectando…"}
      className={`inline-block w-2.5 h-2.5 rounded-full ml-1 transition-colors duration-200 ${live ? "bg-[#d63384] animate-pulse" : "bg-gray-300"}`}
    />
  );
}
function money(n) {
  return Number(n || 0).toLocaleString("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  });
}
function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR");
}
function formatDay(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd || "").split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "short", day: "2-digit", month: "2-digit",
  });
}