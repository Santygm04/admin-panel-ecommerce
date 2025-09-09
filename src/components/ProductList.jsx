import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./ProductList.css";
import ConfirmDialog from "./ConfirmDialog"; // ajustá la ruta si hace falta

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API = API_BASE ? `${API_BASE}/api` : "/api";

/* ===== Helpers promo ===== */
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const money = (n) =>
  Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

/**
 * Acepta valores como:
 *   "25%"  -> 25% OFF
 *   "0.25" -> 25% OFF (fracción)
 *   "2222" -> $2.222 final (precio fijo)
 * Retorna { mode, price, pct } donde price es el precio final (entero ARS)
 */
function parsePromoInput(input, basePrice) {
  const base = Number(basePrice || 0);
  const raw = String(input ?? "").trim().replace(",", "."); // permitir coma
  if (!raw) return { mode: null, price: null, pct: null };

  // Si termina en % -> porcentaje
  if (/%$/.test(raw)) {
    const pct = clamp(parseFloat(raw.replace("%", "")) || 0, 0, 100);
    const price = Math.max(0, Math.round(base * (1 - pct / 100)));
    return { mode: "percent", price, pct: Math.round(pct) };
  }

  // Si es fracción 0..1 -> porcentaje
  const n = Number(raw);
  if (isFinite(n) && n > 0 && n < 1) {
    const pct = clamp(n * 100, 0, 100);
    const price = Math.max(0, Math.round(base * (1 - n)));
    return { mode: "percent", price, pct: Math.round(pct) };
  }

  // Si es número >= 1 -> precio absoluto
  if (isFinite(n) && n >= 0) {
    const price = Math.max(0, Math.round(n));
    const pct =
      base > 0 ? Math.round(clamp((1 - price / base) * 100, 0, 100)) : null;
    return { mode: "abs", price, pct };
  }

  return { mode: "invalid", price: null, pct: null };
}

