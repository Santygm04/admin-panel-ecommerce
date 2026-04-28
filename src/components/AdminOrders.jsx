// AdminOrders.jsx — v5 Premium
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./AdminOrders.css";

const API_URL  = import.meta.env.VITE_API_URL  || "http://localhost:4000";
const ADMIN_WA = (import.meta.env.VITE_ADMIN_PHONE || "").replace(/\D/g, "");

const $m   = (n) => `$${(+n || 0).toLocaleString("es-AR")}`;
const adr  = (a = {}) =>
  [[a.calle, a.numero].filter(Boolean).join(" "), a.piso, a.ciudad, a.provincia, a.cp]
    .filter(Boolean).join(", ");
const tel  = (r) => r ? String(r).replace(/\D/g, "") : "";
const shrt = (id) => id ? String(id).slice(-8) : "—";
const num  = (o) => o?.orderNumber ? `#${o.orderNumber}` : o?.shippingTicket || `#${shrt(o?._id)}`;
const fd   = (d) => d.toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"2-digit" });
const ft   = (d) => d.toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });

const ST = {
  pending:   { lbl:"Pendiente",  cls:"ao-s-pending"   },
  paid:      { lbl:"Pagada",     cls:"ao-s-paid"      },
  cancelled: { lbl:"Cancelada",  cls:"ao-s-cancelled" },
  rejected:  { lbl:"Rechazada",  cls:"ao-s-rejected"  },
  shipped:   { lbl:"Despachada", cls:"ao-s-shipped"   },
  deleted:   { lbl:"Eliminada",  cls:"ao-s-deleted"   },
};

const TABS = [
  { v:"pending",   ico:"⏳", lbl:"Pendientes"  },
  { v:"paid",      ico:"✅", lbl:"Pagadas"     },
  { v:"cancelled", ico:"❌", lbl:"Canceladas"  },
  { v:"deleted",   ico:"🗑", lbl:"Eliminadas"  },
  { v:"",          ico:"📋", lbl:"Todas"       },
];

function Badge({ s }) {
  const d = ST[s] || { lbl: s, cls: "ao-s-deleted" };
  return <span className={`ao-badge ${d.cls}`}>{d.lbl}</span>;
}

const waTxt = (o) => {
  const envio = o?.shipping?.method === "envio";
  const ticket = o?.shippingTicket || (o?.orderNumber ? `#${o.orderNumber}` : null);
  const lines = (o.items||[]).map(it => {
    const vp = it?.variant?.size||it?.variant?.color
      ? ` (${[it?.variant?.size,it?.variant?.color].filter(Boolean).join(" / ")})`:"";
    return `• ${it.nombre}${vp} ×${it.cantidad} — ${$m(it.subtotal)}`;
  }).join("\n");
  return [
    "✅ *¡Tu pedido fue confirmado, Aesthetic te lo confirma!*","",
    `🏷 *Código de pedido:* ${ticket||num(o)}`,
    `   _Guardá este código para hacer seguimiento_`,"",
    `📦 *Detalle del pedido:*`,
    `*Método de pago:* ${o.paymentMethod === "mercadopago" ? "Mercado Pago" : "Transferencia"}`,"",
    `👤 *Datos del cliente:*`,
    `*Nombre:* ${o?.buyer?.nombre||"-"}`,
    `*Teléfono:* ${o?.buyer?.telefono||"-"}`,"",
    `🚚 *Entrega:* ${envio?"Envío a domicilio":"Retiro en local"}`,
    ...(envio?[`*Dirección:* ${adr(o?.shipping?.address||{})}`]:[]),"",
    `🛍 *Productos:*`,lines||"—","",
    `💰 *Total:* ${$m(o.total)}`,
    "",
    "¡Gracias por tu compra! Ante cualquier consulta estamos a tu disposición 🌸",
  ].join("\n");
};

