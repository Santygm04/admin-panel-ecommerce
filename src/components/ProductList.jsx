import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import ConfirmDialog from "./ConfirmDialog";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API = API_BASE ? `${API_BASE}/api` : "/api";

/* ── Helpers promo ────────────────────────────────────── */
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const money  = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

function parsePromoInput(input, basePrice) {
  const base = Number(basePrice || 0);
  const raw  = String(input ?? "").trim().replace(",", ".");
  if (!raw) return { mode: null, price: null, pct: null };

  if (/%$/.test(raw)) {
    const pct   = clamp(parseFloat(raw.replace("%", "")) || 0, 0, 100);
    const price = Math.max(0, Math.round(base * (1 - pct / 100)));
    return { mode: "percent", price, pct: Math.round(pct) };
  }
  const n = Number(raw);
  if (isFinite(n) && n > 0 && n < 1) {
    const pct   = clamp(n * 100, 0, 100);
    const price = Math.max(0, Math.round(base * (1 - n)));
    return { mode: "percent", price, pct: Math.round(pct) };
  }
  if (isFinite(n) && n >= 0) {
    const price = Math.max(0, Math.round(n));
    const pct   = base > 0 ? Math.round(clamp((1 - price / base) * 100, 0, 100)) : null;
    return { mode: "abs", price, pct };
  }
  return { mode: "invalid", price: null, pct: null };
}

/* ── Clases reutilizables ─────────────────────────────── */
const BTN_BASE = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-black cursor-pointer border-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN = {
  edit:  `${BTN_BASE} bg-[#4caf50] text-white`,
  show:  `${BTN_BASE} bg-[#e9fbf1] text-[#0f7b42] border border-[#b8f0d0]`,
  hide:  `${BTN_BASE} bg-[#ffe9ea] text-[#b10000] border border-[#ffc8cc]`,
  del:   `${BTN_BASE} bg-red-600 text-white`,
  stk:   "inline-flex items-center justify-center min-w-[38px] h-9 px-2 border border-[#efc9df] bg-[#fff0f7] text-[#d63384] rounded-xl cursor-pointer font-black text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed",
  promo: `${BTN_BASE} bg-[#d63384] text-white px-3 py-1.5`,
};

const CATEGS_VALIDAS = [
  "mujer","niñas","maquillaje","skincare","bodycare",
  "bijouterie","marroquineria","pestañas","peluquería",
  "promos","nuevos-ingresos","uñas","lenceria",
];

