// AdminOrders.jsx — rediseño con UI kit (misma lógica de negocio)
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Tabs } from "./ui";
import {
  EyeIcon, CheckIcon, XIcon, TrashIcon, TruckIcon, RefreshIcon, SearchIcon,
  CopyIcon, WhatsAppIcon, ShoppingBagIcon, LockIcon, InboxIcon, LogoutIcon,
} from "./ui/icons";
import "./AdminOrders.css";

const API_URL  = import.meta.env.VITE_API_URL  || "http://localhost:4000";
const ADMIN_WA = (import.meta.env.VITE_ADMIN_PHONE || "").replace(/\D/g, "");

const $m   = (n) => `$${(+n || 0).toLocaleString("es-AR")}`;
const adr  = (a = {}) =>
  [[a.calle, a.numero].filter(Boolean).join(" "), a.piso, a.ciudad, a.provincia, a.cp]
    .filter(Boolean).join(", ");
const tel = (r) => {
  if (!r) return "";
  const clean = String(r).replace(/\D/g, "");
  if (clean.startsWith("54")) return clean;
  return "549" + clean;
};
const shrt = (id) => id ? String(id).slice(-8) : "—";
const num  = (o) => o?.orderNumber ? `#${o.orderNumber}` : o?.shippingTicket || `#${shrt(o?._id)}`;
const fd   = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const ft   = (d) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

const ST = {
  pending:   { lbl: "Pendiente",  tone: "warning" },
  paid:      { lbl: "Pagada",     tone: "success" },
  cancelled: { lbl: "Cancelada",  tone: "danger"  },
  rejected:  { lbl: "Rechazada",  tone: "danger"  },
  shipped:   { lbl: "Despachada", tone: "info"    },
  delivered: { lbl: "Entregada",  tone: "success" },
  deleted:   { lbl: "Eliminada",  tone: "neutral" },
};

function StatusBadge({ s }) {
  const d = ST[s] || { lbl: s, tone: "neutral" };
  return <Badge tone={d.tone} dot>{d.lbl}</Badge>;
}

function PayBadge({ method }) {
  if (method === "mercadopago") return <Badge tone="info">Mercado Pago</Badge>;
  if (method === "transfer") return <Badge tone="warning" outline>Transferencia</Badge>;
  return <Badge tone="neutral">{method || "—"}</Badge>;
}

const TABS = [
  { v: "pending",   ico: <InboxIcon size={15} />,    lbl: "Pendientes" },
  { v: "paid",      ico: <CheckIcon size={15} />,   lbl: "Pagadas" },
  { v: "cancelled", ico: <XIcon size={15} />,       lbl: "Canceladas" },
  { v: "deleted",   ico: <TrashIcon size={15} />,   lbl: "Eliminadas" },
  { v: "",          ico: <ShoppingBagIcon size={15} />, lbl: "Todas" },
];

const waTxt = (o) => {
  const envio = o?.shipping?.method === "envio";
  const ticket = o?.shippingTicket || (o?.orderNumber ? `#${o.orderNumber}` : null);
  const lines = (o?.items || []).map(it => {
    const vp = it?.variant?.size || it?.variant?.color || it?.variant?.tono
      ? ` (${[it?.variant?.size, it?.variant?.color, it?.variant?.tono].filter(Boolean).join(" / ")})` : "";
    const tonosPart = Array.isArray(it?.distribucionTonos) && it.distribucionTonos.length
      ? "\n   " + it.distribucionTonos.map(t => `${t.tono}: ${t.cantidad} u.`).join(" | ")
      : "";
    return `- ${it.nombre}${vp} x${it.cantidad} --- ${$m(it.subtotal)}${tonosPart}`;
  }).join("\n");
  return [
    "✅ *¡Tu pedido fue confirmado, Aesthetic te lo confirma!*", "",
    `🏷️ *Codigo de pedido:* ${ticket||num(o)}`,
    `   _Guarda este codigo para hacer seguimiento_`, "",
    `📦 *Detalle del pedido:*`,
    `*Metodo de pago:* ${o?.paymentMethod === "mercadopago" ? "Mercado Pago" : "Transferencia"}`, "",
    `👤 *Datos del cliente:*`,
    `*Nombre:* ${o?.buyer?.nombre||"-"}`,
    `*Telefono:* ${o?.buyer?.telefono||"-"}`, "",
    `🚚 *Entrega:* ${envio?"Envio a domicilio":"Retiro en local"}`,
    ...(envio?[`*Direccion:* ${adr(o?.shipping?.address||{})}`]:[]), "",
    `🛒 *Productos:*`, lines||"—", "",
    `💰 *Total:* ${$m(o.total)}`,
    "",
    `Segui tu pedido aqui: https://aestheticmakeup.com.ar/pago/paid?orderId=${o._id}`,
    "",
    "Gracias por tu compra! Ante cualquier consulta estamos a tu disposicion 🌸",
  ].join("\n");
};

