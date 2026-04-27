// AdminOrders.jsx — v5 Premium
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./AdminOrders.css";

const API_URL  = import.meta.env.VITE_API_URL  || "http://localhost:4000";
const ADMIN_WA = (import.meta.env.VITE_ADMIN_PHONE || "").replace(/\D/g, "");

/* helpers */
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
  const lines = (o.items||[]).map(it => {
    const vp = it?.variant?.size||it?.variant?.color
      ? ` (${[it?.variant?.size,it?.variant?.color].filter(Boolean).join(" / ")})`:"";
    return `• ${it.nombre}${vp} ×${it.cantidad} — ${$m(it.subtotal)}`;
  }).join("\n");
  return [
    "✅ *Pedido confirmado*","",
    `*Pedido:* ${num(o)}`,`*Pago:* ${o.paymentMethod}`,"",
    `*Cliente:* ${o?.buyer?.nombre||"-"}`,`*Tel:* ${o?.buyer?.telefono||"-"}`,"",
    `*Entrega:* ${envio?"Envío":("Retiro en local")}`,
    ...(envio?[`*Dir:* ${adr(o?.shipping?.address||{})}`]:[]),"",
    "*Productos:*",lines||"—","",`*Total:* ${$m(o.total)}`,
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
        if (lnk) window.open(lnk,"_blank","noopener,noreferrer");
      } else {
        setMsg("🚫 Orden rechazada");
        setOrders(a=>a.map(o=>o._id===order._id?{...o,status:"cancelled"}:o));
        if (detail?._id===order._id) setDetail(x=>({...x,status:"cancelled"}));
      }
      closeAct();
    } catch(e) { setMsg("❌ "+e.message); setActM(m=>({...m,loading:false})); }
  };

  const doDel = async () => {
    if (!secret||!delM.order) return;
    setDelM(m=>({...m,loading:true}));
    try {
      const r = await fetch(`${API_URL}/api/payments/order/${delM.order._id}`,{method:"DELETE",headers:{"x-admin-secret":secret}});
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message||"Error");
      // Actualizar status a "deleted" en el array local en lugar de filtrar
      // Así si el tab es "deleted" aparece, si es otro desaparece
      setOrders(a=>a.map(o=>o._id===delM.order._id ? {...o,status:"deleted"} : o));
      if (detail?._id===delM.order._id) setDetail(null);
      setMsg("🗑 Orden eliminada — aparece en tab 'Eliminadas'");
      closeDel();
      // Recargar desde el backend para tener el estado real
      setTimeout(()=>fetch_(), 300);
    } catch(e) { setMsg("❌ "+e.message); setDelM(m=>({...m,loading:false})); }
  };

  const doShip = async (order) => {
    const isRetiro = order?.shipping?.method === "retiro";
    const tn = isRetiro ? "" : (window.prompt("Número de tracking (opcional):", order?.shipping?.trackingNumber||"")||"");
    if (!isRetiro && tn === null) return;
    const co = isRetiro ? "" : (window.prompt("Empresa de envío (ej: Andreani, OCA):", order?.shipping?.company||"")||"").trim();
    let mt = order?.shipping?.method || "envio";
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
        // Para retiro: marcar como entregado automáticamente
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
      // ship sin tracking (solo marca shippedAt)
      const r1 = await fetch(`${API_URL}/api/payments/order/${order._id}/ship`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-admin-secret":secret},
        body: JSON.stringify({ method: "retiro" }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1?.message || "Error al marcar listo");
      // inmediatamente delivered
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

      {/* Nav */}
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

        {/* Tabs */}
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

          {/* ══ CARDS MÓVIL ══ */}
          <div className="ao-cards">
            {rows.map(o=>{
              const d=new Date(o.createdAt);
              const envio=o?.shipping?.method==="envio";
              const isRetiro=o?.shipping?.method==="retiro";
              const canShip=o.status==="paid"&&!o?.shipping?.shippedAt&&!isRetiro;
              const canRetiro=o.status==="paid"&&!o?.shipping?.deliveredAt&&isRetiro;
              const canDeliv=o.status==="paid"&&!o?.shipping?.deliveredAt&&!isRetiro&&!!o?.shipping?.trackingNumber;
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
                    {canShip   &&<button className="ao-btn ao-btn-ship"    onClick={()=>doShip(o)}  type="button">📦 Despachar</button>}
                    {canRetiro &&<button className="ao-btn ao-btn-ship"    onClick={()=>doShip(o)}  type="button">🏪 Listo para retirar</button>}
                    {canDeliv  &&<button className="ao-btn ao-btn-outline" onClick={()=>doDeliv(o)} type="button">✅ Entregado</button>}
                    <button className="ao-btn ao-btn-delete full-col" onClick={()=>openDel(o)} type="button">🗑 Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ══ TABLA DESKTOP ══ */}
          <div className="ao-table-wrap">
            <table className="ao-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Método</th>
                  <th>Estado</th>
                  <th style={{textAlign:"right"}}>Total</th>
                  <th>Entrega</th>
                  <th>Acciones</th>
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

      {/* ══ MODAL DETALLE ══ */}
      {detail&&(
        <div className="ao-overlay" onClick={()=>setDetail(null)}>
          <div className="ao-modal" onClick={e=>e.stopPropagation()}>
            <div className="ao-modal-pull"/>
            <div className="ao-modal-header">
              <h3>Detalle del pedido</h3>
              <button onClick={()=>setDetail(null)} className="ao-x" type="button">✕</button>
            </div>
            <div className="ao-modal-body">
              <p><b>Pedido:</b> {num(detail)} &nbsp;<Badge s={detail.status}/></p>
              <p><b>Método:</b> {detail.paymentMethod} &nbsp;·&nbsp; <b>Total:</b> {$m(detail.total)}</p>
              <p><b>Cliente:</b> {detail?.buyer?.nombre||"—"} — {detail?.buyer?.email||"—"}</p>
              <p><b>Teléfono:</b> {detail?.buyer?.telefono||"—"}</p>
              <p><b>Entrega:</b> {detail?.shipping?.method==="envio"?`Envío a ${adr(detail?.shipping?.address)}`:"Retiro en local"}</p>
              {detail?.shipping?.trackingNumber&&<p><b>Tracking:</b> <span className="ao-cell-mono">{detail.shipping.trackingNumber}</span></p>}
              {detail?.shipping?.deliveredAt&&<p><b>Entregado:</b> {new Date(detail.shipping.deliveredAt).toLocaleString("es-AR")}</p>}
              <div className="ao-modal-items">
                <b>Productos:</b>
                <ul>
                  {(detail.items||[]).map((it,i)=>(
                    <li key={i}>
                      {it.nombre}
                      {it?.variant?.size||it?.variant?.color?` (${[it?.variant?.size,it?.variant?.color].filter(Boolean).join(" / ")})`:""}
                      {" "}×{it.cantidad} — {$m(it.subtotal)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="ao-modal-footer">
              {detail?.buyer?.telefono&&(
                <a href={`https://wa.me/${tel(detail.buyer.telefono)}?text=${encodeURIComponent(
                  `Hola ${detail?.buyer?.nombre||""}, soy AESTHETIC. Tu pedido ${num(detail)} está ${detail.status}.`
                )}`} target="_blank" rel="noreferrer" className="ao-btn ao-btn-wa">💬 WhatsApp</a>
              )}
              {detail.status==="pending"&&<>
                <button className="ao-btn ao-btn-confirm" onClick={()=>openAct("confirm",detail)} type="button">Confirmar</button>
                <button className="ao-btn ao-btn-reject"  onClick={()=>openAct("reject",detail)}  type="button">Rechazar</button>
              </>}
              {detail.status==="paid"&&!detail?.shipping?.shippedAt&&detail?.shipping?.method!=="retiro"&&(
                <button className="ao-btn ao-btn-ship" onClick={()=>doShip(detail)} type="button">📦 Despachar</button>
              )}
              {detail.status==="paid"&&!detail?.shipping?.deliveredAt&&detail?.shipping?.method==="retiro"&&(
                <button className="ao-btn ao-btn-ship" onClick={()=>doRetiro(detail)} type="button">🏪 Listo para retirar</button>
              )}
              {!detail?.shipping?.deliveredAt&&!!detail?.shipping?.trackingNumber&&detail?.shipping?.method!=="retiro"&&(
                <button className="ao-btn ao-btn-outline" onClick={()=>doDeliv(detail)} type="button">✅ Entregado</button>
              )}
              <button className="ao-btn ao-btn-delete" onClick={()=>{setDetail(null);openDel(detail);}} type="button">🗑 Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CONFIRMAR/RECHAZAR ══ */}
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

      {/* ══ MODAL ELIMINAR ══ */}
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
              <button className="ao-btn ao-btn-outline" onClick={closeDel}   disabled={delM.loading} type="button">Cancelar</button>
              <button className="ao-btn ao-btn-reject"  onClick={doDel}      disabled={delM.loading} type="button">
                {delM.loading?"Eliminando…":"Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}