export default function ProductList() {
  const [productos,       setProductos]       = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [q,               setQ]               = useState("");
  const [saving,          setSaving]          = useState(new Set());
  const [drafts,          setDrafts]          = useState({});
  const [notif,           setNotif]           = useState(null);
  const [stockDrafts,     setStockDrafts]     = useState({});
  const [savingStock,     setSavingStock]     = useState(new Set());
  const [savingVis,       setSavingVis]       = useState(new Set());
  const [savingDel,       setSavingDel]       = useState(new Set());
  const [confirmData,     setConfirmData]     = useState(null);

  /* ── Carga ── */
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API}/productos`, {
          params: { limit: 500, q, admin: true },
          signal: ctrl.signal,
        });
        const items = Array.isArray(data) ? data : data.items || [];
        setProductos(items);
        setDrafts(prev => {
          const next = { ...prev };
          for (const p of items) {
            if (!next[p._id]) next[p._id] = {
              promoActivo:      !!(p.promo?.active),
              precioPromoInput: typeof p.promo?.precio === "number" ? String(p.promo.precio) : "",
            };
          }
          return next;
        });
        setStockDrafts(prev => {
          const next = { ...prev };
          for (const p of items) if (next[p._id] === undefined) next[p._id] = p.stock ?? 0;
          return next;
        });
      } catch (err) {
        if (err.name !== "CanceledError") console.error("Error al obtener productos", err);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const productosFiltrados = useMemo(() => {
    const base = productos.filter(p => CATEGS_VALIDAS.includes(p.categoria));
    return categoriaFiltro ? base.filter(p => p.categoria === categoriaFiltro) : base;
  }, [productos, categoriaFiltro]);

  const categoriasUnicas = useMemo(
    () => CATEGS_VALIDAS.filter(cat => productos.some(p => p.categoria === cat)),
    [productos]
  );

  const showNotif = (type, text) => {
    setNotif({ type, text });
    clearTimeout(showNotif._t);
    showNotif._t = setTimeout(() => setNotif(null), 2200);
  };

  /* ── Stock ── */
  const setStockDraft = (id, value) =>
    setStockDrafts(prev => ({ ...prev, [id]: Math.max(0, parseInt(value, 10) || 0) }));

  const commitStock = async (id, overrideVal) => {
    const prod    = productos.find(p => p._id === id);
    const current = overrideVal ?? stockDrafts[id] ?? prod?.stock ?? 0;
    if (prod && Number(prod.stock ?? 0) === Number(current)) return;
    const s = new Set(savingStock); s.add(id); setSavingStock(s);
    try {
      const { data } = await axios.put(`${API}/productos/${id}`, { stock: current });
      setProductos(prev => prev.map(p => p._id === id ? { ...p, stock: data.stock, visible: data.visible } : p));
      setStockDrafts(prev => ({ ...prev, [id]: data.stock }));
    } catch (err) {
      showNotif("err", err?.response?.data?.message || "Error al actualizar stock");
    } finally { const s2 = new Set(s); s2.delete(id); setSavingStock(s2); }
  };

  const changeStockBy = (id, delta) => {
    const base = stockDrafts[id] ?? productos.find(p => p._id === id)?.stock ?? 0;
    const next = Math.max(0, base + delta);
    setStockDraft(id, next);
    commitStock(id, next);
  };

  /* ── Visibilidad ── */
  const setVisible = async (id, visible) => {
    const sv = new Set(savingVis); sv.add(id); setSavingVis(sv);
    try {
      let resp;
      try       { resp = await axios.patch(`${API}/productos/${id}/visible`, { visible }); }
      catch (e) {
        const st = e?.response?.status;
        if (st === 404 || st === 405) resp = await axios.put(`${API}/productos/${id}`, { visible });
        else throw e;
      }
      setProductos(prev => prev.map(p => p._id === id ? { ...p, visible: resp.data.visible } : p));
      showNotif("ok", visible ? "Producto mostrado" : "Producto ocultado");
    } catch (e) {
      showNotif("err", e?.response?.data?.message || "No se pudo cambiar visibilidad");
    } finally { const sv2 = new Set(sv); sv2.delete(id); setSavingVis(sv2); }
  };

  /* ── Delete ── */
  const askDelete = (id, nombre) => setConfirmData({ id, nombre });
  const deleteNow = async () => {
    if (!confirmData?.id) return;
    const id  = confirmData.id;
    const sd  = new Set(savingDel); sd.add(id); setSavingDel(sd);
    try {
      await axios.delete(`${API}/productos/${id}`);
      setProductos(prev => prev.filter(p => p._id !== id));
      showNotif("ok", "Producto eliminado");
    } catch (e) {
      showNotif("err", e?.response?.data?.message || "No se pudo eliminar");
    } finally {
      const sd2 = new Set(sd); sd2.delete(id); setSavingDel(sd2);
      setConfirmData(null);
    }
  };

  /* ── Promo helpers ── */
  const promoCambia = (p) => {
    const d        = drafts[p._id] || {};
    const origAct  = !!(p.promo?.active);
    const origPrecio = p.promo && typeof p.promo.precio === "number" ? Math.round(p.promo.precio) : null;
    const curAct   = !!d.promoActivo;
    const parsed   = parsePromoInput(d.precioPromoInput, p.precio);
    const curPrecio = curAct ? parsed.price : null;
    return origAct !== curAct || Math.round(origPrecio ?? -1) !== Math.round(curPrecio ?? -1);
  };

  const savePromo = (producto) => {
    const id     = producto._id;
    const cur    = drafts[id] || {};
    const parsed = parsePromoInput(cur.precioPromoInput, producto.precio);
    if (cur.promoActivo) {
      if (parsed.mode === "invalid" || parsed.price == null) { showNotif("err", "Ingresá un % (ej. 25%) o un precio válido"); return; }
      if (parsed.price >= Number(producto.precio))           { showNotif("err", "El precio promo debe ser menor al precio base"); return; }
    }
    const body = { promoActivo: !!cur.promoActivo, precioPromo: cur.promoActivo ? parsed.price : null };
    const s = new Set(saving); s.add(id); setSaving(s);
    axios.put(`${API}/productos/${id}`, body)
      .then(({ data }) => {
        setProductos(prev => prev.map(x => x._id === id ? { ...x, ...data } : x));
        setDrafts(prev => ({
          ...prev,
          [id]: {
            promoActivo:      !!(data.promo?.active),
            precioPromoInput: typeof data.promo?.precio === "number" ? String(data.promo.precio) : "",
          },
        }));
        showNotif("ok", "Promo guardada");
      })
      .catch(err => showNotif("err", err?.response?.data?.message || "Error al guardar promo"))
      .finally(() => { const s2 = new Set(s); s2.delete(id); setSaving(s2); });
  };

  /* ── Sub-componentes render ── */
  const StockControls = ({ producto }) => {
    const sv  = stockDrafts[producto._id] ?? producto.stock ?? 0;
    const isSv = savingStock.has(producto._id);
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {[-10, -1].map(d => (
          <button key={d} className={BTN.stk} onClick={() => changeStockBy(producto._id, d)} disabled={isSv || sv <= 0} type="button">{d}</button>
        ))}
        <input
          type="number" min="0"
          className="w-14 h-9 text-center border border-[#efc9df] rounded-xl bg-white text-gray-800 font-black text-sm outline-none focus:border-[#d63384] focus:shadow-[0_0_0_3px_rgba(214,51,132,0.1)] disabled:opacity-50"
          value={sv}
          onChange={e => setStockDraft(producto._id, e.target.value)}
          onBlur={() => commitStock(producto._id)}
          onKeyDown={e => { if (e.key === "Enter") commitStock(producto._id); if (e.key === "Escape") setStockDraft(producto._id, producto.stock ?? 0); }}
          onWheel={e => e.currentTarget.blur()}
          disabled={isSv}
          aria-label="Stock"
        />
        {[+1, +10].map(d => (
          <button key={d} className={BTN.stk} onClick={() => changeStockBy(producto._id, d)} disabled={isSv} type="button">+{d}</button>
        ))}
      </div>
    );
  };

  const PromoEditor = ({ producto }) => {
    const d = drafts[producto._id] || {
      promoActivo:      !!(producto.promo?.active),
      precioPromoInput: typeof producto.promo?.precio === "number" ? String(producto.promo.precio) : "",
    };
    const parsed    = parsePromoInput(d.precioPromoInput, producto.precio);
    const previewOk = d.promoActivo && parsed.price != null && parsed.mode !== "invalid" && parsed.price < Number(producto.precio);

    return (
      <div className="flex flex-col gap-1.5 items-start w-full">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={!!d.promoActivo} className="accent-[#d63384]"
            onChange={e => setDrafts(prev => ({ ...prev, [producto._id]: { ...prev[producto._id], promoActivo: e.target.checked } }))} />
          Promo activa
        </label>
        <input
          type="text" inputMode="decimal" placeholder="$ o %"
          className="w-28 px-2 py-1.5 border border-[#efc9df] rounded-xl bg-white text-sm text-right outline-none focus:border-[#d63384] focus:shadow-[0_0_0_3px_rgba(214,51,132,0.1)] disabled:opacity-50"
          value={d.precioPromoInput ?? ""}
          onChange={e => setDrafts(prev => ({ ...prev, [producto._id]: { ...prev[producto._id], precioPromoInput: e.target.value } }))}
          disabled={!d.promoActivo}
        />
        {d.promoActivo && (
          <span className={`text-xs font-black ${previewOk ? "text-emerald-600" : "text-red-600"}`}>
            {previewOk
              ? `→ $${money(parsed.price)} ${parsed.pct != null ? `(-${parsed.pct}%)` : ""}`
              : d.precioPromoInput ? "Valor inválido" : "Ingresá $ o %"}
          </span>
        )}
        <button className={BTN.promo} onClick={() => savePromo(producto)}
          disabled={saving.has(producto._id) || !promoCambia(producto)} type="button">
          {saving.has(producto._id) ? "Guardando…" : "Guardar promo"}
        </button>
      </div>
    );
  };

  const AccionesBtns = ({ producto }) => {
    const oculto      = producto.visible === false;
    const sv          = stockDrafts[producto._id] ?? producto.stock ?? 0;
    const puedeOcultar= !oculto && Number(sv) <= 0;
    const isSvVis     = savingVis.has(producto._id);
    const isDeleting  = savingDel.has(producto._id);
    return (<>
      <Link to={`/editar/${producto._id}`} className={BTN.edit}>Editar</Link>
      {oculto
        ? <button className={BTN.show} onClick={() => setVisible(producto._id, true)}  disabled={isSvVis} type="button">{isSvVis ? "…" : "Mostrar"}</button>
        : <button className={BTN.hide} onClick={() => setVisible(producto._id, false)} disabled={isSvVis || !puedeOcultar} title={puedeOcultar ? "Ocultar (sin stock)" : "Solo cuando stock = 0"} type="button">{isSvVis ? "…" : "Ocultar"}</button>}
      <button className={BTN.del} onClick={() => askDelete(producto._id, producto.nombre)} disabled={isDeleting} type="button">{isDeleting ? "…" : "Eliminar"}</button>
    </>);
  };

  const catLabel = (cat) =>
    cat === "nuevos-ingresos" ? "Nuevos ingresos" : cat?.charAt(0).toUpperCase() + (cat?.slice(1) || "");

  return (
    <div className="w-full" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>

      {/* ── Toast ── */}
      {notif && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:min-w-[260px] sm:max-w-sm z-[2000] px-4 py-3 rounded-2xl font-black text-sm shadow-[0_10px_28px_rgba(0,0,0,0.12)] animate-[toastIn_.18s_ease-out]
          ${notif.type === "ok" ? "bg-[#e9fbf1] text-[#0f7b42] border border-[#b8f0d0]" : "bg-[#ffe9ea] text-[#b10000] border border-[#ffc8cc]"}`}>
          {notif.text}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmData}
        title="Eliminar producto"
        message={confirmData ? `¿Eliminar definitivamente "${confirmData.nombre}"? Esta acción no se puede deshacer.` : ""}
        confirmText="Eliminar" cancelText="Cancelar"
        onConfirm={deleteNow} onCancel={() => setConfirmData(null)}
        loading={confirmData ? savingDel.has(confirmData.id) : false}
      />

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="m-0 text-lg font-black text-gray-800">📦 Control de Stock</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#fff3f9] text-[#d63384] border border-[#f4d6e8] text-xs font-black">
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:w-auto sm:ml-auto">
          <input
            type="search" placeholder="Buscar productos…" value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full sm:w-52 h-11 border border-[#e7d3dd] rounded-xl px-3 text-sm outline-none bg-white focus:border-[#d63384] focus:shadow-[0_0_0_3px_rgba(214,51,132,0.08)]"
          />
          <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
            className="w-full sm:w-auto h-11 border border-[#e7d3dd] rounded-xl px-3 text-sm outline-none bg-white focus:border-[#d63384]">
            <option value="">Todas las categorías</option>
            {categoriasUnicas.map(cat => (
              <option key={cat} value={cat}>{catLabel(cat)}</option>
            ))}
          </select>
          {categoriaFiltro && (
            <button onClick={() => setCategoriaFiltro("")}
              className="h-11 px-3 rounded-xl bg-[#fff4f4] text-[#b10000] font-black text-sm cursor-pointer border-0 whitespace-nowrap"
              type="button">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── Vacío ── */}
      {productosFiltrados.length === 0 && (
        <div className="border border-dashed border-[#f4d6e8] rounded-2xl p-8 text-center text-gray-400 font-bold">
          No hay productos en esta categoría.
        </div>
      )}

      {/* ════════════════════════════════════════
          CARDS — visible < lg
          ════════════════════════════════════════ */}
      {productosFiltrados.length > 0 && (
        <div className="flex flex-col gap-3 lg:hidden">
          {productosFiltrados.map(producto => {
            const oculto = producto.visible === false;
            return (
              <article key={producto._id}
                className="bg-white border border-[#f4d6e8] rounded-2xl p-3 shadow-[0_10px_28px_rgba(214,51,132,0.08)]">

                {/* Fila superior: imagen + info básica */}
                <div className="flex gap-3 mb-3">
                  <img src={producto.imagen} alt={producto.nombre}
                    className="w-[70px] h-[70px] object-cover rounded-xl flex-shrink-0 border border-[#f0e3eb]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <h3 className="m-0 text-sm font-black text-gray-800 leading-tight">{producto.nombre}</h3>
                      {oculto && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ffe9ea] text-[#b10000] border border-[#ffc8cc] text-[10px] font-black">
                          Oculto
                        </span>
                      )}
                    </div>
                    <p className="m-0 text-[#d63384] font-black text-base">${Number(producto.precio).toLocaleString("es-AR")}</p>
                    <p className="m-0 text-gray-400 text-xs mt-0.5">
                      {catLabel(producto.categoria)}{producto.subcategoria ? ` · ${producto.subcategoria}` : ""}
                      {producto.destacado ? " · ⭐" : ""}
                    </p>
                  </div>
                </div>

                {/* Stock */}
                <div className="border-t border-[#f6e6ef] pt-3 mb-3">
                  <p className="m-0 mb-2 text-[#d63384] font-black text-[10px] uppercase tracking-wider">Stock</p>
                  <StockControls producto={producto} />
                </div>

                {/* Promo */}
                <div className="border-t border-[#f6e6ef] pt-3 mb-3">
                  <p className="m-0 mb-2 text-[#d63384] font-black text-[10px] uppercase tracking-wider">Promoción</p>
                  <PromoEditor producto={producto} />
                </div>

                {/* Acciones: 3 col */}
                <div className="border-t border-[#f6e6ef] pt-3 grid grid-cols-3 gap-1.5">
                  <AccionesBtns producto={producto} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════
          TABLA — visible ≥ lg
          ════════════════════════════════════════ */}
      {productosFiltrados.length > 0 && (
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                {["Imagen","Nombre","Precio","Categoría","Subcategoría","Stock","Dest.","Promo","Acciones"].map(h => (
                  <th key={h} className="text-left px-3 py-3 bg-[#fff8fc] text-gray-600 font-black text-xs border-b border-[#f2e6ed]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map(producto => {
                const oculto = producto.visible === false;
                return (
                  <tr key={producto._id} className="hover:bg-[#fffafd]">
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-middle">
                      <img src={producto.imagen} alt={producto.nombre}
                        className="w-14 h-14 object-cover rounded-xl" />
                    </td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-middle max-w-[200px]">
                      <span className="font-semibold text-sm text-gray-800 break-words">{producto.nombre}</span>
                      {oculto && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#ffe9ea] text-[#b10000] border border-[#ffc8cc] text-[10px] font-black">Oculto</span>
                      )}
                    </td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-middle text-sm font-semibold whitespace-nowrap">
                      ${Number(producto.precio).toLocaleString("es-AR")}
                    </td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-middle text-sm">{catLabel(producto.categoria)}</td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-middle text-sm text-gray-500">{producto.subcategoria || "—"}</td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-top pt-4">
                      <StockControls producto={producto} />
                    </td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-middle text-center text-base">
                      {producto.destacado ? "⭐" : "—"}
                    </td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-top pt-3 min-w-[170px]">
                      <PromoEditor producto={producto} />
                    </td>
                    <td className="px-3 py-3 border-b border-[#f2e6ed] align-top pt-3">
                      <div className="flex flex-col gap-1.5">
                        <AccionesBtns producto={producto} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Keyframe para el toast */}
      <style>{`@keyframes toastIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}