/* ── Timeline de la orden (visual, derivado de los datos existentes) ── */
function OrderTimeline({ order }) {
  const steps = [
    { label: "Pedido creado", date: order?.createdAt, done: true },
    { label: "Pago confirmado", date: order?.status === "paid" || order?.status === "shipped" || order?.status === "delivered" ? order?.updatedAt : null, done: ["paid","shipped","delivered"].includes(order?.status) },
    { label: "Despachado / listo para retirar", date: order?.shipping?.shippedAt, done: Boolean(order?.shipping?.shippedAt) },
    { label: "Entregado / retirado", date: order?.shipping?.deliveredAt, done: Boolean(order?.shipping?.deliveredAt) },
  ];
  return (
    <ol className="ao-timeline">
      {steps.map((s, i) => (
        <li key={i} className={`ao-timeline-step ${s.done ? "done" : ""}`}>
          <span className="ao-timeline-dot" />
          <div>
            <strong>{s.label}</strong>
            <small>{s.date ? new Date(s.date).toLocaleString("es-AR") : "—"}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TrackModal({ order, onClose, onConfirm }) {
  const [tn, setTn] = useState(order?.shipping?.trackingNumber || "");
  const [co, setCo] = useState(order?.shipping?.company || "andreani");
  return (
    <Modal
      open
      title="Despachar pedido"
      subtitle={`Pedido: ${order?.orderNumber ? `#${order.orderNumber}` : order?.shippingTicket || "—"}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(tn, co)}><TruckIcon size={15} /> Confirmar despacho</Button>
        </>
      }
    >
      <div className="ao-confirm-box">
        {order?.shippingTicket && (
          <div className="ao-copy-row">
            <span><b>Código:</b> {order.shippingTicket}</span>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(order.shippingTicket)}>
              <CopyIcon size={14} /> Copiar
            </Button>
          </div>
        )}
        <div><b>Cliente:</b> {order?.buyer?.nombre || "—"}</div>
      </div>

      <div className="ao-field-row">
        <label className="ui-label">Empresa de envío</label>
        <div className="ao-company-chips">
          {["andreani", "oca", "correo argentino", "via cargo", "fadeeac"].map((emp) => (
            <button
              key={emp}
              type="button"
              onClick={() => setCo(emp)}
              className={`pf-choice ${co === emp ? "active" : ""}`}
              style={{ textTransform: "capitalize" }}
            >
              {emp}
            </button>
          ))}
        </div>
        <Input placeholder="O escribí otra empresa..." value={co} onChange={(e) => setCo(e.target.value)} />
      </div>

      <div className="ao-field-row">
        <label className="ui-label">Número de tracking <span className="ui-hint">(opcional)</span></label>
        <Input placeholder="Ej: 12345678901" value={tn} onChange={(e) => setTn(e.target.value)} />
        {tn && co.toLowerCase().includes("andreani") && (
          <a href={`https://www.andreani.com/#!/informacion-de-envio/${tn}`} target="_blank" rel="noreferrer" className="ao-verify-link">
            Verificar en Andreani ↗
          </a>
        )}
        {tn && co.toLowerCase().includes("oca") && (
          <a href={`https://www.oca.com.ar/OcaWebNet/FeChequeoEnvio/ChequeoSinLogin.aspx`} target="_blank" rel="noreferrer" className="ao-verify-link">
            Verificar en OCA ↗
          </a>
        )}
      </div>
    </Modal>
  );
}

export default function AdminOrders() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem("ADMIN_SECRET") || "");
  const [iSec,   setISec]   = useState("");
  const [orders, setOrders] = useState([]);
  const [tab,    setTab]    = useState("pending");
  const [load,   setLoad]   = useState(false);
  const [autoR,  setAutoR]  = useState(true);
  const [msg,    setMsg]    = useState({ text: "", ok: false });
  const [detail, setDetail] = useState(null);
  const [actM,   setActM]   = useState({ open: false, type: null, order: null, loading: false });
  const [delM,   setDelM]   = useState({ open: false, order: null, loading: false });
  const [waM,    setWaM]    = useState({ open: false, link: null, order: null });
  const [trackM, setTrackM] = useState({ open: false, order: null });
  const [timeFilter, setTimeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const closeWaM = () => setWaM({ open: false, link: null, order: null });

  const setOk = (text) => setMsg({ text, ok: true });
  const setErr = (text) => setMsg({ text, ok: false });

  const fetch_ = async () => {
    if (!secret) return;
    setLoad(true);
    try {
      const u = new URL(`${API_URL}/api/payments/orders`);
      if (tab) u.searchParams.set("status", tab);
      const r = await fetch(u, { headers: { "x-admin-secret": secret } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      setOrders(d.orders || []); setMsg({ text: "", ok: false });
    } catch (e) {
      setErr(e.message);
      setOrders([]);
    } finally {
      setLoad(false);
    }
  };

  useEffect(() => {
    fetch_();
    if (!secret || !autoR) return;
    const id = setInterval(fetch_, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [secret, tab, autoR]);

  const login = (e) => {
    e.preventDefault(); if (!iSec.trim()) return;
    sessionStorage.setItem("ADMIN_SECRET", iSec.trim());
    setSecret(iSec.trim()); setISec(""); setTimeout(fetch_, 150);
  };
  const logout = () => {
    sessionStorage.removeItem("ADMIN_SECRET");
    setSecret(""); setOrders([]); setDetail(null);
  };

  const openAct  = (type, order) => setActM({ open: true, type, order, loading: false });
  const closeAct = () => setActM({ open: false, type: null, order: null, loading: false });
  const openDel  = (order) => setDelM({ open: true, order, loading: false });
  const closeDel = () => setDelM({ open: false, order: null, loading: false });

  const doAction = async () => {
    if (!secret || !actM.order) return;
    const { type, order } = actM;
    setActM(m => ({ ...m, loading: true }));
    try {
      const ep = type === "confirm"
        ? `${API_URL}/api/payments/order/${order._id}/confirm`
        : `${API_URL}/api/payments/order/${order._id}/reject`;
      const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret }, body: "{}" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      if (type === "confirm") {
        setOk("Orden confirmada y notificada");
        setOrders(a => a.map(o => o._id === order._id ? { ...o, status: "paid" } : o));
        if (detail?._id === order._id) setDetail(x => ({ ...x, status: "paid" }));
        const lnk = d?.whatsappLink || (ADMIN_WA ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(waTxt({ ...order, status: "paid" }))}` : null);
        if (lnk) setWaM({ open: true, link: lnk, order: { ...order, status: "paid" } });
      } else {
        setOk("Orden rechazada");
        setOrders(a => a.map(o => o._id === order._id ? { ...o, status: "cancelled" } : o));
        if (detail?._id === order._id) setDetail(x => ({ ...x, status: "cancelled" }));
      }
      closeAct();
    } catch (e) { setErr(e.message); setActM(m => ({ ...m, loading: false })); }
  };

  const doDelPerm = async () => {
    if (!secret || !delM.order) return;
    setDelM(m => ({ ...m, loading: true }));
    try {
      const r = await fetch(`${API_URL}/api/payments/order/${delM.order._id}/permanent`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      setOrders(a => a.filter(o => o._id !== delM.order._id));
      if (detail?._id === delM.order._id) setDetail(null);
      setOk("Orden eliminada permanentemente");
      closeDel();
    } catch (e) { setErr(e.message); setDelM(m => ({ ...m, loading: false })); }
  };

  const doDel = async () => {
    if (!secret || !delM.order) return;
    setDelM(m => ({ ...m, loading: true }));
    try {
      const r = await fetch(`${API_URL}/api/payments/order/${delM.order._id}`, { method: "DELETE", headers: { "x-admin-secret": secret } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      setOrders(a => a.map(o => o._id === delM.order._id ? { ...o, status: "deleted" } : o));
      if (detail?._id === delM.order._id) setDetail(null);
      setOk("Orden eliminada — aparece en tab 'Eliminadas'");
      closeDel();
      setTimeout(() => fetch_(), 300);
    } catch (e) { setErr(e.message); setDelM(m => ({ ...m, loading: false })); }
  };

  const doShip = async (order, tn = "", co = "") => {
    const isRetiro = order?.shipping?.method === "retiro";
    const mt = order?.shipping?.method || "envio";
    try {
      setLoad(true);
      const r = await fetch(`${API_URL}/api/payments/order/${order._id}/ship`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ trackingNumber: tn || undefined, company: co || undefined, method: mt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      setOrders(a => a.map(o => o._id === order._id ? { ...o, shipping: d.shipping } : o));
      if (detail?._id === order._id) setDetail(x => ({ ...x, shipping: d.shipping }));
      setOk(isRetiro ? "Pedido marcado como listo para retirar" : "Pedido despachado");
    } catch (e) { setErr(e.message); }
    finally { setLoad(false); }
  };

  const doDeliv = async (order) => {
    try {
      setLoad(true);
      const r = await fetch(`${API_URL}/api/payments/order/${order._id}/delivered`, { method: "POST", headers: { "x-admin-secret": secret } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      setOk("Pedido entregado");
      setOrders(a => a.map(o => o._id === order._id ? { ...o, shipping: d.shipping } : o));
      if (detail?._id === order._id) setDetail(x => ({ ...x, shipping: d.shipping }));
    } catch (e) { setErr(e.message); }
    finally { setLoad(false); }
  };

  const rows = useMemo(() => {
    let filtered = tab ? orders.filter(o => o.status === tab) : orders;
    if (timeFilter !== "all") {
      let cutoff;
      if (timeFilter === "today") {
        cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
      } else {
        const days = { "7d": 7, "14d": 14, "1m": 30, "3m": 90, "6m": 180, "12m": 365 };
        cutoff = new Date(Date.now() - days[timeFilter] * 86400000);
      }
      filtered = filtered.filter(o => new Date(o.createdAt) >= cutoff);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(o =>
        (o.shippingTicket || "").toLowerCase().includes(q) ||
        String(o.orderNumber || "").includes(q) ||
        (o?.buyer?.nombre || "").toLowerCase().includes(q) ||
        (o?.buyer?.telefono || "").includes(q)
      );
    }
    return filtered;
  }, [orders, tab, timeFilter, search]);

  const OrderActions = ({ o, compact = false }) => {
    const envio = o?.shipping?.method === "envio";
    const isRetiro = o?.shipping?.method === "retiro";
    const canShip   = o.status === "paid" && !o?.shipping?.shippedAt && envio;
    const canRetiro = o.status === "paid" && !o?.shipping?.shippedAt && isRetiro;
    const canRetirado = o.status === "paid" && !!o?.shipping?.shippedAt && !o?.shipping?.deliveredAt && isRetiro;
    const canDeliv  = o.status === "paid" && !o?.shipping?.deliveredAt && envio && !!o?.shipping?.trackingNumber;
    return (
      <div className={`ao-actions ${compact ? "ao-actions--compact" : ""}`}>
        <Button size="sm" variant="secondary" onClick={() => setDetail(o)} title="Ver detalle">
          <EyeIcon size={14} /> Ver
        </Button>
        {o.status === "pending" && (
          <>
            <Button size="sm" variant="primary" onClick={() => openAct("confirm", o)}>
              <CheckIcon size={14} /> Confirmar
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => openAct("reject", o)}>
              <XIcon size={14} /> Rechazar
            </Button>
          </>
        )}
        {canShip && <Button size="sm" variant="secondary" onClick={() => setTrackM({ open: true, order: o })}><TruckIcon size={14} /> Despachar</Button>}
        {canRetiro && <Button size="sm" variant="secondary" onClick={() => doShip(o)}>Listo para retirar</Button>}
        {canRetirado && <Button size="sm" variant="secondary" onClick={() => doDeliv(o)}><CheckIcon size={14} /> Retirado</Button>}
        {canDeliv && <Button size="sm" variant="secondary" onClick={() => doDeliv(o)}><CheckIcon size={14} /> Entregado</Button>}
        {o.status === "paid" && (
          <Button size="sm" variant="gold" onClick={() => { const lnk = ADMIN_WA ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(waTxt(o))}` : null; setWaM({ open: true, link: lnk, order: o }); }} title="Notificar por WhatsApp">
            <WhatsAppIcon size={14} /> WA
          </Button>
        )}
        <Button size="sm" variant="danger-ghost" onClick={() => openDel(o)}>
          <TrashIcon size={14} /> Eliminar
        </Button>
      </div>
    );
  };

  /* ── LOGIN (clave de admin) ── */
  if (!secret) {
    return (
      <div className="ao-login-page">
        <Card pad className="ao-login-card">
          <div className="ao-login-head">
            <span className="ao-login-icon"><LockIcon size={22} /></span>
            <h2 className="ui-card-title">Órdenes</h2>
            <p className="ui-card-sub">Ingresá tu clave de administradora para ver y gestionar los pedidos.</p>
          </div>
          <form onSubmit={login} className="ui-stack">
            <Input
              type="password"
              placeholder="Clave de administrador"
              value={iSec}
              onChange={(e) => setISec(e.target.value)}
              autoFocus
            />
            <Button type="submit" loading={load} disabled={!iSec.trim()}>
              Entrar al panel
            </Button>
          </form>
          {msg.text && (
            <div className={`ui-banner ${msg.ok ? "ui-banner--success" : "ui-banner--danger"}`} role="alert">
              {msg.text}
            </div>
          )}
        </Card>
      </div>
    );
  }

  /* ── MAIN ── */
  return (
    <div className="ao-page">
      <div className="ao-head">
        <div className="ao-head-left">
          <div className="ui-row">
            <ShoppingBagIcon size={22} />
            <h2 className="ui-page-title">Órdenes</h2>
          </div>
          <p className="ao-head-sub">
            {rows.length} resultado{rows.length !== 1 ? "s" : ""}
            {load && <span className="ao-loading-note"> · actualizando…</span>}
          </p>
        </div>
        <div className="ui-row">
          <label className="st-check">
            <input type="checkbox" checked={autoR} onChange={(e) => setAutoR(e.target.checked)} />
            Auto-refrescar
          </label>
          <Button size="sm" variant="ghost" onClick={fetch_} title="Actualizar">
            <RefreshIcon size={15} />
          </Button>
          <Button size="sm" variant="danger-ghost" onClick={logout}>
            <LogoutIcon size={15} /> Salir
          </Button>
        </div>
      </div>

      <Tabs
        variant="pill"
        active={tab}
        onChange={setTab}
        items={TABS.map((t) => ({ key: t.v, label: t.lbl, icon: t.ico }))}
      />

      <div className="ao-filters">
        <div className="ao-time-filters">
          {[
            { v: "all", lbl: "Todos" },
            { v: "today", lbl: "Hoy" },
            { v: "7d", lbl: "7 días" },
            { v: "14d", lbl: "14 días" },
            { v: "1m", lbl: "1 mes" },
            { v: "3m", lbl: "3 meses" },
            { v: "6m", lbl: "6 meses" },
            { v: "12m", lbl: "12 meses" },
          ].map((f) => (
            <button key={f.v} type="button"
              className={`pf-choice ${timeFilter === f.v ? "active" : ""}`}
              onClick={() => setTimeFilter(f.v)}>
              {f.lbl}
            </button>
          ))}
        </div>
        <Input
          type="text"
          placeholder="Buscar por ticket, número, cliente o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={search ? (
            <button className="ao-search-clear" onClick={() => setSearch("")} type="button" aria-label="Limpiar búsqueda">
              <XIcon size={14} />
            </button>
          ) : <SearchIcon size={16} />}
        />
      </div>

      {msg.text && (
        <div className={`ui-banner ${msg.ok ? "ui-banner--success" : "ui-banner--danger"}`} role="status">
          {msg.text}
        </div>
      )}

      {!rows.length ? (
        <EmptyState
          icon={<InboxIcon size={24} />}
          title="No hay órdenes en esta sección"
          description="Cuando lleguen pedidos nuevos los vas a ver acá."
        />
      ) : (
        <>
          {/* CARDS MÓVIL */}
          <div className="ao-cards">
            {rows.map((o) => {
              const d = new Date(o.createdAt);
              const envio = o?.shipping?.method === "envio";
              return (
                <Card key={o._id} className="ao-card">
                  <div className="ao-card-top">
                    <div>
                      <div className="ao-card-num">{num(o)}</div>
                      {o.shippingTicket && <span className="ao-card-ticket">{o.shippingTicket}</span>}
                    </div>
                    <div className="ao-card-right">
                      <StatusBadge s={o.status} />
                      <div className="ao-card-ts">{fd(d)} · {ft(d)}</div>
                    </div>
                  </div>
                  <div className="ao-card-grid">
                    <div className="ao-kv">
                      <span className="ao-kv-k">Cliente</span>
                      <span className="ao-kv-v">{o?.buyer?.nombre || "—"}</span>
                    </div>
                    <div className="ao-kv">
                      <span className="ao-kv-k">Teléfono</span>
                      <span className="ao-kv-v ao-kv-v-mono">{o?.buyer?.telefono || "—"}</span>
                    </div>
                    <div className="ao-kv">
                      <span className="ao-kv-k">Método de pago</span>
                      <span className="ao-kv-v"><PayBadge method={o.paymentMethod} /></span>
                    </div>
                    <div className="ao-kv">
                      <span className="ao-kv-k">Total</span>
                      <span className="ao-kv-v ao-kv-v-total">{$m(o.total)}</span>
                    </div>
                    <div className="ao-kv ao-kv-full">
                      <span className="ao-kv-k">Entrega</span>
                      <span className="ao-kv-v">
                        {envio ? `Envío — ${adr(o?.shipping?.address)}` : "Retiro en local"}
                      </span>
                    </div>
                    {o?.shipping?.trackingNumber && (
                      <div className="ao-kv ao-kv-full">
                        <span className="ao-kv-k">Tracking</span>
                        <span className="ao-kv-v ao-kv-v-mono">{o.shipping.trackingNumber}</span>
                      </div>
                    )}
                  </div>
                  <OrderActions o={o} />
                </Card>
              );
            })}
          </div>

          {/* TABLA DESKTOP */}
          <div className="ui-table-wrap">
            <table className="ui-table ao-table" role="table" aria-label="Órdenes">
              <thead>
                <tr>
                  <th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Teléfono</th>
                  <th>Método</th><th>Estado</th><th style={{ textAlign: "right" }}>Total</th>
                  <th>Entrega</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const d = new Date(o.createdAt);
                  const envio = o?.shipping?.method === "envio";
                  return (
                    <tr key={o._id}>
                      <td>
                        <div className="ao-cell-main">{fd(d)}</div>
                        <div className="ao-cell-sub">{ft(d)}</div>
                      </td>
                      <td>
                        <div className="ao-cell-num">{num(o)}</div>
                        {o.shippingTicket && <span className="ao-card-ticket">{o.shippingTicket}</span>}
                        <div className="ao-cell-id">
                          <span>…{shrt(o._id)}</span>
                          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(o._id)} title="Copiar ID">
                            <CopyIcon size={12} />
                          </Button>
                        </div>
                      </td>
                      <td>
                        <div className="ao-cell-name">{o?.buyer?.nombre || "—"}</div>
                        <div className="ao-cell-sub">{o?.buyer?.email || ""}</div>
                      </td>
                      <td className="ao-cell-mono">{o?.buyer?.telefono || "—"}</td>
                      <td><PayBadge method={o.paymentMethod} /></td>
                      <td><StatusBadge s={o.status} /></td>
                      <td style={{ textAlign: "right" }}><span className="ao-cell-total">{$m(o.total)}</span></td>
                      <td>
                        <div className="ao-cell-main">{envio ? "Envío" : "Retiro"}</div>
                        <div className="ao-cell-sub">{envio ? adr(o?.shipping?.address) : "Coordinamos por WhatsApp"}</div>
                        {o?.shipping?.trackingNumber && <span className="ao-track-pill">{o.shipping.trackingNumber}</span>}
                        {o?.shipping?.deliveredAt && (
                          <div className="ao-cell-sub">Entregado: {new Date(o.shipping.deliveredAt).toLocaleDateString("es-AR")}</div>
                        )}
                      </td>
                      <td><OrderActions o={o} compact /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL DETALLE */}
      <Modal
        open={Boolean(detail)}
        wide
        title={`Pedido ${detail?.shippingTicket || num(detail)}`}
        onClose={() => setDetail(null)}
        footer={
          <>
            {detail?.buyer?.telefono && (
              <Button variant="gold" onClick={() => {
                const msg = `¡Hola ${detail?.buyer?.nombre}! 👋\n\nRecibimos tu pedido en *Aesthetic* y lo estamos revisando.\n\n🏷 *Código de pedido:* ${num(detail)}\n💰 *Total:* ${$m(detail.total)}\n\nEn breve te confirmamos y comenzamos a prepararlo. Ante cualquier consulta estamos a tu disposición 🌸`;
                navigator.clipboard.writeText(msg);
                window.open(`https://wa.me/${tel(detail?.buyer?.telefono)}`, "_blank");
              }}>
                <WhatsAppIcon size={15} /> Avisar al cliente
              </Button>
            )}
            {detail?.status === "pending" && (
              <>
                <Button onClick={() => openAct("confirm", detail)}><CheckIcon size={15} /> Confirmar</Button>
                <Button variant="danger-ghost" onClick={() => openAct("reject", detail)}><XIcon size={15} /> Rechazar</Button>
              </>
            )}
            <Button variant="danger-ghost" onClick={() => { setDetail(null); openDel(detail); }}>
              <TrashIcon size={15} /> Eliminar
            </Button>
          </>
        }
      >
        {detail && (
          <div className="ao-detail">
            <div className="ao-confirm-box">
              <div><b>Estado:</b> <StatusBadge s={detail.status} /></div>
              <div><b>Total:</b> {$m(detail.total)}</div>
              <div><b>Método de pago:</b> <PayBadge method={detail.paymentMethod} /></div>
            </div>

            <div className="ao-confirm-box">
              <div><b>Cliente:</b> {detail?.buyer?.nombre || "—"}</div>
              <div><b>Email:</b> {detail?.buyer?.email || "—"}</div>
              <div><b>Teléfono:</b> {detail?.buyer?.telefono || "—"}</div>
            </div>

            <div className="ao-confirm-box">
              <div>
                <b>Entrega:</b>{" "}
                {detail?.shipping?.method === "envio" ? "Envío a domicilio" : "Retiro en local"}
              </div>
              {detail?.shipping?.method === "envio" && (
                <div><b>Dirección:</b> {adr(detail?.shipping?.address)}</div>
              )}
              {detail?.shipping?.trackingNumber && (
                <div><b>Tracking:</b> <span className="ao-cell-mono">{detail.shipping.trackingNumber}</span></div>
              )}
            </div>

            <div className="ao-confirm-box">
              <b>Línea de tiempo</b>
              <OrderTimeline order={detail} />
            </div>

            <div className="ao-confirm-box">
              <b>Detalle completo del pedido</b>
              <div className="ao-items">
                {(detail.items || []).map((it, i) => {
                  const precioUnit = it.cantidad ? it.subtotal / it.cantidad : 0;
                  return (
                    <div key={i} className="ao-item">
                      <div className="ao-item-head">
                        <span>{it.nombre}</span>
                        {(it?.variant?.size || it?.variant?.color || it?.variant?.tono) && (
                          <small>
                            ({[it?.variant?.size, it?.variant?.color, it?.variant?.tono].filter(Boolean).join(" / ")})
                          </small>
                        )}
                      </div>
                      <div className="ao-item-row">
                        <span>Unitario: <b>{$m(precioUnit)}</b></span>
                        <span>Cantidad total: <b>{it.cantidad}</b></span>
                        <span>Subtotal: <b>{$m(it.subtotal)}</b></span>
                      </div>
                      {Array.isArray(it.distribucionTonos) && it.distribucionTonos.length > 0 && (
                        <div className="ao-tonos">
                          <span className="ao-tonos-title">Distribución de tonos</span>
                          <div className="ao-tonos-list">
                            {it.distribucionTonos.map((t, j) => (
                              <span key={j} className="ao-tono-chip">
                                {t.tono}: <b>{t.cantidad}</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL CONFIRMAR/RECHAZAR */}
      <Modal
        open={actM.open}
        title={actM.type === "reject" ? "Rechazar orden" : "Confirmar pago"}
        onClose={actM.loading ? undefined : closeAct}
        footer={
          <>
            <Button variant="secondary" onClick={closeAct} disabled={actM.loading}>Cancelar</Button>
            {actM.type === "reject" ? (
              <Button variant="danger" onClick={doAction} disabled={actM.loading} loading={actM.loading}>
                {actM.loading ? "Procesando…" : "Rechazar"}
              </Button>
            ) : (
              <Button onClick={doAction} disabled={actM.loading} loading={actM.loading}>
                {actM.loading ? "Procesando…" : "Confirmar pago"}
              </Button>
            )}
          </>
        }
      >
        <p className="ao-modal-text">
          {actM.type === "reject"
            ? "Esta acción cancelará la orden permanentemente."
            : "Vas a marcar esta orden como pagada. Se descuenta stock y se notifica al cliente."}
        </p>
        <div className="ao-confirm-box ao-confirm-box--danger">
          <div><b>Pedido:</b> {num(actM.order)}</div>
          <div><b>Cliente:</b> {actM.order?.buyer?.nombre || "—"}</div>
          <div><b>Total:</b> {$m(actM.order?.total)}</div>
        </div>
      </Modal>

      {/* MODAL ELIMINAR */}
      <Modal
        open={delM.open}
        title="Eliminar orden"
        onClose={delM.loading ? undefined : closeDel}
        footer={
          <>
            <Button variant="secondary" onClick={closeDel} disabled={delM.loading}>Cancelar</Button>
            {delM.order?.status === "deleted" ? (
              <Button variant="danger" onClick={doDelPerm} disabled={delM.loading} loading={delM.loading}>
                {delM.loading ? "Eliminando…" : "Eliminar para siempre"}
              </Button>
            ) : (
              <Button variant="danger" onClick={doDel} disabled={delM.loading} loading={delM.loading}>
                {delM.loading ? "Eliminando…" : "Sí, eliminar"}
              </Button>
            )}
          </>
        }
      >
        <p className="ao-modal-text">Esta acción no se puede deshacer.</p>
        <div className="ao-confirm-box ao-confirm-box--danger">
          <div><b>Pedido:</b> {num(delM.order)}</div>
          <div><b>Cliente:</b> {delM.order?.buyer?.nombre || "—"}</div>
          <div><b>Estado:</b> <StatusBadge s={delM.order?.status} /></div>
          <div><b>Total:</b> {$m(delM.order?.total)}</div>
        </div>
      </Modal>

      {/* MODAL WHATSAPP */}
      <Modal
        open={waM.open}
        title="Pedido confirmado"
        onClose={closeWaM}
        footer={
          <>
            <Button variant="gold" onClick={() => {
              navigator.clipboard.writeText(waTxt(waM.order));
              window.open(`https://wa.me/${tel(waM.order?.buyer?.telefono)}`, "_blank");
              closeWaM();
            }}>
              <WhatsAppIcon size={15} /> Abrir WhatsApp y pegar mensaje
            </Button>
            <Button variant="secondary" onClick={() => {
              try {
                const txt = decodeURIComponent(waM.link?.split("?text=")[1] || "");
                navigator.clipboard.writeText(txt);
              } catch {
                navigator.clipboard.writeText(waTxt(waM.order));
              }
              closeWaM();
            }}>
              <CopyIcon size={15} /> Copiar y cerrar
            </Button>
            <Button variant="ghost" onClick={closeWaM}>Cerrar</Button>
          </>
        }
      >
        <p className="ao-modal-text">El pedido <b>{num(waM.order)}</b> fue marcado como pagado.</p>
        {waM.order?.shippingTicket && (
          <div className="ao-ticket-box">
            <span className="ao-ticket-label">Código del pedido</span>
            <span className="ao-ticket-value">{waM.order.shippingTicket}</span>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(waM.order.shippingTicket)}>
              <CopyIcon size={14} /> Copiar
            </Button>
          </div>
        )}
        <div className="ao-confirm-box">
          <span className="ao-wa-preview-label">Mensaje para el cliente</span>
          <pre className="ao-wa-preview">{waM.order ? waTxt(waM.order) : ""}</pre>
        </div>
      </Modal>

      {/* MODAL TRACKING */}
      {trackM.open && (
        <TrackModal
          order={trackM.order}
          onClose={() => setTrackM({ open: false, order: null })}
          onConfirm={async (tn, co) => {
            await doShip(trackM.order, tn, co);
            setTrackM({ open: false, order: null });
          }}
        />
      )}
    </div>
  );
}