export default function AdminOrders() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem("ADMIN_SECRET")||"");
  const [iSec,   setISec]   = useState("");
  const [orders, setOrders] = useState([]);
  const [tab,    setTab]    = useState("pending");
  const [load,   setLoad]   = useState(false);
  const [autoR,  setAutoR]  = useState(true);
  const [msg,    setMsg]    = useState("");
  const [detail, setDetail] = useState(null);
  const [actM,   setActM]   = useState({open:false,type:null,order:null,loading:false});
  const [delM,   setDelM]   = useState({open:false,order:null,loading:false});
  const [waM,    setWaM]    = useState({open:false,link:null,order:null});

  const closeWaM = () => setWaM({open:false,link:null,order:null});

  const fetch_ = async () => {
    if (!secret) return;
    setLoad(true);
    try {
      const u = new URL(`${API_URL}/api/payments/orders`);
      if (tab) u.searchParams.set("status", tab);
      const r = await fetch(u, {headers:{"x-admin-secret":secret}});
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message||"Error");
      setOrders(d.orders||[]); setMsg("");
    } catch(e) { setMsg("❌ "+e.message); setOrders([]); }
    finally    { setLoad(false); }
  };

  useEffect(()=>{
    fetch_();
    if (!secret||!autoR) return;
    const id=setInterval(fetch_,10000);
    return ()=>clearInterval(id);
    // eslint-disable-next-line
  },[secret,tab,autoR]);

  const login = e => {
    e.preventDefault(); if (!iSec.trim()) return;
    sessionStorage.setItem("ADMIN_SECRET",iSec.trim());
    setSecret(iSec.trim()); setISec(""); setTimeout(fetch_,150);
  };
  const logout = () => {
    sessionStorage.removeItem("ADMIN_SECRET");
    setSecret(""); setOrders([]); setDetail(null);
  };

  const openAct  = (type,order) => setActM({open:true,type,order,loading:false});
  const closeAct = () => setActM({open:false,type:null,order:null,loading:false});
  const openDel  = (order) => setDelM({open:true,order,loading:false});
  const closeDel = () => setDelM({open:false,order:null,loading:false});

  const doAction = async () => {
    if (!secret||!actM.order) return;
    const {type,order} = actM;
    setActM(m=>({...m,loading:true}));
    try {
      const ep = type==="confirm"
        ? `${API_URL}/api/payments/order/${order._id}/confirm`
        : `${API_URL}/api/payments/order/${order._id}/reject`;
      const r = await fetch(ep,{method:"POST",headers:{"Content-Type":"application/json","x-admin-secret":secret},body:"{}"});
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message||"Error");
      if (type==="confirm") {
        setMsg("✅ Orden confirmada y notificada");
        setOrders(a=>a.map(o=>o._id===order._id?{...o,status:"paid"}:o));
        if (detail?._id===order._id) setDetail(x=>({...x,status:"paid"}));
        const lnk = d?.whatsappLink||(ADMIN_WA?`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(waTxt({...order,status:"paid"}))}`:null);
        if (lnk) setWaM({open:true,link:lnk,order:{...order,status:"paid"}});
      } else {
        setMsg("🚫 Orden rechazada");
        setOrders(a=>a.map(o=>o._id===order._id?{...o,status:"cancelled"}:o));
        if (detail?._id===order._id) setDetail(x=>({...x,status:"cancelled"}));
      }
      closeAct();
    } catch(e) { setMsg("❌ "+e.message); setActM(m=>({...m,loading:false})); }
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
      setMsg("🗑 Orden eliminada permanentemente");
      closeDel();
    } catch (e) { setMsg("❌ " + e.message); setDelM(m => ({ ...m, loading: false })); }
  };

  const doDel = async () => {
    if (!secret||!delM.order) return;
    setDelM(m=>({...m,loading:true}));
    try {
      const r = await fetch(`${API_URL}/api/payments/order/${delM.order._id}`,{method:"DELETE",headers:{"x-admin-secret":secret}});
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message||"Error");
      setOrders(a=>a.map(o=>o._id===delM.order._id ? {...o,status:"deleted"} : o));
      if (detail?._id===delM.order._id) setDetail(null);
      setMsg("🗑 Orden eliminada — aparece en tab 'Eliminadas'");
      closeDel();
      setTimeout(()=>fetch_(), 300);
    } catch(e) { setMsg("❌ "+e.message); setDelM(m=>({...m,loading:false})); }
  };

  const doShip = async (order) => {
    const isRetiro = order?.shipping?.method === "retiro";
    const tn = isRetiro ? "" : window.prompt("Número de tracking (opcional):", order?.shipping?.trackingNumber || "");
if (!isRetiro && tn === null) return;
    if (!isRetiro && tn === null) return;
    const co = isRetiro ? "" : (window.prompt("Empresa de envío (ej: Andreani, OCA):", order?.shipping?.company||"")||"").trim();
    const mt = order?.shipping?.method || "envio";
    try {
      setLoad(true);
      const r = await fetch(`${API_URL}/api/payments/order/${order._id}/ship`,{
        method:"POST",headers:{"Content-Type":"application/json","x-admin-secret":secret},
        body:JSON.stringify({trackingNumber:tn||undefined,company:co||undefined,method:mt}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message||"Error");
      setOrders(a=>a.map(o=>o._id===order._id?{...o,shipping:d.shipping}:o));
      if (detail?._id===order._id) setDetail(x=>({...x,shipping:d.shipping}));
      if (isRetiro) {
        const r2 = await fetch(`${API_URL}/api/payments/order/${order._id}/delivered`,{method:"POST",headers:{"x-admin-secret":secret}});
        const d2 = await r2.json();
        if (r2.ok) {
          setOrders(a=>a.map(o=>o._id===order._id?{...o,shipping:d2.shipping}:o));
          if (detail?._id===order._id) setDetail(x=>({...x,shipping:d2.shipping}));
          setMsg("🏪 Pedido marcado como listo para retirar");
        }
      } else {
        setMsg("📦 Pedido despachado");
      }
    } catch(e){setMsg("❌ "+e.message);}
    finally{setLoad(false);}
  };

  const doRetiro = async (order) => {
    try {
      setLoad(true);
      const r1 = await fetch(`${API_URL}/api/payments/order/${order._id}/ship`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-admin-secret":secret},
        body: JSON.stringify({ method: "retiro" }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1?.message || "Error al marcar listo");
      const r2 = await fetch(`${API_URL}/api/payments/order/${order._id}/delivered`, {
        method:"POST",
        headers:{"x-admin-secret":secret},
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2?.message || "Error al marcar entregado");
      setOrders(a=>a.map(o=>o._id===order._id?{...o,shipping:d2.shipping}:o));
      if (detail?._id===order._id) setDetail(x=>({...x,shipping:d2.shipping}));
      setMsg("🏪 Pedido marcado como retirado");
    } catch(e){ setMsg("❌ "+e.message); }
    finally{ setLoad(false); }
  };

  const doDeliv = async (order) => {
    try {
      setLoad(true);
      const r = await fetch(`${API_URL}/api/payments/order/${order._id}/delivered`,{method:"POST",headers:{"x-admin-secret":secret}});
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message||"Error");
      setMsg("🚚 Pedido entregado");
      setOrders(a=>a.map(o=>o._id===order._id?{...o,shipping:d.shipping}:o));
      if (detail?._id===order._id) setDetail(x=>({...x,shipping:d.shipping}));
    } catch(e){setMsg("❌ "+e.message);}
    finally{setLoad(false);}
  };

  const rows = useMemo(()=>tab?orders.filter(o=>o.status===tab):orders,[orders,tab]);


  
  /* ── LOGIN ── */
  if (!secret) return (
    <div className="ao-page">
      <nav className="ao-nav">
        <div className="ao-nav-left">
          <div className="ao-nav-logo">🧾</div>
          <div><div className="ao-nav-title">Órdenes</div><div className="ao-nav-subtitle">Panel Admin</div></div>
        </div>
        <Link to="/dashboard" className="ao-nav-btn">← Volver</Link>
      </nav>
      <div className="ao-login-wrap">
        <p className="ao-login-title">Ingresá tu clave de admin</p>
        <form onSubmit={login} style={{display:"flex",flexDirection:"column",gap:10}}>
          <input className="ao-login-input" type="password" placeholder="Clave de administrador"
            value={iSec} onChange={e=>setISec(e.target.value)}/>
          <button className="ao-btn ao-btn-confirm ao-btn-full" type="submit" style={{height:46}}>
            Entrar al panel
          </button>
        </form>
        {msg && <p className="ao-msg">{msg}</p>}
      </div>
    </div>
  );

  /* ── MAIN ── */
  return (
    <div className="ao-page">

      <nav className="ao-nav">
        <div className="ao-nav-left">
          <div className="ao-nav-logo">🧾</div>
          <div>
            <div className="ao-nav-title">Órdenes{load && <span style={{fontSize:".7rem",fontWeight:500,color:"#b0aab8",marginLeft:6}}>cargando…</span>}</div>
            <div className="ao-nav-subtitle">{rows.length} resultado{rows.length!==1?"s":""}</div>
          </div>
        </div>
        <div className="ao-nav-right">
          <label className="ao-autorefresh">
            <input type="checkbox" checked={autoR} onChange={e=>setAutoR(e.target.checked)}/>
            Auto
          </label>
          <button onClick={fetch_} className="ao-nav-btn" type="button" title="Actualizar">↻</button>
          <Link to="/dashboard" className="ao-nav-btn">← Panel</Link>
          <button onClick={logout} className="ao-nav-btn ao-nav-btn-ghost" type="button">Salir</button>
        </div>
      </nav>

      <div className="ao-main">

        <div className="ao-tabs">
          {TABS.map(t=>(
            <button key={t.v} type="button"
              className={`ao-tab${tab===t.v?" ao-tab-on":""}`}
              onClick={()=>setTab(t.v)}>
              {t.ico} {t.lbl}
            </button>
          ))}
        </div>

        {msg && <div className="ao-banner">{msg}</div>}

        {!rows.length ? (
          <div className="ao-empty">
            <span className="ao-empty-emoji">📭</span>
            <p className="ao-empty-text">No hay órdenes en esta sección</p>
          </div>
        ) : (<>

          

          {/* CARDS MÓVIL */}
          <div className="ao-cards">
            {rows.map(o=>{
              const d=new Date(o.createdAt);
              const method = o?.shipping?.method;
              const shipped = o?.shipping?.shippedAt;
              const delivered = o?.shipping?.deliveredAt;

              const envio = method === "envio";
              const isRetiro = method === "retiro";

              const canShip   = o.status === "paid" && !shipped   && method === "envio";
              const canRetiro = o.status === "paid" && !delivered && method === "retiro";
              const canDeliv  = o.status === "paid" && !delivered && method === "envio" && !!o?.shipping?.trackingNumber;
              return (
                <div key={o._id} className="ao-card">
                  <div className="ao-card-top">
                    <div>
                      <div className="ao-card-num">{num(o)}</div>
                      {o.shippingTicket&&<span className="ao-card-ticket">{o.shippingTicket}</span>}
                    </div>
                    <div className="ao-card-right">
                      <Badge s={o.status}/>
                      <div className="ao-card-ts">{fd(d)}<br/>{ft(d)}</div>
                    </div>
                  </div>
                  <div className="ao-card-grid">
                    <div className="ao-kv">
                      <span className="ao-kv-k">Cliente</span>
                      <span className="ao-kv-v">{o?.buyer?.nombre||"—"}</span>
                    </div>
                    <div className="ao-kv">
                      <span className="ao-kv-k">Teléfono</span>
                      <span className="ao-kv-v ao-kv-v-mono">{o?.buyer?.telefono||"—"}</span>
                    </div>
                    <div className="ao-kv">
                      <span className="ao-kv-k">Método de pago</span>
                      <span className="ao-kv-v" style={{textTransform:"capitalize"}}>{o.paymentMethod||"—"}</span>
                    </div>
                    <div className="ao-kv">
                      <span className="ao-kv-k">Total</span>
                      <span className="ao-kv-v ao-kv-v-total">{$m(o.total)}</span>
                    </div>
                    <div className="ao-kv ao-kv-full">
                      <span className="ao-kv-k">Entrega</span>
                      <span className="ao-kv-v">{envio?`📦 Envío — ${adr(o?.shipping?.address)}`:"🏪 Retiro en local"}</span>
                    </div>
                    {o?.shipping?.trackingNumber&&(
                      <div className="ao-kv ao-kv-full">
                        <span className="ao-kv-k">Tracking</span>
                        <span className="ao-kv-v ao-kv-v-mono">{o.shipping.trackingNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="ao-card-actions">
                    <button className="ao-btn ao-btn-outline" onClick={()=>setDetail(o)} type="button">👁 Ver</button>
                    {o.status==="pending"&&<>
                      <button className="ao-btn ao-btn-confirm" onClick={()=>openAct("confirm",o)} type="button">✓ Confirmar</button>
                      <button className="ao-btn ao-btn-reject"  onClick={()=>openAct("reject",o)}  type="button">✗ Rechazar</button>
                    </>}
                    {canShip   &&<button className="ao-btn ao-btn-ship"    onClick={()=>doRetiro(o)}  type="button">📦 Despachar</button>}
                    {canRetiro &&<button className="ao-btn ao-btn-ship"    onClick={()=>doRetiro(o)}  type="button">🏪 Listo para retirar</button>}
                    {canDeliv  &&<button className="ao-btn ao-btn-outline" onClick={()=>doDeliv(o)} type="button">✅ Entregado</button>}
                    <button className="ao-btn ao-btn-delete full-col" onClick={()=>openDel(o)} type="button">🗑 Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TABLA DESKTOP */}
          <div className="ao-table-wrap">
            <table className="ao-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Teléfono</th>
                  <th>Método</th><th>Estado</th><th style={{textAlign:"right"}}>Total</th>
                  <th>Entrega</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(o=>{
                  const d=new Date(o.createdAt);
                  const envio=o?.shipping?.method==="envio";
                  const isRetiro=o?.shipping?.method==="retiro";
                  const canShip=o.status==="paid"&&!o?.shipping?.shippedAt&&!isRetiro;
                  const canRetiro=o.status==="paid"&&!o?.shipping?.deliveredAt&&isRetiro;
                  const canDeliv=o.status==="paid"&&!o?.shipping?.deliveredAt&&!isRetiro&&!!o?.shipping?.trackingNumber;
                  return (
                    <tr key={o._id}>
                      <td>
                        <div style={{fontWeight:700,fontSize:".86rem"}}>{fd(d)}</div>
                        <div className="ao-cell-sub">{ft(d)}</div>
                      </td>
                      <td>
                        <div className="ao-cell-num">{num(o)}</div>
                        {o.shippingTicket&&<span className="ao-card-ticket">{o.shippingTicket}</span>}
                        <div className="ao-cell-id">
                          <span>…{shrt(o._id)}</span>
                          <button className="ao-btn-xs" onClick={()=>navigator.clipboard.writeText(o._id)} type="button">Copiar</button>
                        </div>
                      </td>
                      <td>
                        <div className="ao-cell-name">{o?.buyer?.nombre||"—"}</div>
                        <div className="ao-cell-sub">{o?.buyer?.email||""}</div>
                      </td>
                      <td className="ao-cell-mono">{o?.buyer?.telefono||"—"}</td>
                      <td style={{textTransform:"capitalize",fontSize:".85rem"}}>{o.paymentMethod||"—"}</td>
                      <td><Badge s={o.status}/></td>
                      <td style={{textAlign:"right"}}><span className="ao-cell-total">{$m(o.total)}</span></td>
                      <td>
                        <div style={{fontWeight:700,fontSize:".86rem"}}>{envio?"📦 Envío":"🏪 Retiro"}</div>
                        <div className="ao-cell-sub">{envio?adr(o?.shipping?.address):"Coordinamos por WhatsApp"}</div>
                        {o?.shipping?.trackingNumber&&<span className="ao-track-pill">🚚 {o.shipping.trackingNumber}</span>}
                        {o?.shipping?.deliveredAt&&<div className="ao-cell-sub">Entregado: {new Date(o.shipping.deliveredAt).toLocaleDateString("es-AR")}</div>}
                      </td>
                      <td>
                        <div className="ao-actions-col">
                          <button className="ao-btn ao-btn-outline" onClick={()=>setDetail(o)} type="button">VER</button>
                          {o.status==="pending"&&<>
                            <button className="ao-btn ao-btn-confirm" onClick={()=>openAct("confirm",o)} type="button">CONFIRMAR</button>
                            <button className="ao-btn ao-btn-reject"  onClick={()=>openAct("reject",o)}  type="button">RECHAZAR</button>
                          </>}
                          {canShip   &&<button className="ao-btn ao-btn-ship"    onClick={()=>doShip(o)}   type="button">DESPACHAR</button>}
                          {canRetiro &&<button className="ao-btn ao-btn-ship"    onClick={()=>doRetiro(o)} type="button">LISTO RETIRAR</button>}
                          {canDeliv  &&<button className="ao-btn ao-btn-outline" onClick={()=>doDeliv(o)}  type="button">ENTREGADO</button>}
                          <button className="ao-btn ao-btn-delete" onClick={()=>openDel(o)} type="button">🗑 ELIMINAR</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </div>
      
      {/* MODAL DETALLE MEJORADO */}
{detail && (
  <div className="ao-overlay" onClick={() => setDetail(null)}>
    <div className="ao-modal" onClick={(e) => e.stopPropagation()}>
      <div className="ao-modal-pull" />

      <div className="ao-modal-header">
        <h3>🧾 Pedido {num(detail)}</h3>
        <button onClick={() => setDetail(null)} className="ao-x">✕</button>
      </div>

      <div className="ao-modal-body">

        {/* ESTADO + TOTAL */}
        <div className="ao-confirm-box">
          <div><b>Estado:</b> <Badge s={detail.status} /></div>
          <div><b>Total:</b> {$m(detail.total)}</div>
          <div><b>Método de pago:</b> {detail.paymentMethod}</div>
        </div>

        {/* CLIENTE */}
        <div className="ao-confirm-box">
          <div><b>Cliente:</b> {detail?.buyer?.nombre || "—"}</div>
          <div><b>Email:</b> {detail?.buyer?.email || "—"}</div>
          <div><b>Teléfono:</b> {detail?.buyer?.telefono || "—"}</div>
        </div>

        {/* ENTREGA */}
        <div className="ao-confirm-box">
          <div>
            <b>Entrega:</b>{" "}
            {detail?.shipping?.method === "envio"
              ? "📦 Envío a domicilio"
              : "🏪 Retiro en local"}
          </div>

          {detail?.shipping?.method === "envio" && (
            <div><b>Dirección:</b> {adr(detail?.shipping?.address)}</div>
          )}

          {detail?.shipping?.trackingNumber && (
            <div>
              <b>Tracking:</b>{" "}
              <span className="ao-cell-mono">
                {detail.shipping.trackingNumber}
              </span>
            </div>
          )}
        </div>

        {/* PRODUCTOS DETALLADOS PRO */}
<div className="ao-confirm-box">
  <b style={{ marginBottom: 8 }}>🛍 Detalle completo del pedido</b>

  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {(detail.items || []).map((it, i) => {
      const precioUnit = it.cantidad ? it.subtotal / it.cantidad : 0;

      return (
        <div
          key={i}
          style={{
            border: "1px solid #f0e8f5",
            borderRadius: 12,
            padding: "10px 12px",
            background: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
          }}
        >
          {/* NOMBRE */}
          <div style={{ fontWeight: 800, fontSize: ".9rem", color: "#18122b" }}>
  {it.nombre}

  {(it?.variant?.size || it?.variant?.color || it?.variant?.tono) && (
    <span style={{ fontWeight: 600, color: "#8b7fa8", marginLeft: 6 }}>
      ({[it?.variant?.size, it?.variant?.color, it?.variant?.tono]
        .filter(Boolean)
        .join(" / ")})
    </span>
  )}
</div>


          {/* VARIANTES */}
          {(it?.variant?.size || it?.variant?.color) && (
            <div style={{ fontSize: ".75rem", color: "#8b7fa8", marginTop: 2 }}>
              📦 Variante: {it.variant.size || "-"} • {it.variant.color || "-"}
            </div>
          )}

          {/* PRECIOS */}
          <div style={{ fontSize: ".8rem", marginTop: 4 }}>
            💲 Unitario: <b>{$m(precioUnit)}</b>
          </div>

          <div style={{ fontSize: ".8rem" }}>
            🔢 Cantidad total: <b>{it.cantidad}</b>
          </div>

          <div style={{ fontSize: ".85rem", marginTop: 2 }}>
            💰 Subtotal: <b>{$m(it.subtotal)}</b>
          </div>

          {/* TONOS DETALLADOS */}
          {Array.isArray(it.distribucionTonos) && it.distribucionTonos.length > 0 && (
            <div
              style={{
                marginTop: 6,
                padding: "6px 8px",
                background: "#fff0f8",
                border: "1px dashed #ff2ea6",
                borderRadius: 8
              }}
            >
              <div style={{
                fontSize: ".7rem",
                fontWeight: 800,
                color: "#e11a8a",
                marginBottom: 4,
                textTransform: "uppercase"
              }}>
                🎨 Distribución de tonos
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {it.distribucionTonos.map((t, j) => (
                  <span
                    key={j}
                    style={{
                      background: "#fff",
                      border: "1px solid #ffd6ed",
                      borderRadius: 6,
                      padding: "2px 6px",
                      fontSize: ".72rem",
                      fontWeight: 700
                    }}
                  >
                    {t.tono}: <span style={{ color: "#ff2ea6" }}>{t.cantidad}</span>
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

      <div className="ao-modal-footer">

        {detail?.buyer?.telefono && (
          <a
            href={`https://wa.me/${tel(detail.buyer.telefono)}`}
            target="_blank"
            rel="noreferrer"
            className="ao-btn ao-btn-wa"
          >
            💬 WhatsApp
          </a>
        )}

        {detail.status === "pending" && (
          <>
            <button className="ao-btn ao-btn-confirm" onClick={() => openAct("confirm", detail)}>
              Confirmar
            </button>
            <button className="ao-btn ao-btn-reject" onClick={() => openAct("reject", detail)}>
              Rechazar
            </button>
          </>
        )}

        <button
          className="ao-btn ao-btn-delete"
          onClick={() => {
            setDetail(null);
            openDel(detail);
          }}
        >
          🗑 Eliminar
        </button>

      </div>
    </div>
  </div>
)}

      {/* MODAL CONFIRMAR/RECHAZAR */}
      {actM.open&&(
        <div className="ao-overlay" onClick={closeAct}>
          <div className="ao-modal" style={{maxWidth:460}} onClick={e=>e.stopPropagation()}>
            <div className="ao-modal-pull"/>
            <div className="ao-modal-header">
              <h3 style={{color:actM.type==="reject"?"#dc2626":"#059669"}}>
                {actM.type==="reject"?"🚫 Rechazar orden":"✅ Confirmar pago"}
              </h3>
              <button onClick={closeAct} className="ao-x" type="button">✕</button>
            </div>
            <div className="ao-modal-body">
              <p>{actM.type==="reject"?"Esta acción cancelará la orden permanentemente.":"Vas a marcar esta orden como pagada."}</p>
              <div className={`ao-confirm-box${actM.type==="reject"?" ao-confirm-box-danger":""}`}>
                <div><b>Pedido:</b> {num(actM.order)}</div>
                <div><b>Cliente:</b> {actM.order?.buyer?.nombre||"—"}</div>
                <div><b>Total:</b> {$m(actM.order?.total)}</div>
              </div>
            </div>
            <div className="ao-modal-footer">
              <button className="ao-btn ao-btn-outline" onClick={closeAct} disabled={actM.loading} type="button">Cancelar</button>
              {actM.type==="reject"
                ?<button className="ao-btn ao-btn-reject"  onClick={doAction} disabled={actM.loading} type="button">{actM.loading?"Procesando…":"Rechazar"}</button>
                :<button className="ao-btn ao-btn-confirm" onClick={doAction} disabled={actM.loading} type="button">{actM.loading?"Procesando…":"Confirmar pago"}</button>
              }
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {delM.open&&(
        <div className="ao-overlay" onClick={closeDel}>
          <div className="ao-modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div className="ao-modal-pull"/>
            <div className="ao-modal-header">
              <h3 style={{color:"#dc2626"}}>🗑 Eliminar orden</h3>
              <button onClick={closeDel} className="ao-x" type="button">✕</button>
            </div>
            <div className="ao-modal-body">
              <p>Esta acción no se puede deshacer.</p>
              <div className="ao-confirm-box ao-confirm-box-danger">
                <div><b>Pedido:</b> {num(delM.order)}</div>
                <div><b>Cliente:</b> {delM.order?.buyer?.nombre||"—"}</div>
                <div><b>Estado:</b> <Badge s={delM.order?.status}/></div>
                <div><b>Total:</b> {$m(delM.order?.total)}</div>
              </div>
            </div>
            <div className="ao-modal-footer">
              <button className="ao-btn ao-btn-outline" onClick={closeDel} disabled={delM.loading} type="button">Cancelar</button>
              {delM.order?.status === "deleted" ? (
                <button className="ao-btn ao-btn-reject" onClick={doDelPerm} disabled={delM.loading} type="button">
                  {delM.loading ? "Eliminando…" : "🗑 Eliminar para siempre"}
                </button>
              ) : (
                <button className="ao-btn ao-btn-reject" onClick={doDel} disabled={delM.loading} type="button">
                  {delM.loading ? "Eliminando…" : "Sí, eliminar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL WHATSAPP */}
      {waM.open&&(
        <div className="ao-overlay" onClick={closeWaM}>
          <div className="ao-modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div className="ao-modal-pull"/>
            <div className="ao-modal-header">
              <h3 style={{color:"#059669"}}>✅ Pedido confirmado</h3>
              <button onClick={closeWaM} className="ao-x" type="button">✕</button>
            </div>
            <div className="ao-modal-body">
              <p style={{marginBottom:8}}>El pedido <b>{num(waM.order)}</b> fue marcado como pagado.</p>
              {waM.order?.shippingTicket && (
                <div style={{
                  display:"flex", alignItems:"center", gap:".6rem",
                  background:"#fff0f8", border:"1.5px dashed var(--pink)",
                  borderRadius:10, padding:"8px 12px", marginBottom:12,
                }}>
                  <span style={{fontSize:".7rem",fontWeight:800,color:"var(--pink-h)",textTransform:"uppercase",letterSpacing:".05em"}}>
                    Código del pedido
                  </span>
                  <span style={{fontFamily:"monospace",fontWeight:900,fontSize:"1rem",color:"var(--pink)",flex:1,letterSpacing:"1px"}}>
                    {waM.order.shippingTicket}
                  </span>
                  <button
                    type="button"
                    className="ao-btn-xs"
                    onClick={()=>navigator.clipboard.writeText(waM.order.shippingTicket)}
                  >
                    Copiar
                  </button>
                </div>
              )}
              <div className="ao-confirm-box" style={{gap:0}}>
                <p style={{margin:"0 0 8px",fontSize:".75rem",fontWeight:800,textTransform:"uppercase",letterSpacing:".06em",color:"var(--muted)"}}>
                  Mensaje para el cliente
                </p>
                <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:".82rem",lineHeight:1.6,color:"var(--ink2)",fontFamily:"inherit",background:"transparent"}}>
                  {waTxt(waM.order)}
                </pre>
              </div>
            </div>
            <div className="ao-modal-footer" style={{gridTemplateColumns:"1fr"}}>
              <a
                href={waM.link}
                target="_blank"
                rel="noreferrer"
                className="ao-btn ao-btn-wa"
                onClick={closeWaM}
                style={{justifyContent:"center"}}
              >
                💬 Abrir WhatsApp y enviar
              </a>
              <button
                className="ao-btn ao-btn-outline"
                type="button"
                onClick={()=>{
                  try {
  const txt = decodeURIComponent(waM.link?.split("?text=")[1] || "");
  navigator.clipboard.writeText(txt);
} catch {
  navigator.clipboard.writeText(waTxt(waM.order));
}
                  closeWaM();
                }}
              >
                📋 Copiar mensaje y cerrar
              </button>
              <button
                className="ao-btn"
                type="button"
                style={{background:"#f5f5f5",color:"var(--ink)"}}
                onClick={closeWaM}
              >
                Cerrar sin enviar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}