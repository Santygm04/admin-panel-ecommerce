import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "./AuthContext";
import StatsAdminControls from "./StatsAdminControls";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Tabs } from "./ui";
import {
  CalendarIcon, ChartIcon, CheckCircleIcon, CoinsIcon, EyeIcon, PercentIcon, RefreshIcon,
  ShoppingBagIcon, TargetIcon,
} from "./ui/icons";
import { useTheme } from "../theme/ThemeContext";
import { API_URL } from "../utils/api";
import "./StatsPage.css";

const RANGE_OPTIONS = [
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "12w", label: "12 semanas" },
];

const SHOW_MAINTENANCE =
  String(import.meta.env.VITE_STATS_SHOW_ADVANCED ?? "true").toLowerCase() === "true";

const PAID_STATUSES = new Set(["paid", "shipped", "delivered"]);
const STATUS_META = {
  pending: { label: "Pendiente", tone: "warning" },
  paid: { label: "Pagada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
  rejected: { label: "Rechazada", tone: "danger" },
  shipped: { label: "Despachada", tone: "info" },
  delivered: { label: "Entregada", tone: "success" },
};

const money = (value) => Number(value || 0).toLocaleString("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const moneyShort = (value) => {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `$${(number / 1_000).toFixed(0)}k`;
  return `$${Math.round(number)}`;
};

const parseDay = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return year ? new Date(year, month - 1, day) : null;
};

const toDayKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const buenosAiresDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const shiftDay = (dayKey, amount) => {
  const date = parseDay(dayKey);
  date.setDate(date.getDate() + amount);
  return toDayKey(date);
};

const todayKey = () => buenosAiresDayKey(new Date());

const defaultCustomRange = () => ({ from: shiftDay(todayKey(), -29), to: todayKey() });

const rangeLength = ({ from, to }) => {
  const start = parseDay(from);
  const end = parseDay(to);
  return start && end ? Math.round((end - start) / 86400000) + 1 : 0;
};

const formatDay = (value, options = { day: "2-digit", month: "short" }) => {
  const date = parseDay(value);
  return date ? date.toLocaleDateString("es-AR", options) : "—";
};

const formatDateTime = (value) => value
  ? new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
  : "—";

const normalizeRows = (rows = []) => rows
  .map((row) => ({
    date: row.date,
    endDate: row.date,
    label: formatDay(row.date),
    paidRevenue: Number(row.paidRevenue) || 0,
    ordersPaid: Number(row.ordersPaid) || 0,
    ordersAll: Number(row.ordersAll) || 0,
  }))
  .filter((row) => parseDay(row.date))
  .sort((a, b) => a.date.localeCompare(b.date));

const aggregateByWeek = (rows) => {
  const groups = new Map();
  rows.forEach((row) => {
    const date = parseDay(row.date);
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = toDayKey(monday);
    const current = groups.get(key) || {
      date: key,
      endDate: key,
      paidRevenue: 0,
      ordersPaid: 0,
      ordersAll: 0,
    };
    current.paidRevenue += row.paidRevenue;
    current.ordersPaid += row.ordersPaid;
    current.ordersAll += row.ordersAll;
    groups.set(key, current);
  });

  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => {
    const end = parseDay(row.date);
    end.setDate(end.getDate() + 6);
    return {
      ...row,
      endDate: toDayKey(end),
      label: `${formatDay(row.date)} – ${end.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`,
    };
  });
};

const aggregateOrders = (orders, customRange) => {
  const rows = new Map();
  let cursor = customRange.from;
  while (cursor <= customRange.to) {
    rows.set(cursor, { date: cursor, paidRevenue: 0, ordersPaid: 0, ordersAll: 0 });
    cursor = shiftDay(cursor, 1);
  }

  orders.forEach((order) => {
    if (order.status === "deleted") return;
    const key = buenosAiresDayKey(order.createdAt);
    const row = rows.get(key);
    if (!row) return;
    row.ordersAll += 1;
    if (PAID_STATUSES.has(order.status)) {
      row.ordersPaid += 1;
      row.paidRevenue += Number(order.total) || 0;
    }
  });

  const seriesByDay = [...rows.values()];
  const totals = seriesByDay.reduce((result, row) => ({
    paidRevenue: result.paidRevenue + row.paidRevenue,
    ordersPaid: result.ordersPaid + row.ordersPaid,
    ordersAll: result.ordersAll + row.ordersAll,
  }), { paidRevenue: 0, ordersPaid: 0, ordersAll: 0 });

  return {
    from: customRange.from,
    to: customRange.to,
    generatedAt: new Date().toISOString(),
    totals: {
      ...totals,
      aov: totals.ordersPaid ? totals.paidRevenue / totals.ordersPaid : 0,
    },
    seriesByDay,
  };
};