export default function ProductList() {
  const [productos, setProductos] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [q, setQ] = useState("");

  // promos
  const [saving, setSaving] = useState(new Set());
  const [drafts, setDrafts] = useState({});
  const [notif, setNotif] = useState(null);

  // stock edit
  const [stockDrafts, setStockDrafts] = useState({});
  const [savingStock, setSavingStock] = useState(new Set());

  // visibilidad
  const [savingVis, setSavingVis] = useState(new Set());

  // delete + confirm modal
  const [savingDel, setSavingDel] = useState(new Set());
  const [confirmData, setConfirmData] = useState(null); // {id, nombre}

  const categoriasValidas = [
    "mujer","niñas","maquillaje","skincare","bodycare",
    "bijouterie","marroquineria","pestañas","peluquería",
    "promos","nuevos-ingresos","uñas","lenceria"
  ];

  // -------- cargar productos (admin) --------
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

        // drafts promo
        setDrafts((prev) => {
          const next = { ...prev };
          for (const p of items) {
            if (!next[p._id]) {
              const act = !!(p.promo && p.promo.active);
              const pr =
                p.promo && typeof p.promo.precio === "number"
                  ? String(p.promo.precio)
                  : "";
              next[p._id] = { promoActivo: act, precioPromoInput: pr };
            }
          }
          return next;
        });

        // drafts stock
        setStockDrafts((prev) => {
          const next = { ...prev };
          for (const p of items) {
            if (next[p._id] === undefined) next[p._id] = p.stock ?? 0;
          }
          return next;
        });
      } catch (err) {
        if (err.name !== "CanceledError")
          console.error("Error al obtener productos", err);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const productosFiltrados = useMemo(() => {
    const base = productos.filter((p) => categoriasValidas.includes(p.categoria));
    if (!categoriaFiltro) return base;
    return base.filter((p) => p.categoria === categoriaFiltro);
  }, [productos, categoriaFiltro]);

  const categoriasUnicas = useMemo(() => {
    return categoriasValidas.filter((cat) => productos.some((p) => p.categoria === cat));
  }, [productos]);

  // -------- helpers --------
  const showNotif = (type, text) => {
    setNotif({ type, text });
    clearTimeout(showNotif._t);
    showNotif._t = setTimeout(() => setNotif(null), 2200);
  };

  // -------- stock ----------
  const setStockDraft = (id, value) => {
    const v = Math.max(0, parseInt(value, 10) || 0);
    setStockDrafts((prev) => ({ ...prev, [id]: v }));
  };

  const commitStock = async (id, overrideVal) => {
    const prod = productos.find((p) => p._id === id);
    const current = overrideVal ?? stockDrafts[id] ?? prod?.stock ?? 0;
    if (prod && Number(prod.stock ?? 0) === Number(current)) return;

    const s = new Set(savingStock);
    s.add(id);
    setSavingStock(s);

    try {
      const { data } = await axios.put(`${API}/productos/${id}`, { stock: current });
      setProductos((prev) =>
        prev.map((p) => (p._id === id ? { ...p, stock: data.stock, visible: data.visible } : p))
      );
      setStockDrafts((prev) => ({ ...prev, [id]: data.stock }));
    } catch (err) {
      showNotif("err", err?.response?.data?.message || "Error al actualizar stock");
    } finally {
      const s2 = new Set(s);
      s2.delete(id);
      setSavingStock(s2);
    }
  };

  const changeStockBy = (id, delta) => {
    const base =
      stockDrafts[id] ?? productos.find((p) => p._id === id)?.stock ?? 0;
    const next = Math.max(0, base + delta);
    setStockDraft(id, next);
    commitStock(id, next);
  };

  // ===================== visibilidad =====================
  const setVisible = async (id, visible) => {
    const sv = new Set(savingVis);
    sv.add(id);
    setSavingVis(sv);

    try {
      let resp;
      try {
        resp = await axios.patch(`${API}/productos/${id}/visible`, { visible });
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404 || status === 405) {
          resp = await axios.put(`${API}/productos/${id}`, { visible });
        } else {
          throw err;
        }
      }
      const data = resp.data;
      setProductos((prev) =>
        prev.map((p) => (p._id === id ? { ...p, visible: data.visible } : p))
      );
      showNotif("ok", visible ? "Producto mostrado" : "Producto ocultado");
    } catch (e) {
      showNotif("err", e?.response?.data?.message || "No se pudo cambiar visibilidad");
    } finally {
      const sv2 = new Set(sv);
      sv2.delete(id);
      setSavingVis(sv2);
    }
  };

  // ===================== eliminar (usa modal) =====================
  const askDelete = (id, nombre) => {
    setConfirmData({ id, nombre });
  };

  const deleteNow = async () => {
    if (!confirmData?.id) return;
    const id = confirmData.id;
    const sd = new Set(savingDel);
    sd.add(id);
    setSavingDel(sd);

    try {
      await axios.delete(`${API}/productos/${id}`);
      setProductos((prev) => prev.filter((p) => p._id !== id));
      showNotif("ok", "Producto eliminado");
    } catch (e) {
      console.error("DELETE error:", e?.response?.status, e?.response?.data);
      showNotif("err", e?.response?.data?.message || "No se pudo eliminar");
    } finally {
      const sd2 = new Set(sd);
      sd2.delete(id);
      setSavingDel(sd2);
      setConfirmData(null);
    }
  };

  const promoCambia = (p) => {
    const d = drafts[p._id] || {};
    const origAct = !!(p.promo && p.promo.active);
    const origPrecio =
      p.promo && typeof p.promo.precio === "number" ? Math.round(p.promo.precio) : null;

    const curAct = !!d.promoActivo;
    const parsed = parsePromoInput(d.precioPromoInput, p.precio);
    const curPrecio = curAct ? parsed.price : null;

    return origAct !== curAct || Math.round(origPrecio ?? -1) !== Math.round(curPrecio ?? -1);
  };

  return (
    <div className="stock-container">
      {notif && (
        <div className={`toast ${notif.type === "ok" ? "ok" : "err"}`}>
          {notif.text}
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmDialog
        open={!!confirmData}
        title="Eliminar producto"
        message={
          confirmData
            ? `¿Eliminar definitivamente “${confirmData.nombre}”? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={deleteNow}
        onCancel={() => setConfirmData(null)}
        loading={confirmData ? savingDel.has(confirmData.id) : false}
      />

      <div className="stock-header">
        <h2>📦 Control de Stock</h2>

        <input
          type="search"
          placeholder="Buscar productos…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="stock-search"
        />

        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categoriasUnicas.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "nuevos-ingresos"
                ? "Nuevos ingresos"
                : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>

        {categoriaFiltro && (
          <button className="btn-reset" onClick={() => setCategoriaFiltro("")} type="button">
            Limpiar filtro
          </button>
        )}
      </div>

      <table className="stock-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th className="col-categoria">Categoría</th>
            <th className="th-hide-sm col-subcat">Subcategoría</th>
            <th>Stock</th>
            <th className="th-hide-sm col-dest">Destacado</th>
            <th className="th-promo col-promo">Promo</th>
            <th className="col-actions">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {productosFiltrados.length === 0 ? (
            <tr>
              <td colSpan="9">No hay productos en esta categoría.</td>
            </tr>
          ) : (
            productosFiltrados.map((producto) => {
              const d =
                drafts[producto._id] || {
                  promoActivo: !!(producto.promo?.active),
                  precioPromoInput:
                    typeof producto.promo?.precio === "number"
                      ? String(producto.promo.precio)
                      : "",
                };

              const stockValue = stockDrafts[producto._id] ?? producto.stock ?? 0;
              const isSavingStock = savingStock.has(producto._id);

              const oculto = producto.visible === false;
              const puedeOcultar = !oculto && (Number(stockValue) <= 0);
              const isSavingVis = savingVis.has(producto._id);
              const isDeleting = savingDel.has(producto._id);

              // Preview promo (precio final + %)
              const parsed = parsePromoInput(d.precioPromoInput, producto.precio);
              const previewOk =
                d.promoActivo &&
                parsed.price != null &&
                parsed.mode !== "invalid" &&
                parsed.price < Number(producto.precio);

              return (
                <tr key={producto._id}>
                  <td>
                    <img
                      src={producto.imagen}
                      alt={producto.nombre}
                      className="thumb"
                    />
                  </td>
                  <td className="td-ellipsis">
                    {producto.nombre}
                    {oculto && <span className="badge-hidden">Oculto</span>}
                  </td>
                  <td>${Number(producto.precio).toLocaleString("es-AR")}</td>
                  <td className="col-categoria">
                    {producto.categoria === "nuevos-ingresos"
                      ? "Nuevos ingresos"
                      : producto.categoria?.charAt(0).toUpperCase() +
                        (producto.categoria?.slice(1) || "")}
                  </td>
                  <td className="td-hide-sm col-subcat">{producto.subcategoria || "—"}</td>

                  {/* STOCK */}
                  <td>
                    <div className="stock-actions">
                      <button
                        className="stk-btn"
                        onClick={() => changeStockBy(producto._id, -10)}
                        disabled={isSavingStock || stockValue <= 0}
                        title="-10"
                        type="button"
                      >
                        -10
                      </button>
                      <button
                        className="stk-btn"
                        onClick={() => changeStockBy(producto._id, -1)}
                        disabled={isSavingStock || stockValue <= 0}
                        title="-1"
                        type="button"
                      >
                        -1
                      </button>

                      <input
                        type="number"
                        min="0"
                        className="stock-input"
                        value={stockValue}
                        onChange={(e) => setStockDraft(producto._id, e.target.value)}
                        onBlur={() => commitStock(producto._id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitStock(producto._id);
                          if (e.key === "Escape") setStockDraft(producto._id, producto.stock ?? 0);
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        disabled={isSavingStock}
                        aria-label="Stock"
                      />

                      <button
                        className="stk-btn"
                        onClick={() => changeStockBy(producto._id, +1)}
                        disabled={isSavingStock}
                        title="+1"
                        type="button"
                      >
                        +1
                      </button>
                      <button
                        className="stk-btn"
                        onClick={() => changeStockBy(producto._id, +10)}
                        disabled={isSavingStock}
                        title="+10"
                        type="button"
                      >
                        +10
                      </button>
                    </div>
                  </td>

                  <td className="td-hide-sm col-dest" style={{ textAlign: "center" }}>
                    {producto.destacado ? (
                      <span style={{ color: "#d63384", fontWeight: "bold" }}>⭐</span>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* PROMO */}
                  <td className="promo-td col-promo">
                    <div className="promo-wrap">
                      <label className="promo-row">
                        <input
                          type="checkbox"
                          checked={!!d.promoActivo}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [producto._id]: { ...prev[producto._id], promoActivo: e.target.checked },
                            }))
                          }
                        />
                        <span>Activo</span>
                      </label>

                      <div className="promo-row">
                        {/* input de texto que acepta $ o % */}
                        <input
                          type="text"
                          inputMode="decimal"
                          className="promo-input"
                          placeholder="$ o %"
                          value={d.precioPromoInput ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [producto._id]: { ...prev[producto._id], precioPromoInput: e.target.value },
                            }))
                          }
                          disabled={!d.promoActivo}
                          style={{ minWidth: 90 }}
                        />
                      </div>

                      {/* Vista previa */}
                      {d.promoActivo && (
                        <div style={{ fontSize: 12, color: previewOk ? "#16a34a" : "#b91c1c", fontWeight: 700 }}>
                          {previewOk
                            ? `→ $${money(parsed.price)} ${parsed.pct != null ? `(-${parsed.pct}%)` : ""}`
                            : d.precioPromoInput
                            ? "Valor inválido"
                            : "Ingresá $ o %"}
                        </div>
                      )}

                      <button
                        className="promo-save"
                        onClick={() => {
                          const id = producto._id;
                          const cur = drafts[id] || {};
                          const parsed = parsePromoInput(cur.precioPromoInput, producto.precio);

                          // Validaciones simples
                          if (cur.promoActivo) {
                            if (parsed.mode === "invalid" || parsed.price == null) {
                              showNotif("err", "Ingresá un % (ej. 25%) o un precio válido");
                              return;
                            }
                            if (parsed.price >= Number(producto.precio)) {
                              showNotif("err", "El precio promo debe ser menor al precio base");
                              return;
                            }
                          }

                          const body = {
                            promoActivo: !!cur.promoActivo,
                            precioPromo: cur.promoActivo ? parsed.price : null, // en pesos al back
                          };

                          const s = new Set(saving); s.add(id); setSaving(s);
                          axios.put(`${API}/productos/${id}`, body)
                            .then(({ data }) => {
                              setProductos((prev) => prev.map((x) => x._id === id ? { ...x, ...data } : x));
                              setDrafts((prev) => ({
                                ...prev,
                                [id]: {
                                  promoActivo: !!(data.promo && data.promo.active),
                                  precioPromoInput:
                                    data.promo && typeof data.promo.precio === "number"
                                      ? String(data.promo.precio)
                                      : "",
                                },
                              }));
                              showNotif("ok", "Promo guardada");
                            })
                            .catch((err) => showNotif("err", err?.response?.data?.message || "Error al guardar promo"))
                            .finally(() => { const s2 = new Set(s); s2.delete(id); setSaving(s2); });
                        }}
                        disabled={saving.has(producto._id) || !promoCambia(producto)}
                        title={!promoCambia(producto) ? "Sin cambios" : "Guardar cambios de promo"}
                        type="button"
                      >
                        {saving.has(producto._id) ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </td>

                  {/* ACCIONES */}
                  <td className="td-actions">
                    <div className="actions-wrap">
                      <Link to={`/editar/${producto._id}`} className="btn-edit">
                        Editar
                      </Link>

                      {oculto ? (
                        <button
                          className="btn-show"
                          onClick={() => setVisible(producto._id, true)}
                          disabled={isSavingVis}
                          title="Mostrar en la tienda"
                          type="button"
                        >
                          {isSavingVis ? "Mostrando…" : "Mostrar"}
                        </button>
                      ) : (
                        <button
                          className="btn-hide"
                          onClick={() => setVisible(producto._id, false)}
                          disabled={isSavingVis || !puedeOcultar}
                          title={puedeOcultar ? "Ocultar (sin stock)" : "Solo cuando stock = 0"}
                          type="button"
                        >
                          {isSavingVis ? "Ocultando…" : "Ocultar"}
                        </button>
                      )}

                      <button
                        className="btn-del"
                        onClick={() => askDelete(producto._id, producto.nombre)}
                        disabled={isDeleting}
                        title="Eliminar definitivamente"
                        type="button"
                      >
                        {isDeleting ? "Eliminando…" : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
