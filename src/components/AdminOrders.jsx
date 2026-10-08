// AdminOrders.jsx — rediseño con UI kit (misma lógica de negocio)
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Input, Modal, Tabs } from "./ui";
import {
  EyeIcon, CheckIcon, XIcon, TrashIcon, TruckIcon, RefreshIcon, SearchIcon,
  CopyIcon, WhatsAppIcon, ShoppingBagIcon, InboxIcon,
} from "./ui/icons";
import "./AdminOrders.css";
import { API_URL } from "../utils/api";
import { firstProductImage, ProductImage } from "../utils/image";

const ADMIN_WA = "5493855902832";

// Unidades del software que pueden recibir el carrito online.
const ERP_UNIT_LABELS = {
  "aesthetic-santiago": { short: "Santiago", long: "Aesthetic Santiago" },
  "pitukas-mayorista": { short: "Mayorista", long: "Pitukas Mayorista" },
};
const erpUnitShort = (slug) => ERP_UNIT_LABELS[slug]?.short || "software";
const erpUnitLong = (slug) => ERP_UNIT_LABELS[slug]?.long || "el software";

// Nota del estado de la venta en el software (carrito, quitado o cobrado).
// El POS avisa por servicio cuando descarta o cobra el carrito del pedido.
const erpSyncNote = (erpSync) => {
  if (!erpSync) return null;
  if (erpSync.status === "cart") {
    return { text: `Pedido online en carrito · ${erpUnitShort(erpSync.erpUnitSlug)}`, color: "var(--adm-info)" };
  }
  if (erpSync.status === "discarded") {
    return { text: "Se quitó del carrito del POS · se puede reenviar", color: "var(--adm-gold)" };
  }
  if (erpSync.status === "synced") {
    return {
      text: `Cobrada en el POS${erpSync.erpOrderNumber ? ` · venta #${erpSync.erpOrderNumber}` : ""}`,
      color: "var(--adm-success)",
    };
  }
  return null;
};

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
const itemQuantityLabel = (item) => {
  if (item?.saleUnit === "caja") {
    return `${item.saleQuantity || item.cantidadCajas || 0} caja${Number(item.saleQuantity || item.cantidadCajas) === 1 ? "" : "s"} (${item.totalUnits || item.cantidad} u.)`;
  }
  if (item?.saleUnit === "media_caja") {
    return `${item.saleQuantity || 0} media caja${Number(item.saleQuantity) === 1 ? "" : "s"} (${item.totalUnits || item.cantidad} u.)`;
  }
  return Number(item?.packSize) > 1 && Number(item?.packQuantity) > 0
    ? `x${item.totalUnits || item.cantidad}`
    : null;
};

const itemProductId = (item) => String(
  item?.productId?._id || item?.productId ||
  item?.productoId?._id || item?.productoId ||
  item?.producto?._id || item?.idProducto || ""
).trim();
const itemImageKey = (item, index) => itemProductId(item) || String(item?.sku || item?.codigoInterno || item?._id || index).trim();
const catalogItems = (data) => Array.isArray(data) ? data : data?.items || data?.productos || data?.products || [];

const PAGE_SIZE = 20;

function pagerPages(totalPages, current) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
  if (current >= totalPages - 3) return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", current - 1, current, current + 1, "…", totalPages];
}

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
    const boxUnits = Number(it?.unidadesPorCaja) || 0;
     const boxCount = Number(it?.cantidadCajas) || (it?.saleUnit !== "unitario" && it?.precioCaja > 0 && boxUnits > 1 ? it.cantidad / boxUnits : 0);
     const quantityLabel = itemQuantityLabel(it) || (boxCount > 0 ? `${boxCount} caja${boxCount === 1 ? "" : "s"} (${it.cantidad} u.)` : `x${it.cantidad}`);
    return `- ${it.nombre}${vp} ${quantityLabel} --- ${$m(it.subtotal)}${tonosPart}`;
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

