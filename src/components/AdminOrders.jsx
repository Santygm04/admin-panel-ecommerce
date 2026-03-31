import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const ADMIN_WA = (import.meta.env.VITE_ADMIN_PHONE || "").replace(/\D/g, "");

export default function AdminOrders() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem("ADMIN_SECRET") || "");
  const [inputSecret, setInputSecret] = useState("");
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("paid");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState("");

  const [detail, setDetail] = useState(null);
  const [actionModal, setActionModal] = useState({
    open: false,
    type: null,
    order: null,
    loading: false,
  });

  const niceMoney = (n) =>
    typeof n === "number" ? n.toLocaleString("es-AR") : String(n || "");

  const buildAddress = (a = {}) =>
    [[a.calle, a.numero].filter(Boolean).join(" "), a.piso, a.ciudad, a.provincia, a.cp]
      .filter(Boolean)
      .join(", ");

  const normalizePhone = (raw) => (raw ? String(raw).replace(/\D/g, "") : "");
  const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : "—");
  const prettyOrder = (o) =>
    o?.orderNumber ? `#${o.orderNumber}` : o?.shippingTicket || `AE-${shortId(o?._id)}`;

  const orderTextForWhatsApp = (o) => {
    const envio = o?.shipping?.method === "envio";
    const addr = envio ? buildAddress(o?.shipping?.address || {}) : "—";
    const code = prettyOrder(o);
    const itemsLines = (o.items || [])
      .map((it) => {
        const varPart =
          it?.variant?.size || it?.variant?.color
            ? ` (${[it?.variant?.size, it?.variant?.color].filter(Boolean).join(" / ")})`
            : "";
        return `• ${it.nombre}${varPart} x${it.cantidad} — $${niceMoney(it.subtotal)}`;
      })
      .join("\n");

    return [
      "✅ *Pedido confirmado*",
      "",
      `*Pedido:* ${code}`,
      `*Estado:* ${o.status}`,
      `*Pago:* ${o.paymentMethod}`,
      "",
      `*Cliente:* ${o?.buyer?.nombre || "-"}`,
      `*Tel:* ${o?.buyer?.telefono || "-"}`,
      `*Email:* ${o?.buyer?.email || "-"}`,
      "",
      `*Entrega:* ${envio ? "Envío a domicilio" : "Retiro en local"}`,
      `*Dirección:* ${envio ? addr : "—"}`,
      "",
      `*Productos:*`,
      itemsLines || "—",
      "",
      `*Total:* $${niceMoney(o.total)}`,
    ].join("\n");
  };

  const fetchOrders = async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/payments/orders`);
      if (statusFilter) url.searchParams.set("status", statusFilter);

      const res = await fetch(url, {
        headers: { "x-admin-secret": secret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No autorizado o error de servidor");

      setOrders(data.orders || []);
      setMessage("");
    } catch (e) {
      setMessage("❌ " + (e.message || "Error cargando órdenes"));
      setOrders([]);
    } finally {
      setLoading(false);
    }
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

  const logout = () => {
    sessionStorage.removeItem("ADMIN_SECRET");
    setSecret("");
    setOrders([]);
    setDetail(null);
  };

  const openActionModal = (type, order) =>
    setActionModal({ open: true, type, order, loading: false });

  const closeActionModal = () =>
    setActionModal({ open: false, type: null, order: null, loading: false });

  const handleActionConfirm = async () => {
    if (!secret || !actionModal.order) return;

    const { type, order } = actionModal;

    try {
      setActionModal((m) => ({ ...m, loading: true }));

      const endpoint =
        type === "confirm"
          ? `${API_URL}/api/payments/order/${order._id}/confirm`
          : `${API_URL}/api/payments/order/${order._id}/reject`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No se pudo completar la acción");

      if (type === "confirm") {
        setMessage("✅ Orden confirmada");
        setOrders((arr) =>
          arr.map((o) => (o._id === order._id ? { ...o, status: "paid" } : o))
        );
        if (detail && detail._id === order._id) {
          setDetail({ ...detail, status: "paid" });
        }

        if (data?.whatsappLink) {
          window.open(data.whatsappLink, "_blank", "noopener,noreferrer");
        } else if (ADMIN_WA) {
          const txt = orderTextForWhatsApp({ ...order, status: "paid" });
          window.open(
            `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(txt)}`,
            "_blank",
            "noopener,noreferrer"
          );
        }
      } else {
        setMessage("🚫 Orden rechazada");
        setOrders((arr) =>
          arr.map((o) => (o._id === order._id ? { ...o, status: "cancelled" } : o))
        );
        if (detail && detail._id === order._id) {
          setDetail({ ...detail, status: "cancelled" });
        }
      }

      closeActionModal();
    } catch (e) {
      setMessage("❌ " + (e.message || "Error al ejecutar la acción"));
      setActionModal((m) => ({ ...m, loading: false }));
    }
  };

  const markShipped = async (order) => {
    if (!secret || !order) return;

    const tn = window.prompt(
      "Tracking/código (opcional)",
      order?.shipping?.trackingNumber || ""
    );

    if (!tn) {
      const ok = window.confirm("¿Marcar como DESPACHADO sin tracking?");
      if (!ok) return;
    }

    let company = (
      window.prompt(
        "Compañía (andreani/correo/oca…) — opcional",
        order?.shipping?.company || ""
      ) || ""
    ).trim();

    let method = order?.shipping?.method || "envio";
    const askMethod = window.prompt(
      "Método (envio/retiro) — Enter para dejar igual",
      method
    );
    if (askMethod) {
      const m = askMethod.toLowerCase();
      if (m === "envio" || m === "retiro") method = m;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/payments/order/${order._id}/ship`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          trackingNumber: tn || undefined,
          company: company || undefined,
          method,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No se pudo marcar despachado");

      setMessage("📦 Pedido marcado como despachado");
      setOrders((arr) =>
        arr.map((o) => (o._id === order._id ? { ...o, shipping: data.shipping } : o))
      );
      if (detail && detail._id === order._id) {
        setDetail((d) => ({ ...d, shipping: data.shipping }));
      }
    } catch (e) {
      setMessage("❌ " + (e.message || "Error al marcar despachado"));
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async (order) => {
    if (!secret || !order) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/payments/order/${order._id}/delivered`, {
        method: "POST",
        headers: { "x-admin-secret": secret },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No se pudo marcar entregado");

      setMessage("🚚 Pedido marcado como entregado");
      setOrders((arr) =>
        arr.map((o) => (o._id === order._id ? { ...o, shipping: data.shipping } : o))
      );
      if (detail && detail._id === order._id) {
        setDetail((d) => ({ ...d, shipping: data.shipping }));
      }
    } catch (e) {
      setMessage("❌ " + (e.message || "Error al marcar entregado"));
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (order) => {
    if (!secret || !order) return;
    if (!window.confirm("¿Eliminar definitivamente esta orden cancelada?")) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/payments/order/${order._id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "No se pudo eliminar");

      setOrders((arr) => arr.filter((o) => o._id !== order._id));
      if (detail && detail._id === order._id) {
        setDetail(null);
      }

      setMessage("🗑️ Orden eliminada");
    } catch (e) {
      setMessage("❌ " + (e.message || "Error al eliminar"));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!statusFilter) return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  if (!secret) {
    return (
      <section className="aorders-wrap">
        <div className="aorders-card">
          <div className="aorders-header">
            <h2 className="aorders-title">Órdenes</h2>
            <Link to="/dashboard" className="btn btn--ghost">
              ← Volver al panel
            </Link>
          </div>

          <form onSubmit={login} className="aorders-login">
            <input
              className="input"
              placeholder="ADMIN_SECRET"
              value={inputSecret}
              onChange={(e) => setInputSecret(e.target.value)}
            />
            <button className="btn btn--primary" type="submit">
              Entrar
            </button>
          </form>

          {message && <p className="aorders-msg">{message}</p>}

          <p className="muted" style={{ marginTop: 8 }}>
            *Panel interno simple.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="aorders-wrap">
      <div className="aorders-card">
        <div className="aorders-header">
          <h2 className="aorders-title">🧾 Órdenes</h2>

          <div className="aorders-controls">
            <Link to="/dashboard" className="btn btn--ghost">
              ← Volver al panel
            </Link>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select"
              title="Filtrar por estado"
            >
              <option value="pending">Pendientes</option>
              <option value="paid">Pagadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="">Todas</option>
            </select>

            <label className="check">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>

            <button onClick={fetchOrders} className="btn btn--ghost" type="button">
              Actualizar
            </button>

            <button onClick={logout} className="btn btn--danger-ghost" type="button">
              Salir
            </button>
          </div>
        </div>

        {message && <div className="banner">{message}</div>}
        {loading && <p className="muted">Cargando…</p>}

        {!filtered.length ? (
          <p className="muted">No hay órdenes para mostrar.</p>
        ) : (
          <>
            <div className="aorders-cards">
              {filtered.map((o) => {
                const d = new Date(o.createdAt);
                const envio = o?.shipping?.method === "envio";
                const canShip = o.status === "paid" && !o?.shipping?.trackingNumber;
                const canDeliver =
                  o.status === "paid" &&
                  !o?.shipping?.deliveredAt &&
                  (o?.shipping?.trackingNumber || o?.shipping?.method === "retiro");

                return (
                  <div key={o._id} className="order-card">
                    <div className="order-card-header">
                      <div>
                        <div className="order-card-id">{prettyOrder(o)}</div>
                        <span className={`badge badge--${o.status}`}>{o.status}</span>
                      </div>

                      <div className="order-card-date">
                        {d.toLocaleDateString()}
                        <br />
                        {d.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    <div className="order-card-body">
                      <div className="order-card-field">
                        <span>Cliente</span>
                        <span>{o?.buyer?.nombre || "—"}</span>
                      </div>

                      <div className="order-card-field">
                        <span>Teléfono</span>
                        <span className="mono">{o?.buyer?.telefono || "—"}</span>
                      </div>

                      <div className="order-card-field">
                        <span>Método pago</span>
                        <span>{o.paymentMethod || "—"}</span>
                      </div>

                      <div className="order-card-field">
                        <span>Total</span>
                        <span className="order-card-total">${niceMoney(o.total)}</span>
                      </div>

                      <div className="order-card-field full">
                        <span>Entrega</span>
                        <span>
                          {envio
                            ? `Envío — ${buildAddress(o?.shipping?.address || {})}`
                            : "Retiro en local"}
                        </span>
                      </div>

                      {o?.shipping?.trackingNumber && (
                        <div className="order-card-field full">
                          <span>Tracking</span>
                          <span className="mono">{o.shipping.trackingNumber}</span>
                        </div>
                      )}
                    </div>

                    <div className="order-card-actions">
                      <button className="btn btn--ghost" onClick={() => setDetail(o)} type="button">
                        Ver detalle
                      </button>

                      {o.status === "pending" && (
                        <>
                          <button
                            className="btn btn--primary"
                            onClick={() => openActionModal("confirm", o)}
                            type="button"
                          >
                            Confirmar
                          </button>
                          <button
                            className="btn btn--danger"
                            onClick={() => openActionModal("reject", o)}
                            type="button"
                          >
                            Rechazar
                          </button>
                        </>
                      )}

                      {canShip && (
                        <button className="btn btn--ghost" onClick={() => markShipped(o)} type="button">
                          📦 Despachar
                        </button>
                      )}

                      {canDeliver && (
                        <button className="btn btn--ghost" onClick={() => markDelivered(o)} type="button">
                          ✅ Entregado
                        </button>
                      )}

                      {o.status === "cancelled" && (
                        <button
                          className="btn btn--danger-ghost"
                          onClick={() => deleteOrder(o)}
                          type="button"
                        >
                          🗑 Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="aorders-tablewrap">
              <table className="aorders-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th className="ta-right">Total</th>
                    <th>Entrega</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((o) => {
                    const d = new Date(o.createdAt);
                    const envio = o?.shipping?.method === "envio";
                    const dir = envio ? buildAddress(o?.shipping?.address) : "Retiro en local";
                    const canShip = o.status === "paid" && !o?.shipping?.trackingNumber;
                    const canDeliver =
                      o.status === "paid" &&
                      !o?.shipping?.deliveredAt &&
                      (o?.shipping?.trackingNumber || o?.shipping?.method === "retiro");

                    return (
                      <tr key={o._id} className="aorders-row">
                        <td>
                          <div className="nowrap">{d.toLocaleDateString()}</div>
                          <div className="nowrap muted">
                            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>

                        <td>
                          <div className="strong break">{prettyOrder(o)}</div>
                          <small className="muted">
                            Ticket: <span className="mono">{o.shippingTicket || "—"}</span>
                          </small>
                          <br />
                          <small className="muted">
                            ID: <span className="mono">{o._id}</span>{" "}
                            <button
                              className="btn btn--small-ghost"
                              onClick={() => navigator.clipboard.writeText(o._id)}
                              type="button"
                            >
                              Copiar
                            </button>
                          </small>
                        </td>

                        <td>{o?.buyer?.nombre || "-"}</td>
                        <td className="mono">{o?.buyer?.telefono || "-"}</td>
                        <td>{o.paymentMethod}</td>
                        <td>
                          <span className={`badge badge--${o.status}`}>{o.status}</span>
                        </td>
                        <td className="ta-right strong">${niceMoney(o.total)}</td>

                        <td className="break">
                          {envio ? (
                            <>
                              <div className="strong">Envío</div>
                              <div className="muted">{dir || "—"}</div>
                            </>
                          ) : (
                            <>
                              <div className="strong">Retiro en local</div>
                              <div className="muted">Coordinamos por WhatsApp</div>
                            </>
                          )}

                          {o?.shipping?.trackingNumber && (
                            <div className="muted">
                              Tracking: <span className="mono">{o.shipping.trackingNumber}</span>
                            </div>
                          )}

                          {o?.shipping?.deliveredAt && (
                            <div className="muted">
                              Entregado: {new Date(o.shipping.deliveredAt).toLocaleString()}
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="row-actions">
                            <button className="btn btn--ghost" onClick={() => setDetail(o)} type="button">
                              Ver
                            </button>

                            {o.status === "pending" && (
                              <>
                                <button
                                  onClick={() => openActionModal("confirm", o)}
                                  className="btn btn--primary"
                                  type="button"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => openActionModal("reject", o)}
                                  className="btn btn--danger"
                                  type="button"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}

                            {canShip && (
                              <button className="btn btn--ghost" onClick={() => markShipped(o)} type="button">
                                Despachar
                              </button>
                            )}

                            {canDeliver && (
                              <button className="btn btn--ghost" onClick={() => markDelivered(o)} type="button">
                                Entregado
                              </button>
                            )}

                            {o.status === "cancelled" && (
                              <button
                                className="btn btn--danger-ghost"
                                onClick={() => deleteOrder(o)}
                                type="button"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Detalle del pedido</h3>
              <button onClick={() => setDetail(null)} className="x-btn" type="button">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p>
                <b>Pedido:</b> {prettyOrder(detail)}
              </p>
              <p>
                <b>Estado:</b>{" "}
                <span className={`badge badge--${detail.status}`}>{detail.status}</span>
              </p>
              <p>
                <b>Método:</b> {detail.paymentMethod}
              </p>
              <p>
                <b>Total:</b> ${niceMoney(detail.total)}
              </p>
              <p>
                <b>Cliente:</b> {detail?.buyer?.nombre || "-"} — {detail?.buyer?.email || "-"}
              </p>
              <p>
                <b>Teléfono:</b> {detail?.buyer?.telefono || "-"}
              </p>
              <p>
                <b>Entrega:</b>{" "}
                {detail?.shipping?.method === "envio"
                  ? `Envío — ${buildAddress(detail?.shipping?.address)}`
                  : "Retiro en local"}
              </p>

              {detail?.shipping?.trackingNumber && (
                <p>
                  <b>Tracking:</b> <span className="mono">{detail.shipping.trackingNumber}</span>
                </p>
              )}

              {detail?.shipping?.deliveredAt && (
                <p>
                  <b>Entregado:</b> {new Date(detail.shipping.deliveredAt).toLocaleString()}
                </p>
              )}

              <div className="modal-items">
                <b>Productos:</b>
                <ul>
                  {(detail.items || []).map((it, idx) => (
                    <li key={idx}>
                      {it.nombre}
                      {it?.variant?.size || it?.variant?.color
                        ? ` (${[it?.variant?.size, it?.variant?.color]
                            .filter(Boolean)
                            .join(" / ")})`
                        : ""}
                      {" "}x{it.cantidad} — ${niceMoney(it.subtotal)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="modal-actions">
                {detail?.buyer?.telefono && (
                  <a
                    href={`https://wa.me/${normalizePhone(detail.buyer.telefono)}?text=${encodeURIComponent(
                      `Hola ${detail?.buyer?.nombre || ""}, soy AESTHETIC. Tu pedido ${prettyOrder(
                        detail
                      )} está en estado ${detail.status}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--ghost"
                  >
                    WhatsApp
                  </a>
                )}

                {detail.status === "pending" && (
                  <>
                    <button
                      className="btn btn--primary"
                      onClick={() => openActionModal("confirm", detail)}
                      type="button"
                    >
                      Confirmar
                    </button>
                    <button
                      className="btn btn--danger"
                      onClick={() => openActionModal("reject", detail)}
                      type="button"
                    >
                      Rechazar
                    </button>
                  </>
                )}

                {detail.status === "paid" && !detail?.shipping?.trackingNumber && (
                  <button className="btn btn--ghost" onClick={() => markShipped(detail)} type="button">
                    📦 Despachar
                  </button>
                )}

                {!detail?.shipping?.deliveredAt &&
                  (detail?.shipping?.trackingNumber || detail?.shipping?.method === "retiro") && (
                    <button
                      className="btn btn--ghost"
                      onClick={() => markDelivered(detail)}
                      type="button"
                    >
                      ✅ Entregado
                    </button>
                  )}

                {detail.status === "cancelled" && (
                  <button
                    className="btn btn--danger-ghost"
                    onClick={() => deleteOrder(detail)}
                    type="button"
                  >
                    🗑 Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {actionModal.open && (
        <div className="modal-backdrop" onClick={closeActionModal}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <h3 className={actionModal.type === "reject" ? "title-red" : "title-green"}>
              {actionModal.type === "reject" ? "Rechazar orden" : "Confirmar pago"}
            </h3>

            <p>
              {actionModal.type === "reject"
                ? "Esta acción cancelará la orden. ¿Querés continuar?"
                : "Vas a marcar la orden como pagada. ¿Confirmás?"}
            </p>

            <div className="confirm-box">
              <div>
                <b>Pedido:</b> {prettyOrder(actionModal.order)}
              </div>
              <div>
                <b>Cliente:</b> {actionModal.order?.buyer?.nombre || "-"}
              </div>
              <div>
                <b>Total:</b> ${niceMoney(actionModal.order?.total)}
              </div>
            </div>

            <div className="confirm-actions">
              <button
                className="btn btn--ghost"
                onClick={closeActionModal}
                disabled={actionModal.loading}
                type="button"
              >
                Cancelar
              </button>

              {actionModal.type === "reject" ? (
                <button
                  className="btn btn--danger"
                  onClick={handleActionConfirm}
                  disabled={actionModal.loading}
                  type="button"
                >
                  {actionModal.loading ? "Procesando…" : "Rechazar"}
                </button>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={handleActionConfirm}
                  disabled={actionModal.loading}
                  type="button"
                >
                  {actionModal.loading ? "Procesando…" : "Confirmar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}