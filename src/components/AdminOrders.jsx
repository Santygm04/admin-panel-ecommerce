import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const ADMIN_WA = (import.meta.env.VITE_ADMIN_PHONE || "").replace(/\D/g, "");

/* ── Variantes de botón ─────────────────────────────── */
const BTN = {
  base: "inline-flex items-center justify-content-center rounded-full px-4 py-2.5 text-xs font-black transition-all duration-150 whitespace-nowrap cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed w-full",
  primary: "bg-gradient-to-r from-[#10b981] to-[#22c55e] text-white",
  ghost:   "bg-white text-[#b51775] border border-[#ffd0ea]",
  danger:  "bg-red-500 text-white",
  dangerg: "bg-white text-red-500 border border-red-200",
  sm:      "bg-white text-[#b51775] border border-[#ffd0ea] rounded-lg px-2 py-1 text-[11px] font-black w-auto min-h-0",
};

const badgeCls = {
  pending:   "bg-amber-50 text-orange-800 border border-orange-300",
  paid:      "bg-emerald-50 text-emerald-800 border border-emerald-300",
  cancelled: "bg-red-50 text-red-800 border border-red-300",
};

export default function AdminOrders() {
  const [secret, setSecret]           = useState(() => sessionStorage.getItem("ADMIN_SECRET") || "");
  const [inputSecret, setInputSecret] = useState("");
  const [orders, setOrders]           = useState([]);
  const [statusFilter, setStatusFilter] = useState("paid");
  const [loading, setLoading]         = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage]         = useState("");
  const [detail, setDetail]           = useState(null);
  const [actionModal, setActionModal] = useState({ open: false, type: null, order: null, loading: false });

  /* ── helpers ── */
  const niceMoney  = (n) => typeof n === "number" ? n.toLocaleString("es-AR") : String(n || "");
  const buildAddr  = (a = {}) => [[a.calle, a.numero].filter(Boolean).join(" "), a.piso, a.ciudad, a.provincia, a.cp].filter(Boolean).join(", ");
  const normPhone  = (r)  => r ? String(r).replace(/\D/g, "") : "";
  const shortId    = (id) => id ? String(id).slice(-6).toUpperCase() : "—";
  const prettyOrder= (o)  => o?.orderNumber ? `#${o.orderNumber}` : o?.shippingTicket || `AE-${shortId(o?._id)}`;

  const waText = (o) => {
    const envio = o?.shipping?.method === "envio";
    const lines = (o.items || []).map(it => {
      const vp = it?.variant?.size || it?.variant?.color ? ` (${[it?.variant?.size, it?.variant?.color].filter(Boolean).join(" / ")})` : "";
      return `• ${it.nombre}${vp} x${it.cantidad} — $${niceMoney(it.subtotal)}`;
    }).join("\n");
    return [
      "✅ *Pedido confirmado*", "",
      `*Pedido:* ${prettyOrder(o)}`, `*Estado:* ${o.status}`, `*Pago:* ${o.paymentMethod}`, "",
      `*Cliente:* ${o?.buyer?.nombre || "-"}`, `*Tel:* ${o?.buyer?.telefono || "-"}`, `*Email:* ${o?.buyer?.email || "-"}`, "",
      `*Entrega:* ${envio ? "Envío a domicilio" : "Retiro en local"}`,
      `*Dirección:* ${envio ? buildAddr(o?.shipping?.address || {}) : "—"}`, "",
      `*Productos:*`, lines || "—", "", `*Total:* $${niceMoney(o.total)}`,
    ].join("\n");
  };

  /* ── fetch ── */
  const fetchOrders = async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/payments/orders`);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      const res  = await fetch(url, { headers: { "x-admin-secret": secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No autorizado");
      setOrders(data.orders || []);
      setMessage("");
    } catch (e) {
      setMessage("❌ " + (e.message || "Error cargando órdenes"));
      setOrders([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOrders();
    if (!secret || !autoRefresh) return;
    const id = setInterval(fetchOrders, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret, statusFilter, autoRefresh]);

  const login = (e) => {
    e.preventDefault();
    if (!inputSecret.trim()) return;
    sessionStorage.setItem("ADMIN_SECRET", inputSecret.trim());
    setSecret(inputSecret.trim());
    setInputSecret("");
    setTimeout(fetchOrders, 150);
  };
  const logout = () => { sessionStorage.removeItem("ADMIN_SECRET"); setSecret(""); setOrders([]); setDetail(null); };

  /* ── modales ── */
  const openAction  = (type, order) => setActionModal({ open: true, type, order, loading: false });
  const closeAction = () => setActionModal({ open: false, type: null, order: null, loading: false });

  const handleConfirm = async () => {
    if (!secret || !actionModal.order) return;
    const { type, order } = actionModal;
    try {
      setActionModal(m => ({ ...m, loading: true }));
      const ep  = type === "confirm" ? `${API_URL}/api/payments/order/${order._id}/confirm` : `${API_URL}/api/payments/order/${order._id}/reject`;
      const res  = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error");
      if (type === "confirm") {
        setMessage("✅ Orden confirmada");
        setOrders(a => a.map(o => o._id === order._id ? { ...o, status: "paid" } : o));
        if (detail?._id === order._id) setDetail(d => ({ ...d, status: "paid" }));
        if (data?.whatsappLink) window.open(data.whatsappLink, "_blank", "noopener,noreferrer");
        else if (ADMIN_WA) window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(waText({ ...order, status: "paid" }))}`, "_blank", "noopener,noreferrer");
      } else {
        setMessage("🚫 Orden rechazada");
        setOrders(a => a.map(o => o._id === order._id ? { ...o, status: "cancelled" } : o));
        if (detail?._id === order._id) setDetail(d => ({ ...d, status: "cancelled" }));
      }
      closeAction();
    } catch (e) {
      setMessage("❌ " + (e.message || "Error"));
      setActionModal(m => ({ ...m, loading: false }));
    }
  };

  const markShipped = async (order) => {
    if (!secret || !order) return;
    const tn = window.prompt("Tracking/código (opcional)", order?.shipping?.trackingNumber || "");
    if (!tn && !window.confirm("¿Marcar como DESPACHADO sin tracking?")) return;
    const company = (window.prompt("Compañía (opcional)", order?.shipping?.company || "") || "").trim();
    let method = order?.shipping?.method || "envio";
    const am = window.prompt("Método (envio/retiro)", method);
    if (am === "envio" || am === "retiro") method = am;
    try {
      setLoading(true);
      const res  = await fetch(`${API_URL}/api/payments/order/${order._id}/ship`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret }, body: JSON.stringify({ trackingNumber: tn || undefined, company: company || undefined, method }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error");
      setMessage("📦 Despachado");
      setOrders(a => a.map(o => o._id === order._id ? { ...o, shipping: data.shipping } : o));
      if (detail?._id === order._id) setDetail(d => ({ ...d, shipping: data.shipping }));
    } catch (e) { setMessage("❌ " + e.message); }
    finally { setLoading(false); }
  };

  const markDelivered = async (order) => {
    if (!secret || !order) return;
    try {
      setLoading(true);
      const res  = await fetch(`${API_URL}/api/payments/order/${order._id}/delivered`, { method: "POST", headers: { "x-admin-secret": secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error");
      setMessage("🚚 Entregado");
      setOrders(a => a.map(o => o._id === order._id ? { ...o, shipping: data.shipping } : o));
      if (detail?._id === order._id) setDetail(d => ({ ...d, shipping: data.shipping }));
    } catch (e) { setMessage("❌ " + e.message); }
    finally { setLoading(false); }
  };

  const deleteOrder = async (order) => {
    if (!secret || !order || !window.confirm("¿Eliminar esta orden cancelada?")) return;
    try {
      setLoading(true);
      const res  = await fetch(`${API_URL}/api/payments/order/${order._id}`, { method: "DELETE", headers: { "x-admin-secret": secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error");
      setOrders(a => a.filter(o => o._id !== order._id));
      if (detail?._id === order._id) setDetail(null);
      setMessage("🗑️ Eliminada");
    } catch (e) { setMessage("❌ " + e.message); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => statusFilter ? orders.filter(o => o.status === statusFilter) : orders, [orders, statusFilter]);

  /* ── Acciones de una orden (reutilizable en card y tabla) ── */
  const OrderActions = ({ o, compact = false }) => {
    const canShip    = o.status === "paid" && !o?.shipping?.trackingNumber;
    const canDeliver = o.status === "paid" && !o?.shipping?.deliveredAt && (o?.shipping?.trackingNumber || o?.shipping?.method === "retiro");
    return (
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-2"}`}>
        <button className={`${BTN.base} ${BTN.ghost} w-auto px-3`} onClick={() => setDetail(o)} type="button">Ver</button>
        {o.status === "pending" && <>
          <button className={`${BTN.base} ${BTN.primary} w-auto px-3`} onClick={() => openAction("confirm", o)} type="button">Confirmar</button>
          <button className={`${BTN.base} ${BTN.danger}  w-auto px-3`} onClick={() => openAction("reject",  o)} type="button">Rechazar</button>
        </>}
        {canShip    && <button className={`${BTN.base} ${BTN.ghost}   w-auto px-3`} onClick={() => markShipped(o)}   type="button">📦 Despachar</button>}
        {canDeliver && <button className={`${BTN.base} ${BTN.ghost}   w-auto px-3`} onClick={() => markDelivered(o)} type="button">✅ Entregado</button>}
        {o.status === "cancelled" && <button className={`${BTN.base} ${BTN.dangerg} w-auto px-3`} onClick={() => deleteOrder(o)} type="button">🗑 Eliminar</button>}
      </div>
    );
  };

  /* ── login ── */
  if (!secret) return (
    <div className="flex justify-center p-4 bg-[#fff7fb] min-h-screen">
      <div className="w-full max-w-md bg-white border border-[#ffe0f0] rounded-2xl p-5 shadow-[0_12px_28px_rgba(255,46,166,0.08)]">
        <h2 className="text-[#ff2ea6] font-black text-xl mb-4">Órdenes</h2>
        <form onSubmit={login} className="flex flex-col gap-3">
          <input className="w-full h-11 rounded-xl border border-[#f4c5df] px-3 outline-none text-sm" placeholder="ADMIN_SECRET" value={inputSecret} onChange={e => setInputSecret(e.target.value)} />
          <button className={`${BTN.base} ${BTN.primary}`} type="submit">Entrar</button>
        </form>
        {message && <p className="mt-3 text-[#b51775] font-bold text-sm">{message}</p>}
        <Link to="/dashboard" className={`${BTN.base} ${BTN.ghost} mt-3`}>← Volver al panel</Link>
      </div>
    </div>
  );

  /* ── principal ── */
  return (
    <div className="flex justify-center px-3 py-4 bg-[#fff7fb] min-h-screen sm:px-4">
      <div className="w-full max-w-[1180px] bg-white border border-[#ffe0f0] rounded-2xl p-4 shadow-[0_12px_28px_rgba(255,46,166,0.08)]" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>

        {/* Header */}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-[#ff2ea6] font-black text-xl m-0">🧾 Órdenes</h2>

          {/* Controles: 1 col móvil → fila sm+ */}
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <Link to="/dashboard" className={`${BTN.base} ${BTN.ghost} sm:w-auto`}>← Panel</Link>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto h-10 rounded-xl border border-[#f4c5df] px-3 text-sm outline-none">
              <option value="pending">Pendientes</option>
              <option value="paid">Pagadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="">Todas</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-[#ff2ea6]" />
              Auto
            </label>
            <button onClick={fetchOrders} className={`${BTN.base} ${BTN.ghost} sm:w-auto`} type="button">↻ Actualizar</button>
            <button onClick={logout}      className={`${BTN.base} ${BTN.dangerg} sm:w-auto`} type="button">Salir</button>
          </div>
        </div>

        {message && <div className="mb-3 px-3 py-2.5 bg-[#fdf2f8] text-[#9d174d] border border-[#f9a8d4] rounded-xl text-sm font-bold">{message}</div>}
        {loading  && <p className="text-gray-400 text-sm mb-2">Cargando…</p>}

        {!filtered.length ? (
          <p className="text-gray-400 text-sm">No hay órdenes para mostrar.</p>
        ) : (<>

          {/* ── CARDS: visible < 900px ── */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map(o => {
              const d    = new Date(o.createdAt);
              const envio= o?.shipping?.method === "envio";
              return (
                <div key={o._id} className="border border-[#ffe0f0] rounded-2xl p-3 bg-white shadow-[0_6px_16px_rgba(255,46,166,0.06)]">
                  {/* id + badge + fecha */}
                  <div className="flex justify-between items-start gap-2 mb-3 flex-wrap">
                    <div>
                      <p className="font-black text-[#ff2ea6] text-base m-0 leading-tight">{prettyOrder(o)}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black border mt-1 ${badgeCls[o.status] || ""}`}>{o.status}</span>
                    </div>
                    <div className="text-gray-400 text-xs text-right">
                      {d.toLocaleDateString()}<br />{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  {/* datos en 2 col */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs mb-3">
                    {[
                      ["Cliente",    o?.buyer?.nombre || "—"],
                      ["Teléfono",   o?.buyer?.telefono || "—"],
                      ["Pago",       o.paymentMethod || "—"],
                      ["Total",      `$${niceMoney(o.total)}`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-gray-400 font-bold uppercase tracking-wide text-[10px] m-0">{k}</p>
                        <p className={`font-semibold m-0 ${k === "Total" ? "text-emerald-700 font-black text-sm" : "text-gray-800"}`}>{v}</p>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <p className="text-gray-400 font-bold uppercase tracking-wide text-[10px] m-0">Entrega</p>
                      <p className="font-semibold text-gray-800 m-0">{envio ? `Envío — ${buildAddr(o?.shipping?.address || {})}` : "Retiro en local"}</p>
                    </div>
                    {o?.shipping?.trackingNumber && (
                      <div className="col-span-2">
                        <p className="text-gray-400 font-bold uppercase tracking-wide text-[10px] m-0">Tracking</p>
                        <p className="font-mono text-gray-700 text-xs m-0">{o.shipping.trackingNumber}</p>
                      </div>
                    )}
                  </div>

                  <OrderActions o={o} />
                </div>
              );
            })}
          </div>

          {/* ── TABLA: visible ≥ lg ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2" style={{ minWidth: 920 }}>
              <thead>
                <tr>{["Fecha","Pedido","Cliente","Teléfono","Método","Estado","Total","Entrega","Acciones"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[#b51775] font-black text-xs">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const d    = new Date(o.createdAt);
                  const envio= o?.shipping?.method === "envio";
                  return (
                    <tr key={o._id}>
                      {[
                        <td key="f" className="bg-white border border-[#ffe0f0] rounded-l-xl px-3 py-3 text-xs align-top">
                          <div className="whitespace-nowrap">{d.toLocaleDateString()}</div>
                          <div className="whitespace-nowrap text-gray-400">{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </td>,
                        <td key="p" className="bg-white border-y border-[#ffe0f0] px-3 py-3 text-xs align-top">
                          <div className="font-bold break-words">{prettyOrder(o)}</div>
                          <div className="text-gray-400 font-mono text-[10px] break-all">{o._id}</div>
                          <button className={BTN.sm} onClick={() => navigator.clipboard.writeText(o._id)} type="button">Copiar</button>
                        </td>,
                        <td key="c" className="bg-white border-y border-[#ffe0f0] px-3 py-3 text-xs align-top">{o?.buyer?.nombre || "-"}</td>,
                        <td key="t" className="bg-white border-y border-[#ffe0f0] px-3 py-3 text-xs align-top font-mono">{o?.buyer?.telefono || "-"}</td>,
                        <td key="m" className="bg-white border-y border-[#ffe0f0] px-3 py-3 text-xs align-top">{o.paymentMethod}</td>,
                        <td key="s" className="bg-white border-y border-[#ffe0f0] px-3 py-3 text-xs align-top">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black border ${badgeCls[o.status] || ""}`}>{o.status}</span>
                        </td>,
                        <td key="$" className="bg-white border-y border-[#ffe0f0] px-3 py-3 text-xs align-top text-right font-bold">${niceMoney(o.total)}</td>,
                        <td key="e" className="bg-white border-y border-[#ffe0f0] px-3 py-3 text-xs align-top break-words max-w-[180px]">
                          <div className="font-bold">{envio ? "Envío" : "Retiro"}</div>
                          <div className="text-gray-400">{envio ? buildAddr(o?.shipping?.address) : "Coordinamos por WhatsApp"}</div>
                          {o?.shipping?.trackingNumber && <div className="text-gray-400 font-mono text-[10px]">Track: {o.shipping.trackingNumber}</div>}
                          {o?.shipping?.deliveredAt    && <div className="text-gray-400">Entregado: {new Date(o.shipping.deliveredAt).toLocaleString()}</div>}
                        </td>,
                        <td key="a" className="bg-white border border-[#ffe0f0] rounded-r-xl px-3 py-3 text-xs align-top">
                          <OrderActions o={o} compact />
                        </td>,
                      ]}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </div>

      {/* ── Modal Detalle (bottom sheet móvil, centrado desktop) ── */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setDetail(null)}>
          <div className="w-full sm:max-w-[720px] bg-white rounded-t-3xl sm:rounded-2xl border-t-2 sm:border border-[#ffe0f0] shadow-2xl p-4 pb-8 sm:pb-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[#d63384] font-black text-base m-0">Detalle del pedido</h3>
              <button onClick={() => setDetail(null)} className="bg-white border border-[#ffd0ea] rounded-xl px-2.5 py-1 text-[#b51775] font-black text-sm cursor-pointer" type="button">✕</button>
            </div>
            <div className="space-y-1.5 text-sm text-gray-700 mb-4">
              {[
                ["Pedido",   prettyOrder(detail)],
                ["Método",   detail.paymentMethod],
                ["Total",    `$${niceMoney(detail.total)}`],
                ["Cliente",  `${detail?.buyer?.nombre || "-"} — ${detail?.buyer?.email || "-"}`],
                ["Teléfono", detail?.buyer?.telefono || "-"],
                ["Entrega",  detail?.shipping?.method === "envio" ? `Envío — ${buildAddr(detail?.shipping?.address)}` : "Retiro en local"],
              ].map(([k, v]) => <p key={k} className="m-0"><b>{k}:</b> {v}</p>)}
              <p className="m-0"><b>Estado:</b> <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black border ${badgeCls[detail.status] || ""}`}>{detail.status}</span></p>
              {detail?.shipping?.trackingNumber && <p className="m-0 font-mono text-xs"><b>Tracking:</b> {detail.shipping.trackingNumber}</p>}
              {detail?.shipping?.deliveredAt    && <p className="m-0"><b>Entregado:</b> {new Date(detail.shipping.deliveredAt).toLocaleString()}</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="font-bold text-xs text-gray-500 mb-1">Productos:</p>
              <ul className="m-0 pl-4 space-y-1">
                {(detail.items || []).map((it, i) => {
                  const vp = it?.variant?.size || it?.variant?.color ? ` (${[it?.variant?.size, it?.variant?.color].filter(Boolean).join(" / ")})` : "";
                  return <li key={i} className="text-xs text-gray-700">{it.nombre}{vp} x{it.cantidad} — ${niceMoney(it.subtotal)}</li>;
                })}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {detail?.buyer?.telefono && (
                <a href={`https://wa.me/${normPhone(detail.buyer.telefono)}?text=${encodeURIComponent(`Hola ${detail?.buyer?.nombre || ""}, soy AESTHETIC. Tu pedido ${prettyOrder(detail)} está en estado ${detail.status}.`)}`}
                  target="_blank" rel="noreferrer" className={`${BTN.base} ${BTN.ghost}`}>WhatsApp</a>
              )}
              <OrderActions o={detail} />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmación ── */}
      {actionModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeAction}>
          <div className="w-full sm:max-w-[480px] bg-white rounded-t-3xl sm:rounded-2xl border-t-2 sm:border border-[#ffe0f0] shadow-2xl p-4 pb-8 sm:pb-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className={`font-black text-base m-0 mb-2 ${actionModal.type === "reject" ? "text-red-600" : "text-emerald-700"}`}>
              {actionModal.type === "reject" ? "Rechazar orden" : "Confirmar pago"}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {actionModal.type === "reject" ? "Esta acción cancelará la orden. ¿Continuás?" : "Vas a marcar la orden como pagada. ¿Confirmás?"}
            </p>
            <div className="bg-gray-50 rounded-xl p-3 text-sm mb-4 space-y-1">
              <p className="m-0"><b>Pedido:</b> {prettyOrder(actionModal.order)}</p>
              <p className="m-0"><b>Cliente:</b> {actionModal.order?.buyer?.nombre || "-"}</p>
              <p className="m-0"><b>Total:</b> ${niceMoney(actionModal.order?.total)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className={`${BTN.base} ${BTN.ghost}`} onClick={closeAction} disabled={actionModal.loading} type="button">Cancelar</button>
              {actionModal.type === "reject"
                ? <button className={`${BTN.base} ${BTN.danger}`}  onClick={handleConfirm} disabled={actionModal.loading} type="button">{actionModal.loading ? "Procesando…" : "Rechazar"}</button>
                : <button className={`${BTN.base} ${BTN.primary}`} onClick={handleConfirm} disabled={actionModal.loading} type="button">{actionModal.loading ? "Procesando…" : "Confirmar"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}