const orderNumber = (order) => order?.orderNumber
  ? `#${order.orderNumber}`
  : order?.shippingTicket || `#${String(order?._id || "").slice(-8)}`;

const paymentLabel = (method) => ({
  mercadopago: "Mercado Pago",
  transfer: "Transferencia",
}[method] || method || "Sin especificar");

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

export default function StatsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState("30d");
  const [dateDraft, setDateDraft] = useState(defaultCustomRange);
  const [customRange, setCustomRange] = useState(null);
  const [dateError, setDateError] = useState("");
  const [source, setSource] = useState("live");
  const [granularity, setGranularity] = useState("day");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [sortDirection, setSortDirection] = useState("desc");
  const [salesModal, setSalesModal] = useState({ row: null, orders: [], loading: false, error: "" });
  const controllerRef = useRef(null);
  const salesControllerRef = useRef(null);
  const ordersCacheRef = useRef({ orders: null, fetchedAt: 0 });
  const token = sessionStorage.getItem("aesthetic:token") || "";

  const fetchOrders = useCallback(async ({ signal, force = false } = {}) => {
    const cache = ordersCacheRef.current;
    if (!force && cache.orders && Date.now() - cache.fetchedAt < 30000) return cache.orders;
    const response = await fetch(`${API_URL}/api/payments/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || "No se pudieron cargar las ventas");
    const orders = Array.isArray(data.orders) ? data.orders : [];
    ordersCacheRef.current = { orders, fetchedAt: Date.now() };
    return orders;
  }, [token]);

  const loadStats = useCallback(async ({ reset = false } = {}) => {
    if (!token) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const endpoint = source === "snapshot"
      ? "/api/payments/stats/snapshot/summary"
      : "/api/payments/stats/summary";

    if (reset) {
      setLoading(true);
      setStats(null);
    } else {
      setRefreshing(true);
    }
    setError("");

    try {
      if (customRange) {
        const orders = await fetchOrders({ signal: controller.signal, force: !reset });
        setStats(aggregateOrders(orders, customRange));
        return;
      }
      const response = await fetch(`${API_URL}${endpoint}?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "No se pudieron cargar las estadísticas");
      setStats(data);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "No se pudieron cargar las estadísticas");
        if (reset) setStats(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [customRange, fetchOrders, range, source, token]);

  useEffect(() => {
    loadStats({ reset: true });
    return () => controllerRef.current?.abort();
  }, [loadStats]);

  useEffect(() => {
    if (source !== "live" || !autoRefresh || !token) return undefined;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") loadStats();
    };
    const interval = window.setInterval(refreshIfVisible, 30000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [autoRefresh, loadStats, source, token]);

  const dailyRows = useMemo(() => normalizeRows(stats?.seriesByDay), [stats]);
  const displayRows = useMemo(
    () => granularity === "week" ? aggregateByWeek(dailyRows) : dailyRows,
    [dailyRows, granularity],
  );
  const orderedRows = useMemo(
    () => sortDirection === "desc" ? [...displayRows].reverse() : displayRows,
    [displayRows, sortDirection],
  );
  const totalPages = Math.max(1, Math.ceil(orderedRows.length / pageSize));
  const pagedRows = orderedRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [customRange, granularity, pageSize, range, source, sortDirection]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const totals = stats?.totals || {};
  const paidRevenue = Number(totals.paidRevenue) || 0;
  const ordersPaid = Number(totals.ordersPaid) || 0;
  const ordersAll = Number(totals.ordersAll) || 0;
  const conversion = ordersAll ? Math.round((ordersPaid / ordersAll) * 100) : 0;
  const unpaidOrders = Math.max(ordersAll - ordersPaid, 0);
  const bestDay = dailyRows.reduce((best, row) => row.paidRevenue > (best?.paidRevenue ?? -1) ? row : best, null);
  const averagePerDay = dailyRows.length ? paidRevenue / dailyRows.length : 0;
  const rangeLabel = stats?.from && stats?.to
    ? `${formatDay(stats.from, { day: "2-digit", month: "short", year: "numeric" })} al ${formatDay(stats.to, { day: "2-digit", month: "short", year: "numeric" })}`
    : RANGE_OPTIONS.find((item) => item.key === range)?.label;

  const selectPreset = (value) => {
    setRange(value);
    setCustomRange(null);
    setDateError("");
  };

  const applyCustomRange = () => {
    if (!dateDraft.from || !dateDraft.to) {
      setDateError("Elegí una fecha de inicio y una fecha final.");
      return;
    }
    if (dateDraft.from > dateDraft.to) {
      setDateError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    if (rangeLength(dateDraft) > 365) {
      setDateError("El rango personalizado puede abarcar hasta 365 días.");
      return;
    }
    setDateError("");
    setSource("live");
    setCustomRange({ ...dateDraft });
  };

  const clearCustomRange = () => {
    setDateDraft(defaultCustomRange());
    setCustomRange(null);
    setDateError("");
  };

  const changeSource = (value) => {
    setSource(value);
    if (value === "snapshot") setCustomRange(null);
  };

  const openSales = async (row) => {
    salesControllerRef.current?.abort();
    const controller = new AbortController();
    salesControllerRef.current = controller;
    setSalesModal({ row, orders: [], loading: true, error: "" });
    try {
      const orders = await fetchOrders({ signal: controller.signal });
      if (controller.signal.aborted) return;
      const from = granularity === "week"
        ? [row.date, stats?.from].filter(Boolean).sort().at(-1)
        : row.date;
      const to = granularity === "week"
        ? [row.endDate, stats?.to].filter(Boolean).sort()[0]
        : row.date;
      const matching = orders
        .filter((order) => order.status !== "deleted")
        .filter((order) => {
          const key = buenosAiresDayKey(order.createdAt);
          return key >= from && key <= to;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSalesModal({ row: { ...row, date: from, endDate: to }, orders: matching, loading: false, error: "" });
    } catch (requestError) {
      if (requestError.name === "AbortError") return;
      setSalesModal((current) => ({ ...current, loading: false, error: requestError.message || "No se pudieron cargar las ventas" }));
    }
  };

  const closeSales = () => {
    salesControllerRef.current?.abort();
    setSalesModal({ row: null, orders: [], loading: false, error: "" });
  };

  const exportCsv = () => {
    const header = ["Periodo", "Ordenes pagadas", "Ordenes totales", "Ingresos ARS"];
    const lines = displayRows.map((row) => [row.label, row.ordersPaid, row.ordersAll, row.paidRevenue]);
    const csv = [header, ...lines].map((values) => values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `estadisticas-${customRange ? `${customRange.from}-${customRange.to}` : range}-${granularity}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stats-page">
      <header className="stats-hero">
        <div>
          <div className="stats-eyebrow"><ChartIcon size={16} /> Rendimiento comercial</div>
          <h2>Estadísticas</h2>
          <p>Ingresos, órdenes y conversión en una vista clara para tomar decisiones.</p>
        </div>
        <div className="stats-hero-actions">
          <Badge tone={source === "live" && autoRefresh ? "success" : "neutral"} dot>
            {source === "live" && autoRefresh ? "Actualiza cada 30 s" : source === "snapshot" ? "Histórico consolidado" : "Actualización manual"}
          </Badge>
          <Button variant="secondary" onClick={() => loadStats()} loading={refreshing}>
            <RefreshIcon size={15} /> Actualizar
          </Button>
        </div>
      </header>

      <Card pad className="stats-filter-card">
        <div className="stats-filter-block stats-filter-block--period">
          <span className="stats-filter-label">Períodos rápidos</span>
          <Tabs variant="pill" active={customRange ? "custom" : range} onChange={selectPreset} items={RANGE_OPTIONS} />
        </div>
        <Field label="Fuente de datos" className="stats-filter-field">
          <Select value={source} onChange={(event) => changeSource(event.target.value)} aria-label="Fuente de estadísticas">
            <option value="live">Calculado en tiempo real</option>
            <option value="snapshot">Histórico consolidado</option>
          </Select>
        </Field>
        <div className="stats-filter-block">
          <span className="stats-filter-label">Agrupar por</span>
          <Tabs
            variant="pill"
            active={granularity}
            onChange={setGranularity}
            items={[{ key: "day", label: "Día" }, { key: "week", label: "Semana" }]}
          />
        </div>
        <label className={`stats-auto-refresh ${source === "snapshot" ? "stats-auto-refresh--disabled" : ""}`}>
          <input
            type="checkbox"
            checked={autoRefresh && source === "live"}
            disabled={source === "snapshot"}
            onChange={(event) => setAutoRefresh(event.target.checked)}
          />
          <span>Autoactualizar</span>
        </label>

        <section className="stats-date-range" aria-labelledby="stats-custom-range-title">
          <div className="stats-date-range-copy">
            <span className="stats-date-range-icon"><CalendarIcon size={19} /></span>
            <div>
              <h3 id="stats-custom-range-title">Rango personalizado</h3>
              <p>Elegí las fechas exactas que querés analizar.</p>
            </div>
            {customRange && <Badge tone="brand">Activo</Badge>}
          </div>
          <div className="stats-date-range-controls">
            <Field label="Desde" error={dateError && !dateDraft.from ? dateError : undefined}>
              <Input
                type="date"
                value={dateDraft.from}
                max={dateDraft.to || todayKey()}
                onChange={(event) => { setDateDraft((current) => ({ ...current, from: event.target.value })); setDateError(""); }}
                aria-label="Fecha inicial del rango personalizado"
              />
            </Field>
            <span className="stats-date-separator" aria-hidden="true">hasta</span>
            <Field label="Hasta">
              <Input
                type="date"
                value={dateDraft.to}
                min={dateDraft.from || undefined}
                max={todayKey()}
                onChange={(event) => { setDateDraft((current) => ({ ...current, to: event.target.value })); setDateError(""); }}
                aria-label="Fecha final del rango personalizado"
              />
            </Field>
            <div className="stats-date-actions">
              <Button onClick={applyCustomRange} disabled={!dateDraft.from || !dateDraft.to}>Aplicar fechas</Button>
              <Button variant="ghost" onClick={clearCustomRange} disabled={!customRange}>Volver al período rápido</Button>
            </div>
          </div>
          {dateError && dateDraft.from && <p className="stats-date-error" role="alert">{dateError}</p>}
          {source === "snapshot" && <p className="stats-date-note">Al aplicar fechas personalizadas se usará el cálculo en tiempo real.</p>}
        </section>
      </Card>

      {SHOW_MAINTENANCE && user?.role === "admin" && (
        <section className="stats-maintenance">
          <button
            type="button"
            className="stats-maintenance-toggle"
            aria-expanded={showMaintenance}
            onClick={() => setShowMaintenance((current) => !current)}
          >
            <span><b>Mantenimiento de históricos</b><small>Reconstrucción y limpieza de snapshots</small></span>
            <span aria-hidden="true">{showMaintenance ? "−" : "+"}</span>
          </button>
          {showMaintenance && (
            <div className="stats-maintenance-body">
              <StatsAdminControls onAfterAction={() => loadStats()} />
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="ui-banner ui-banner--danger stats-error" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="danger-ghost" onClick={() => loadStats({ reset: true })}>Reintentar</Button>
        </div>
      )}

      {loading ? (
        <StatsLoading />
      ) : (
        <>
          <section className="stats-kpis" aria-label="Indicadores principales">
            <MetricCard tone="brand" icon={<CoinsIcon size={20} />} label="Ingresos pagados" value={moneyShort(paidRevenue)} detail={money(paidRevenue)} />
            <MetricCard tone="success" icon={<CheckCircleIcon size={20} />} label="Órdenes pagadas" value={String(ordersPaid)} detail={`${ordersAll} órdenes totales`} />
            <MetricCard tone="neutral" icon={<ShoppingBagIcon size={20} />} label="Órdenes totales" value={String(ordersAll)} detail={`${unpaidOrders} sin pago confirmado`} />
            <MetricCard tone="info" icon={<PercentIcon size={20} />} label="Conversión" value={`${conversion}%`} detail="Pagadas sobre el total" />
            <MetricCard tone="gold" icon={<TargetIcon size={20} />} label="Ticket promedio" value={moneyShort(totals.aov)} detail={money(totals.aov)} />
          </section>

          <section className="stats-insights" aria-label="Datos destacados del período">
            <div><span>Mejor día</span><b>{bestDay ? formatDay(bestDay.date, { weekday: "short", day: "2-digit", month: "short" }) : "—"}</b><small>{bestDay ? money(bestDay.paidRevenue) : "Sin ventas"}</small></div>
            <div><span>Promedio diario</span><b>{moneyShort(averagePerDay)}</b><small>Ingresos por día del rango</small></div>
            <div><span>Período analizado</span><b>{rangeLabel || "—"}</b><small>{displayRows.length} {granularity === "week" ? "semanas" : "días"} con datos</small></div>
          </section>

          <section className="stats-charts" aria-label="Gráficos de rendimiento">
            <ChartCard title="Evolución de ingresos" description={`Ventas confirmadas por ${granularity === "week" ? "semana" : "día"}`}>
              <RevenueChart data={displayRows} />
            </ChartCard>
            <ChartCard
              title="Estado de las órdenes"
              description="Pagadas y sin pago confirmado"
              legend={<div className="stats-legend"><span><i className="stats-dot stats-dot--brand" />Pagadas</span><span><i className="stats-dot stats-dot--gold" />Sin confirmar</span></div>}
            >
              <OrdersChart data={displayRows} />
            </ChartCard>
          </section>

          <Card className="stats-table-card">
            <div className="stats-table-header">
              <div>
                <h3>Detalle por {granularity === "week" ? "semana" : "día"}</h3>
                <p>Todos los registros del período seleccionado, ordenados y paginados.</p>
              </div>
              <div className="stats-table-tools">
                <Field label="Filas">
                  <Select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Filas por página">
                    <option value={7}>7</option>
                    <option value={14}>14</option>
                    <option value={30}>30</option>
                  </Select>
                </Field>
                <Button size="sm" variant="secondary" onClick={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")}>
                  {sortDirection === "desc" ? "Más recientes" : "Más antiguos"}
                </Button>
                <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!displayRows.length}>Exportar CSV</Button>
              </div>
            </div>

            {!displayRows.length ? (
              <EmptyState
                icon={<ChartIcon size={24} />}
                title="Sin datos para este período"
                description="Todavía no hay ventas registradas con la configuración seleccionada."
              />
            ) : (
              <>
                <div className="stats-table-desktop">
                  <table aria-label={`Detalle estadístico por ${granularity === "week" ? "semana" : "día"}`}>
                    <thead><tr><th>{granularity === "week" ? "Semana" : "Fecha"}</th><th>Pagadas</th><th>Sin confirmar</th><th>Totales</th><th className="stats-align-right">Ingresos</th><th className="stats-align-right">Conversión</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                    <tbody>
                      {pagedRows.map((row) => <StatsRow key={row.date} row={row} onOpen={() => openSales(row)} />)}
                    </tbody>
                  </table>
                </div>
                <div className="stats-day-cards" aria-label="Detalle estadístico">
                  {pagedRows.map((row) => <StatsDayCard key={row.date} row={row} onOpen={() => openSales(row)} />)}
                </div>
                <div className="stats-pager">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
                  <span>Página <b>{page}</b> de <b>{totalPages}</b></span>
                  <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
                </div>
              </>
            )}
            <footer className="stats-table-footer">
              <span>{source === "live" ? "Datos calculados" : "Histórico consolidado"}</span>
              <span>Actualizado: {formatDateTime(stats?.generatedAt)}</span>
            </footer>
          </Card>
        </>
      )}

      <SalesBreakdownModal
        state={salesModal}
        granularity={granularity}
        onClose={closeSales}
        onRetry={() => salesModal.row && openSales(salesModal.row)}
      />
    </div>
  );
}

function MetricCard({ tone, icon, label, value, detail }) {
  return (
    <Card className={`stats-kpi stats-kpi--${tone}`}>
      <div className="stats-kpi-top"><span className="stats-kpi-icon">{icon}</span><span>{label}</span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  );
}

function StatsLoading() {
  return (
    <div className="stats-loading" aria-label="Cargando estadísticas" role="status">
      <div className="stats-kpis">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} variant="block" className="stats-kpi-skeleton" />)}</div>
      <div className="stats-charts"><Skeleton variant="block" className="stats-chart-skeleton" /><Skeleton variant="block" className="stats-chart-skeleton" /></div>
      <Skeleton variant="block" className="stats-table-skeleton" />
    </div>
  );
}

function ChartCard({ title, description, legend, children }) {
  return (
    <Card pad className="stats-chart-card">
      <div className="stats-chart-header"><div><h3>{title}</h3><p>{description}</p></div>{legend}</div>
      {children}
    </Card>
  );
}

function ChartTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="stats-tooltip">
      <b>{label}</b>
      {payload.map((item) => <span key={item.dataKey}><i style={{ background: item.color || item.fill }} />{item.name}: <strong>{valueFormatter(item.value)}</strong></span>)}
    </div>
  );
}

function RevenueChart({ data }) {
  const colors = useChartPalette();
  if (!data.length) return <ChartEmpty />;
  return (
    <div className="stats-chart" role="img" aria-label="Gráfico de evolución de ingresos. La tabla inferior contiene los valores exactos.">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs><linearGradient id="statsRevenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.brand} stopOpacity={0.32} /><stop offset="100%" stopColor={colors.brand} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={26} />
          <YAxis tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={moneyShort} width={58} />
          <Tooltip content={<ChartTooltip valueFormatter={money} />} />
          <Area type="monotone" dataKey="paidRevenue" name="Ingresos" stroke={colors.brand} strokeWidth={3} fill="url(#statsRevenueGradient)" dot={data.length > 16 ? false : { r: 3, fill: colors.brand }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function OrdersChart({ data }) {
  const colors = useChartPalette();
  const rows = data.map((row) => ({ ...row, unconfirmed: Math.max(row.ordersAll - row.ordersPaid, 0) }));
  if (!rows.length) return <ChartEmpty />;
  return (
    <div className="stats-chart" role="img" aria-label="Gráfico de órdenes pagadas y sin confirmar. La tabla inferior contiene los valores exactos.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={26} />
          <YAxis tick={{ fill: colors.tick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={38} />
          <Tooltip content={<ChartTooltip valueFormatter={(value) => String(value)} />} />
          <Bar dataKey="ordersPaid" name="Pagadas" stackId="orders" fill={colors.brand} maxBarSize={30} />
          <Bar dataKey="unconfirmed" name="Sin confirmar" stackId="orders" fill={colors.gold} radius={[5, 5, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty() {
  return <div className="stats-chart-empty"><ChartIcon size={22} /><span>Sin datos para graficar</span></div>;
}

function StatsRow({ row, onOpen }) {
  const unconfirmed = Math.max(row.ordersAll - row.ordersPaid, 0);
  const conversion = row.ordersAll ? Math.round((row.ordersPaid / row.ordersAll) * 100) : 0;
  return (
    <tr className="stats-clickable-row" onClick={onOpen}>
      <td><b>{row.label}</b></td>
      <td><Badge tone="success">{row.ordersPaid}</Badge></td>
      <td>{unconfirmed}</td>
      <td>{row.ordersAll}</td>
      <td className="stats-align-right stats-money">{money(row.paidRevenue)}</td>
      <td className="stats-align-right"><b>{conversion}%</b></td>
      <td className="stats-row-action">
        <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label={`Ver ventas de ${row.label}`}>
          <EyeIcon size={15} /> Ver ventas
        </Button>
      </td>
    </tr>
  );
}

function StatsDayCard({ row, onOpen }) {
  const unconfirmed = Math.max(row.ordersAll - row.ordersPaid, 0);
  const conversion = row.ordersAll ? Math.round((row.ordersPaid / row.ordersAll) * 100) : 0;
  return (
    <article className="stats-day-card stats-day-card--clickable" onClick={onOpen}>
      <div className="stats-day-card-head"><b>{row.label}</b><strong>{money(row.paidRevenue)}</strong></div>
      <dl><div><dt>Pagadas</dt><dd>{row.ordersPaid}</dd></div><div><dt>Sin confirmar</dt><dd>{unconfirmed}</dd></div><div><dt>Total</dt><dd>{row.ordersAll}</dd></div><div><dt>Conversión</dt><dd>{conversion}%</dd></div></dl>
      <Button size="sm" variant="ghost" className="stats-day-card-action" onClick={(event) => { event.stopPropagation(); onOpen(); }}>
        <EyeIcon size={15} /> Ver ventas
      </Button>
    </article>
  );
}

function SalesBreakdownModal({ state, granularity, onClose, onRetry }) {
  const { row, orders, loading, error } = state;
  const paidOrders = orders.filter((order) => PAID_STATUSES.has(order.status));
  const paidTotal = paidOrders.reduce((total, order) => total + (Number(order.total) || 0), 0);
  const periodLabel = row
    ? granularity === "week"
      ? `${formatDay(row.date, { day: "2-digit", month: "long" })} al ${formatDay(row.endDate, { day: "2-digit", month: "long", year: "numeric" })}`
      : formatDay(row.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <Modal
      open={Boolean(row)}
      wide
      title={granularity === "week" ? "Ventas de la semana" : "Ventas del día"}
      subtitle={periodLabel}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}
    >
      {loading ? (
        <div className="stats-sales-loading" role="status" aria-label="Cargando ventas">
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      ) : error ? (
        <div className="stats-sales-error">
          <div className="ui-banner ui-banner--danger" role="alert">{error}</div>
          <Button variant="secondary" onClick={onRetry}><RefreshIcon size={15} /> Reintentar</Button>
        </div>
      ) : !orders.length ? (
        <EmptyState
          icon={<ShoppingBagIcon size={24} />}
          title="No hay ventas en este período"
          description="No se encontraron órdenes creadas durante la fecha seleccionada."
        />
      ) : (
        <div className="stats-sales-modal">
          <div className="stats-sales-summary" aria-label="Resumen de ventas del período">
            <div><span>Órdenes</span><strong>{orders.length}</strong></div>
            <div><span>Pagadas</span><strong>{paidOrders.length}</strong></div>
            <div><span>Ingresos confirmados</span><strong>{money(paidTotal)}</strong></div>
          </div>
          <div className="stats-sales-list">
            {orders.map((order) => {
              const status = STATUS_META[order.status] || { label: order.status || "Sin estado", tone: "neutral" };
              return (
                <details className="stats-sale" key={order._id}>
                  <summary>
                    <span className="stats-sale-main">
                      <b>{order.shippingTicket || orderNumber(order)}</b>
                      <small>{order?.buyer?.nombre || "Cliente sin nombre"} · {new Date(order.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}</small>
                    </span>
                    <span className="stats-sale-meta">
                      <Badge tone={status.tone} dot>{status.label}</Badge>
                      <strong>{money(order.total)}</strong>
                    </span>
                  </summary>
                  <div className="stats-sale-detail">
                    <dl>
                      <div><dt>Pedido</dt><dd>{orderNumber(order)}</dd></div>
                      <div><dt>Pago</dt><dd>{paymentLabel(order.paymentMethod)}</dd></div>
                      <div><dt>Email</dt><dd>{order?.buyer?.email || "—"}</dd></div>
                      <div><dt>Teléfono</dt><dd>{order?.buyer?.telefono || "—"}</dd></div>
                    </dl>
                    <div className="stats-sale-items">
                      <h4>Productos</h4>
                      {(order.items || []).map((item, index) => (
                        <div className="stats-sale-item" key={`${order._id}-${index}`}>
                          <span><b>{item.nombre || "Producto"}</b><small>{[item?.variant?.size, item?.variant?.color, item?.variant?.tono].filter(Boolean).join(" / ")}</small></span>
                          <span>{item.cantidad || 0} × {money(item.cantidad ? Number(item.subtotal || 0) / item.cantidad : 0)}</span>
                          <strong>{money(item.subtotal)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