function OrderImagePreview({ preview, onClose }) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown, true);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown, true);
      previousFocus?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="ao-image-viewer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <figure
        className="ao-image-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={`Imagen ampliada de ${preview.name}`}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="ao-image-viewer-close"
          onClick={onClose}
          aria-label="Cerrar imagen ampliada"
        >
          <XIcon size={22} />
        </button>
        <img className="ao-image-viewer-photo" src={preview.url} alt={`Foto ampliada de ${preview.name}`} />
        <figcaption>{preview.name}</figcaption>
      </figure>
    </div>,
    document.body
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
  const token = sessionStorage.getItem("aesthetic:token") || "";
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  // La pestaña vive en la URL (?tab=paid): al refrescar o compartir el link
  // se mantiene la sección elegida en lugar de volver al inicio.
  const [tab,    setTab]    = useState(() => {
    const fromUrl = searchParams.get("tab");
    return fromUrl !== null && TABS.some((t) => t.v === fromUrl) ? fromUrl : "pending";
  });
  const [load,   setLoad]   = useState(false);
  const [autoR,  setAutoR]  = useState(true);
  const [msg,    setMsg]    = useState({ text: "", ok: false });
  const [detail, setDetail] = useState(null);
  const [actM,   setActM]   = useState({ open: false, type: null, order: null, loading: false });
  const [delM,   setDelM]   = useState({ open: false, order: null, loading: false });
  const [bulkDelM, setBulkDelM] = useState({ open: false, ids: [], loading: false });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [waM,    setWaM]    = useState({ open: false, link: null, order: null });
  const [trackM, setTrackM] = useState({ open: false, order: null });
  const [timeFilter, setTimeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailProducts, setDetailProducts] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [erpBusyId, setErpBusyId] = useState("");
  const selectAllRef = useRef(null);
  const closeWaM = () => setWaM({ open: false, link: null, order: null });

  const setOk = (text) => setMsg({ text, ok: true });
  const setErr = (text) => setMsg({ text, ok: false });

  const fetch_ = async () => {
    if (!token) return;
    setLoad(true);
    try {
      const u = new URL(`${API_URL}/api/payments/orders`);
      if (tab) u.searchParams.set("status", tab);
      const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
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
    if (!token || !autoR) return;
    const id = setInterval(fetch_, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [token, tab, autoR]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab]);

  // Mantiene la URL sincronizada con la pestaña activa (pending = sin param).
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "pending") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [tab, setSearchParams]);

  useEffect(() => {
    setDetailProducts({});
    if (!detail) return undefined;

    const pendingItems = (detail.items || [])
      .map((item, index) => ({ item, key: itemImageKey(item, index) }))
      .filter(({ item }) => !firstProductImage(item));
    if (!pendingItems.length) return undefined;

    const controller = new AbortController();
    Promise.all(pendingItems.map(async ({ item, key }) => {
      const lookup = String(item?.sku || item?.codigoInterno || item?.nombre || "").trim();
      if (!lookup) return null;

      try {
        const url = new URL(`${API_URL}/api/productos`);
        url.searchParams.set("q", lookup);
        url.searchParams.set("limit", "20");
        url.searchParams.set("admin", "true");
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) return null;

        const products = catalogItems(await response.json());
        const wantedId = itemProductId(item);
        const wantedSku = String(item?.sku || item?.codigoInterno || "").trim().toLowerCase();
        const wantedName = String(item?.nombre || "").trim().toLowerCase();
        const product = products.find((candidate) => wantedId && String(candidate?._id) === wantedId)
          || products.find((candidate) => wantedSku && String(candidate?.sku || candidate?.codigoInterno || "").trim().toLowerCase() === wantedSku)
          || products.find((candidate) => wantedName && String(candidate?.nombre || "").trim().toLowerCase() === wantedName)
          || products[0];
        return product ? [key, product] : null;
      } catch (error) {
        if (error.name === "AbortError") throw error;
        return null;
      }
    }))
      .then((entries) => {
        if (!controller.signal.aborted) setDetailProducts(Object.fromEntries(entries.filter(Boolean)));
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDetailProducts({});
      });

    return () => controller.abort();
  }, [detail?._id, token]);

  useEffect(() => {
    const availableIds = new Set(orders.map((order) => String(order._id)));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [orders]);

  const openAct  = (type, order) => setActM({ open: true, type, order, loading: false });
  const closeAct = () => setActM({ open: false, type: null, order: null, loading: false });
  const openDel  = (order) => setDelM({ open: true, order, loading: false });
  const closeDel = () => setDelM({ open: false, order: null, loading: false });
  const closeBulkDel = () => setBulkDelM({ open: false, ids: [], loading: false });

  const doAction = async () => {
    if (!token || !actM.order) return;
    const { type, order } = actM;
    setActM(m => ({ ...m, loading: true }));
    try {
      const ep = type === "confirm"
        ? `${API_URL}/api/payments/order/${order._id}/confirm`
        : `${API_URL}/api/payments/order/${order._id}/reject`;
      const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" });
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
    if (!token || !delM.order) return;
    setDelM(m => ({ ...m, loading: true }));
    try {
      const r = await fetch(`${API_URL}/api/payments/order/${delM.order._id}/permanent`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      setOrders(a => a.filter(o => o._id !== delM.order._id));
      if (detail?._id === delM.order._id) setDetail(null);
      setOk("Orden eliminada permanentemente");
      closeDel();
    } catch (e) { setErr(e.message); setDelM(m => ({ ...m, loading: false })); }
  };

  const openBulkDel = (ids) => {
    const uniqueIds = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
    if (uniqueIds.length) setBulkDelM({ open: true, ids: uniqueIds, loading: false });
  };

  const doBulkDelete = async () => {
    if (!token || !bulkDelM.ids.length) return;
    const ids = bulkDelM.ids;
    const permanent = tab === "deleted";
    setBulkDelM((current) => ({ ...current, loading: true }));

    const deleteOne = async (id) => {
      const endpoint = permanent
        ? `${API_URL}/api/payments/order/${id}/permanent`
        : `${API_URL}/api/payments/order/${id}`;
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "No se pudo eliminar");
      return id;
    };

    const results = [];
    for (let i = 0; i < ids.length; i += 8) {
      results.push(...await Promise.allSettled(ids.slice(i, i + 8).map(deleteOne)));
    }

    const deletedIds = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failedCount = results.length - deletedIds.length;
    const deletedSet = new Set(deletedIds);

    if (deletedIds.length) {
      setOrders((current) => permanent
        ? current.filter((order) => !deletedSet.has(String(order._id)))
        : current.map((order) => deletedSet.has(String(order._id)) ? { ...order, status: "deleted" } : order));
      setSelectedIds((current) => new Set([...current].filter((id) => !deletedSet.has(id))));
      if (detail?._id && deletedSet.has(String(detail._id))) setDetail(null);
    }

    if (failedCount) {
      setErr(`${deletedIds.length} eliminada${deletedIds.length === 1 ? "" : "s"}; ${failedCount} no se pudo${failedCount === 1 ? "" : "ieron"} eliminar.`);
    } else {
      setOk(permanent
        ? `${deletedIds.length} orden${deletedIds.length === 1 ? "" : "es"} eliminada${deletedIds.length === 1 ? "" : "s"} permanentemente`
        : `${deletedIds.length} orden${deletedIds.length === 1 ? "" : "es"} enviada${deletedIds.length === 1 ? "" : "s"} a Eliminadas`);
    }
    closeBulkDel();
  };

  const doDel = async () => {
    if (!token || !delM.order) return;
    setDelM(m => ({ ...m, loading: true }));
    try {
      const r = await fetch(`${API_URL}/api/payments/order/${delM.order._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
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
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      const r = await fetch(`${API_URL}/api/payments/order/${order._id}/delivered`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Error");
      setOk("Pedido entregado");
      setOrders(a => a.map(o => o._id === order._id ? { ...o, shipping: d.shipping } : o));
      if (detail?._id === order._id) setDetail(x => ({ ...x, shipping: d.shipping }));
    } catch (e) { setErr(e.message); }
    finally { setLoad(false); }
  };

  /* Carga la venta pagada en el carrito del Punto de Venta del software
     (Aesthetic Santiago o Pitukas Mayorista) para que el cajero la cobre. */
  const doErpCart = async (order, unitSlug) => {
    if (!token || !order) return;
    const id = String(order._id);
    setErpBusyId(`${id}:${unitSlug}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const r = await fetch(`${API_URL}/api/payments/order/${id}/erp-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ unitSlug }),
        signal: controller.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d?.erpSync) {
          setOrders((current) => current.map((o) => (String(o._id) === id ? { ...o, erpSync: d.erpSync } : o)));
          if (detail?._id === order._id) setDetail((current) => ({ ...current, erpSync: d.erpSync }));
        }
        const excluded = Array.isArray(d?.excludedItems) ? d.excludedItems : [];
        const extra = excluded.length
          ? ` (${excluded.length} producto${excluded.length === 1 ? "" : "s"} del pedido no está${excluded.length === 1 ? "" : "n"} publicado${excluded.length === 1 ? "" : "s"} en el software: ${excluded.slice(0, 5).map((entry) => entry.nombre || entry.sku).join(", ")}${excluded.length > 5 ? " y más" : ""})`
          : "";
        throw new Error(`${d?.message || "No se pudo cargar el pedido en el carrito del software"}${extra}`);
      }
      const erpSync = d?.erpSync || { status: "cart", erpUnitSlug: unitSlug };
      setOrders((current) => current.map((o) => (String(o._id) === id ? { ...o, erpSync } : o)));
      if (detail?._id === order._id) setDetail((current) => ({ ...current, erpSync }));

      const skipped = Array.isArray(d?.skipped) ? d.skipped : [];
      const excluded = Array.isArray(d?.excludedItems) ? d.excludedItems : [];
      const cancelled = Array.isArray(d?.cancelledOrders) ? d.cancelledOrders : [];
      const restored = Array.isArray(d?.restoredLegacy) ? d.restoredLegacy : [];
      const missing = [
        ...excluded.map((entry) => `${entry.nombre || entry.sku} (${entry.reason || "no entra al software"})`),
        ...skipped.map((entry) => `${entry.sku} (no está en esa unidad)`),
      ];
      if (missing.length) {
        setErr(
          `Pedido cargado en ${erpUnitLong(unitSlug)}, pero ${missing.length} producto${missing.length === 1 ? "" : "s"} quedó afuera del carrito: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` y ${missing.length - 5} más` : ""}. Publicá esos productos en el software para que entren.`,
        );
      } else {
        const notas = [
          cancelled.length ? "se quitó la venta del día anterior" : "",
          restored.length ? "se repuso el stock de la carga anterior" : "",
        ].filter(Boolean);
        setOk(
          `${d?.refreshed ? "Carrito actualizado" : "Pedido"} en el carrito de ${erpUnitLong(unitSlug)}${notas.length ? ` (${notas.join("; ")})` : ""}. El cajero lo cobra desde el Punto de Venta.`,
        );
      }
    } catch (e) {
      setErr(e?.name === "AbortError"
        ? "El software tardó demasiado en responder. Reintentá en unos segundos."
        : e.message);
    } finally {
      clearTimeout(timeout);
      setErpBusyId("");
    }
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

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page]
  );
  const firstVisible = rows.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min(page * PAGE_SIZE, rows.length);

  useEffect(() => { setPage(1); }, [tab, timeFilter, search]);
  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  const changePage = (next) => {
    setPage(Math.max(1, Math.min(Number(next) || 1, totalPages)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const rowIds = useMemo(() => rows.map((order) => String(order._id)), [rows]);
  const pageIds = useMemo(() => pageRows.map((order) => String(order._id)), [pageRows]);
  const selectedCount = selectedIds.size;
  const allRowsSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someRowsSelected = pageIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someRowsSelected && !allRowsSelected;
  }, [someRowsSelected, allRowsSelected]);

  const toggleRowSelection = (id) => {
    const key = String(id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllRows = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allRowsSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

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
          <EyeIcon size={14} /> Ver detalle
        </Button>
        {o.status === "pending" && (
          <>
            <Button size="sm" variant="primary" onClick={() => openAct("confirm", o)}>
              <CheckIcon size={14} /> Confirmar pago
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => openAct("reject", o)}>
              <XIcon size={14} /> Rechazar
            </Button>
          </>
        )}
        {canShip && <Button size="sm" variant="primary" onClick={() => setTrackM({ open: true, order: o })}><TruckIcon size={14} /> Despachar</Button>}
        {canRetiro && <Button size="sm" variant="primary" onClick={() => doShip(o)}><CheckIcon size={14} /> Marcar listo</Button>}
        {canRetirado && <Button size="sm" variant="primary" onClick={() => doDeliv(o)}><CheckIcon size={14} /> Marcar retirado</Button>}
        {canDeliv && <Button size="sm" variant="primary" onClick={() => doDeliv(o)}><CheckIcon size={14} /> Marcar entregado</Button>}
        {o.status === "paid" && (
          <Button size="sm" variant="gold" onClick={() => { const lnk = ADMIN_WA ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(waTxt(o))}` : null; setWaM({ open: true, link: lnk, order: o }); }} title="Avisar por WhatsApp">
            <WhatsAppIcon size={14} /> Avisar
          </Button>
        )}
        {["paid", "shipped", "delivered"].includes(o.status) && (
          <>
            {o?.erpSync?.status === "cart" && (
              <span
                className="ao-erp-badge"
                title={`Pedido cargado en el carrito de ${erpUnitLong(o.erpSync.erpUnitSlug)} — pendiente de cobro en el Punto de Venta`}
              >
                <CheckIcon size={13} /> En carrito · {erpUnitShort(o.erpSync.erpUnitSlug)}
              </span>
            )}
            {o?.erpSync?.status === "discarded" && (
              <span
                className="ao-erp-badge ao-erp-badge--muted"
                title="El cajero quitó el pedido del carrito en el Punto de Venta; podés volver a cargarlo en Santiago o Mayorista"
              >
                <XIcon size={13} /> Quitado del POS
              </span>
            )}
            <Button
              size="sm"
              variant="gold"
              loading={erpBusyId === `${String(o._id)}:aesthetic-santiago`}
              onClick={() => doErpCart(o, "aesthetic-santiago")}
              title="Cargar el pedido en el carrito del Punto de Venta de Aesthetic Santiago (se cobra en el POS)"
            >
              <ShoppingBagIcon size={14} /> Santiago
            </Button>
            <Button
              size="sm"
              variant="gold"
              loading={erpBusyId === `${String(o._id)}:pitukas-mayorista`}
              onClick={() => doErpCart(o, "pitukas-mayorista")}
              title="Cargar el pedido en el carrito del Punto de Venta de Pitukas Mayorista (se cobra en el POS)"
            >
              <ShoppingBagIcon size={14} /> Mayorista
            </Button>
          </>
        )}
        <Button size="sm" variant="danger-ghost" onClick={() => openDel(o)}>
          <TrashIcon size={14} /> Eliminar
        </Button>
      </div>
    );
  };

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
          <Button size="sm" variant="secondary" onClick={fetch_} title="Actualizar órdenes">
            <RefreshIcon size={15} /> Actualizar
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

      <div className="ao-bulk-toolbar" role="region" aria-label="Selección masiva de órdenes">
          <label className="ao-bulk-select">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allRowsSelected}
              onChange={toggleAllRows}
              disabled={!rows.length}
              aria-label="Seleccionar todas las órdenes visibles"
            />
            <span>Seleccionar todas</span>
          </label>
          <span className="ao-bulk-count" aria-live="polite">
            {selectedCount} seleccionada{selectedCount === 1 ? "" : "s"}
          </span>
          <div className="ao-bulk-actions">
            <Button
              size="sm"
              variant="danger-ghost"
              onClick={() => openBulkDel([...selectedIds])}
              disabled={!selectedCount}
            >
              <TrashIcon size={14} /> {tab === "deleted" ? "Eliminar seleccionadas" : "Enviar a eliminadas"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => openBulkDel(rowIds)}
              disabled={!rows.length}
            >
              <TrashIcon size={14} /> {tab === "deleted" ? "Eliminar todas" : "Enviar todas a eliminadas"}
            </Button>
          </div>
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
            {pageRows.map((o) => {
              const d = new Date(o.createdAt);
              const envio = o?.shipping?.method === "envio";
              const erpNote = erpSyncNote(o?.erpSync);
              return (
                <Card key={o._id} className="ao-card">
                  <div className="ao-card-top">
                    <div>
                      <label className="ao-card-select">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(o._id))}
                          onChange={() => toggleRowSelection(o._id)}
                          aria-label={`Seleccionar ${num(o)}`}
                        />
                        <span>Seleccionar</span>
                      </label>
                      <div className="ao-card-num">{num(o)}</div>
                      {o.shippingTicket && <span className="ao-card-ticket">{o.shippingTicket}</span>}
                      {o.hasLocalProducts && (
                        <div className="ao-cell-sub" style={{ color: "var(--adm-gold)" }}>🏪 Producto del local</div>
                      )}
                      {erpNote && (
                        <div className="ao-cell-sub" style={{ color: erpNote.color }}>{erpNote.text}</div>
                      )}
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
          <div className="ui-table-wrap ao-table-wrap">
            <table className="ui-table ao-table" role="table" aria-label="Órdenes">
              <thead>
                <tr>
                  <th className="ao-select-col" aria-label="Selección" />
                  <th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Teléfono</th>
                  <th>Método</th><th>Estado</th><th style={{ textAlign: "right" }}>Total</th>
                  <th>Entrega</th><th className="ao-actions-head">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((o) => {
                  const d = new Date(o.createdAt);
                  const envio = o?.shipping?.method === "envio";
                  const erpNote = erpSyncNote(o?.erpSync);
                  return (
                    <tr key={o._id}>
                      <td className="ao-select-col">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(o._id))}
                          onChange={() => toggleRowSelection(o._id)}
                          aria-label={`Seleccionar ${num(o)}`}
                        />
                      </td>
                      <td>
                        <div className="ao-cell-main">{fd(d)}</div>
                        <div className="ao-cell-sub">{ft(d)}</div>
                      </td>
                      <td>
                        <div className="ao-cell-num">{num(o)}</div>
                        {o.shippingTicket && <span className="ao-card-ticket">{o.shippingTicket}</span>}
                        {o.hasLocalProducts && (
                          <div className="ao-cell-sub" style={{ color: "var(--adm-gold)" }}>🏪 Producto del local</div>
                        )}
                        {erpNote && (
                          <div className="ao-cell-sub" style={{ color: erpNote.color }}>{erpNote.text}</div>
                        )}
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
                      <td className="ao-actions-cell"><OrderActions o={o} compact /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="ao-pagination" aria-label="Paginación de órdenes">
              <span className="ao-pagination-info">
                Mostrando <strong>{firstVisible}-{lastVisible}</strong> de <strong>{rows.length}</strong>
              </span>
              <div className="ao-pagination-pages">
                <button
                  type="button"
                  className="ao-page-btn"
                  disabled={page <= 1}
                  onClick={() => changePage(page - 1)}
                >
                  ‹ Anterior
                </button>
                {pagerPages(totalPages, page).map((value, index) => (
                  value === "…" ? (
                    <span key={`dots-${index}`} className="ao-page-dots">···</span>
                  ) : (
                    <button
                      key={value}
                      type="button"
                      className={`ao-page-btn ${value === page ? "is-active" : ""}`}
                      aria-current={value === page ? "page" : undefined}
                      onClick={() => changePage(value)}
                    >
                      {value}
                    </button>
                  )
                ))}
                <button
                  type="button"
                  className="ao-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => changePage(page + 1)}
                >
                  Siguiente ›
                </button>
              </div>
            </nav>
          )}
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
              <div>
                <b>Ventas del software:</b>{" "}
                {detail?.erpSync?.status === "cart"
                  ? <span style={{ color: "var(--adm-info)" }}>En carrito de {erpUnitLong(detail.erpSync.erpUnitSlug)} — pendiente de cobro en el Punto de Venta</span>
                  : detail?.erpSync?.status === "discarded"
                    ? <span style={{ color: "var(--adm-gold)" }}>Se quitó del carrito del Punto de Venta — podés volver a cargarlo con Santiago o Mayorista</span>
                    : detail?.erpSync?.status === "synced"
                      ? <span style={{ color: "var(--adm-success)" }}>Registrada como Online{detail.erpSync.erpOrderNumber ? ` (venta #${detail.erpSync.erpOrderNumber})` : ""}</span>
                      : detail?.erpSync?.status === "failed"
                        ? <span style={{ color: "var(--adm-danger)" }}>Error: {detail.erpSync.lastError || "no se pudo cargar"}</span>
                        : "Aún no enviada"}
              </div>
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
                    const isPack = Number(it?.packSize) > 1 && Number(it?.packQuantity) > 0;
                     const itemSku = String(it?.sku || it?.codigoInterno || "").trim();
                     const itemKey = itemImageKey(it, i);
                     const imageProduct = firstProductImage(it) ? it : detailProducts[itemKey];
                     const imageUrl = firstProductImage(imageProduct);
                     const precioUnit = isPack
                     ? (Number(it.precioPack ?? it.precio) || 0)
                     : (it.cantidad ? it.subtotal / it.cantidad : 0);
                   const boxUnits = Number(it?.unidadesPorCaja) || 0;
                   const boxCount = Number(it?.cantidadCajas) || (it?.saleUnit !== "unitario" && it?.precioCaja > 0 && boxUnits > 1 ? it.cantidad / boxUnits : 0);
                   const saleUnitLabel = it?.saleUnit === "caja"
                     ? `${it.saleQuantity || boxCount} caja${Number(it.saleQuantity || boxCount) === 1 ? "" : "s"}`
                     : it?.saleUnit === "media_caja"
                       ? `${it.saleQuantity || 0} media caja${Number(it.saleQuantity) === 1 ? "" : "s"}`
                       : null;
                   return (
                     <div key={i} className="ao-item">
                       <div className="ao-item-main">
                         <div className="ao-item-image">
                           <span className="ao-item-image-placeholder" aria-hidden="true">
                             <ShoppingBagIcon size={22} />
                             <small>Sin foto</small>
                           </span>
                            {imageUrl && (
                              <button
                                type="button"
                                className="ao-item-image-button"
                                onClick={(event) => {
                                  const displayedImage = event.currentTarget.querySelector("img")?.currentSrc;
                                  setImagePreview({
                                    url: displayedImage || imageUrl,
                                    name: it.nombre || "Producto",
                                  });
                                }}
                                aria-label={`Ampliar imagen de ${it.nombre || "producto"}`}
                              >
                                <ProductImage
                                  product={imageProduct}
                                  alt={`Foto de ${it.nombre || "producto"}`}
                                  className="ao-item-photo"
                                />
                                <span className="ao-item-image-action" aria-hidden="true">
                                  <EyeIcon size={15} />
                                </span>
                              </button>
                            )}
                         </div>
                         <div className="ao-item-content">
                           <div className="ao-item-head">
                             <div className="ao-item-title">
                               <span>{it.nombre}</span>
                               {itemSku && <code className="ao-item-sku">SKU: {itemSku}</code>}
                             </div>
                             {(it?.variant?.size || it?.variant?.color || it?.variant?.tono) && (
                               <small>
                                 ({[it?.variant?.size, it?.variant?.color, it?.variant?.tono].filter(Boolean).join(" / ")})
                               </small>
                             )}
                           </div>
                           <div className="ao-item-row">
                              <span>{isPack ? `Precio x${it.packSize}` : "Unitario"}: <b>{$m(precioUnit)}</b></span>
                              {isPack ? (
                                <span>Cantidad total: <b>x{it.totalUnits || it.cantidad}</b></span>
                              ) : (
                                <span>Cantidad total: <b>{it.cantidad}</b></span>
                              )}
                              {saleUnitLabel && <span>Venta: <b>{saleUnitLabel}</b> · {$m(it.salePrice)}</span>}
                              {!saleUnitLabel && boxCount > 0 && <span>Precio por caja: <b>{$m(it.precioCaja)}</b> · {boxCount} caja{boxCount === 1 ? "" : "s"}</span>}
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
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {imagePreview && (
        <OrderImagePreview preview={imagePreview} onClose={() => setImagePreview(null)} />
      )}

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

      <Modal
        open={bulkDelM.open}
        title={tab === "deleted" ? "Eliminar órdenes permanentemente" : "Enviar órdenes a Eliminadas"}
        onClose={bulkDelM.loading ? undefined : closeBulkDel}
        footer={
          <>
            <Button variant="secondary" onClick={closeBulkDel} disabled={bulkDelM.loading}>Cancelar</Button>
            <Button variant="danger" onClick={doBulkDelete} disabled={bulkDelM.loading} loading={bulkDelM.loading}>
              {bulkDelM.loading ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </>
        }
      >
        <p className="ao-modal-text">
          {tab === "deleted"
            ? <>Vas a eliminar permanentemente <b>{bulkDelM.ids.length}</b> orden{bulkDelM.ids.length === 1 ? "" : "es"}.</>
            : <>Vas a enviar <b>{bulkDelM.ids.length}</b> orden{bulkDelM.ids.length === 1 ? "" : "es"} a Eliminadas.</>}
          Esta acción no se puede deshacer.
        </p>
        <div className="ao-confirm-box ao-confirm-box--danger">
          <div><b>Órdenes seleccionadas:</b> {bulkDelM.ids.length}</div>
          <div>{tab === "deleted" ? "Se quitarán de la papelera y no volverán a aparecer en el panel." : "Podrás eliminarlas permanentemente desde la pestaña Eliminadas."}</div>
        </div>
      </Modal>

      {/* MODAL WHATSAPP */}
      <Modal
        open={waM.open}
        title="Pedido confirmado"
        onClose={closeWaM}
        footer={
          <div className="ao-wa-footer">
            <Button className="ao-wa-footer-primary" variant="gold" onClick={() => {
              navigator.clipboard.writeText(waTxt(waM.order));
              window.open(`https://wa.me/${tel(waM.order?.buyer?.telefono)}`, "_blank");
              closeWaM();
            }}>
              <WhatsAppIcon size={16} /> Copiar mensaje y abrir WhatsApp
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
              <CopyIcon size={15} /> Solo copiar mensaje
            </Button>
            <Button variant="ghost" onClick={closeWaM}>Cerrar</Button>
          </div>
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
