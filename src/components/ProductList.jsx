import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./ProductList.css";
import ConfirmDialog from "./ConfirmDialog";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API = API_BASE ? `${API_BASE}/api` : "/api";

/* ===== Helpers promo ===== */
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const money = (n) =>
  Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

function parsePromoInput(input, basePrice) {
  const base = Number(basePrice || 0);
  const raw = String(input ?? "").trim().replace(",", ".");
  if (!raw) return { mode: null, price: null, pct: null };

  if (/%$/.test(raw)) {
    const pct = clamp(parseFloat(raw.replace("%", "")) || 0, 0, 100);
    const price = Math.max(0, Math.round(base * (1 - pct / 100)));
    return { mode: "percent", price, pct: Math.round(pct) };
  }

  const n = Number(raw);
  if (isFinite(n) && n > 0 && n < 1) {
    const pct = clamp(n * 100, 0, 100);
    const price = Math.max(0, Math.round(base * (1 - n)));
    return { mode: "percent", price, pct: Math.round(pct) };
  }

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

  const [saving, setSaving] = useState(new Set());
  const [drafts, setDrafts] = useState({});
  const [notif, setNotif] = useState(null);

  const [stockDrafts, setStockDrafts] = useState({});
  const [savingStock, setSavingStock] = useState(new Set());

  const [savingVis, setSavingVis] = useState(new Set());

  const [savingDel, setSavingDel] = useState(new Set());
  const [confirmData, setConfirmData] = useState(null);

  const categoriasValidas = [
    "mujer",
    "niñas",
    "maquillaje",
    "skincare",
    "bodycare",
    "bijouterie",
    "marroquineria",
    "pestañas",
    "peluquería",
    "promos",
    "nuevos-ingresos",
    "uñas",
    "lenceria",
  ];

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

        setStockDrafts((prev) => {
          const next = { ...prev };
          for (const p of items) {
            if (next[p._id] === undefined) next[p._id] = p.stock ?? 0;
          }
          return next;
        });
      } catch (err) {
        if (err.name !== "CanceledError") {
          console.error("Error al obtener productos", err);
        }
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
    return categoriasValidas.filter((cat) =>
      productos.some((p) => p.categoria === cat)
    );
  }, [productos]);

  const showNotif = (type, text) => {
    setNotif({ type, text });
    clearTimeout(showNotif._t);
    showNotif._t = setTimeout(() => setNotif(null), 2200);
  };

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
        prev.map((p) =>
          p._id === id ? { ...p, stock: data.stock, visible: data.visible } : p
        )
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
    const base = stockDrafts[id] ?? productos.find((p) => p._id === id)?.stock ?? 0;
    const next = Math.max(0, base + delta);
    setStockDraft(id, next);
    commitStock(id, next);
  };

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
      p.promo && typeof p.promo.precio === "number"
        ? Math.round(p.promo.precio)
        : null;

    const curAct = !!d.promoActivo;
    const parsed = parsePromoInput(d.precioPromoInput, p.precio);
    const curPrecio = curAct ? parsed.price : null;

    return (
      origAct !== curAct ||
      Math.round(origPrecio ?? -1) !== Math.round(curPrecio ?? -1)
    );
  };

  const renderPromoEditor = (producto) => {
    const d =
      drafts[producto._id] || {
        promoActivo: !!(producto.promo?.active),
        precioPromoInput:
          typeof producto.promo?.precio === "number"
            ? String(producto.promo.precio)
            : "",
      };

    const parsed = parsePromoInput(d.precioPromoInput, producto.precio);
    const previewOk =
      d.promoActivo &&
      parsed.price != null &&
      parsed.mode !== "invalid" &&
      parsed.price < Number(producto.precio);

    return (
      <div className="promo-wrap">
        <label className="promo-row">
          <input
            type="checkbox"
            checked={!!d.promoActivo}
            onChange={(e) =>
              setDrafts((prev) => ({
                ...prev,
                [producto._id]: {
                  ...prev[producto._id],
                  promoActivo: e.target.checked,
                },
              }))
            }
          />
          <span>Promo activa</span>
        </label>

        <div className="promo-row">
          <input
            type="text"
            inputMode="decimal"
            className="promo-input"
            placeholder="$ o %"
            value={d.precioPromoInput ?? ""}
            onChange={(e) =>
              setDrafts((prev) => ({
                ...prev,
                [producto._id]: {
                  ...prev[producto._id],
                  precioPromoInput: e.target.value,
                },
              }))
            }
            disabled={!d.promoActivo}
          />
        </div>

        {d.promoActivo && (
          <div className={`promo-preview ${previewOk ? "ok" : "err"}`}>
            {previewOk
              ? `→ $${money(parsed.price)} ${
                  parsed.pct != null ? `(-${parsed.pct}%)` : ""
                }`
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
              precioPromo: cur.promoActivo ? parsed.price : null,
            };

            const s = new Set(saving);
            s.add(id);
            setSaving(s);

            axios
              .put(`${API}/productos/${id}`, body)
              .then(({ data }) => {
                setProductos((prev) =>
                  prev.map((x) => (x._id === id ? { ...x, ...data } : x))
                );
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
              .catch((err) =>
                showNotif("err", err?.response?.data?.message || "Error al guardar promo")
              )
              .finally(() => {
                const s2 = new Set(s);
                s2.delete(id);
                setSaving(s2);
              });
          }}
          disabled={saving.has(producto._id) || !promoCambia(producto)}
          type="button"
        >
          {saving.has(producto._id) ? "Guardando…" : "Guardar promo"}
        </button>
      </div>
    );
  };

  return (
    <div className="stock-container">
      {notif && (
        <div className={`toast ${notif.type === "ok" ? "ok" : "err"}`}>
          {notif.text}
        </div>
      )}

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
        <div className="stock-header-top">
          <h2>📦 Control de Stock</h2>
          <span className="stock-count">
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="stock-filters">
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
            className="stock-select"
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
            <button
              className="btn-reset"
              onClick={() => setCategoriaFiltro("")}
              type="button"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </div>

      {/* ===== MOBILE CARDS ===== */}
      <div className="product-cards">
        {productosFiltrados.length === 0 ? (
          <div className="empty-state">No hay productos en esta categoría.</div>
        ) : (
          productosFiltrados.map((producto) => {
            const stockValue = stockDrafts[producto._id] ?? producto.stock ?? 0;
            const isSavingStock = savingStock.has(producto._id);

            const oculto = producto.visible === false;
            const puedeOcultar = !oculto && Number(stockValue) <= 0;
            const isSavingVis = savingVis.has(producto._id);
            const isDeleting = savingDel.has(producto._id);

            return (
              <article className="product-card" key={producto._id}>
                <div className="product-card-main">
                  <img
                    src={producto.imagen}
                    alt={producto.nombre}
                    className="product-card-thumb"
                  />

                  <div className="product-card-info">
                    <div className="product-card-title-row">
                      <h3>{producto.nombre}</h3>
                      {oculto && <span className="badge-hidden">Oculto</span>}
                    </div>

                    <p className="product-card-price">
                      ${Number(producto.precio).toLocaleString("es-AR")}
                    </p>

                    <div className="product-card-meta">
                      <span>
                        <b>Categoría:</b>{" "}
                        {producto.categoria === "nuevos-ingresos"
                          ? "Nuevos ingresos"
                          : producto.categoria?.charAt(0).toUpperCase() +
                            (producto.categoria?.slice(1) || "")}
                      </span>
                      <span>
                        <b>Subcategoría:</b> {producto.subcategoria || "—"}
                      </span>
                      <span>
                        <b>Destacado:</b> {producto.destacado ? "⭐ Sí" : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="product-block">
                  <h4>Stock</h4>
                  <div className="stock-actions stock-actions-mobile">
                    <button
                      className="stk-btn"
                      onClick={() => changeStockBy(producto._id, -10)}
                      disabled={isSavingStock || stockValue <= 0}
                      type="button"
                    >
                      -10
                    </button>
                    <button
                      className="stk-btn"
                      onClick={() => changeStockBy(producto._id, -1)}
                      disabled={isSavingStock || stockValue <= 0}
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
                        if (e.key === "Escape")
                          setStockDraft(producto._id, producto.stock ?? 0);
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      disabled={isSavingStock}
                      aria-label="Stock"
                    />

                    <button
                      className="stk-btn"
                      onClick={() => changeStockBy(producto._id, +1)}
                      disabled={isSavingStock}
                      type="button"
                    >
                      +1
                    </button>
                    <button
                      className="stk-btn"
                      onClick={() => changeStockBy(producto._id, +10)}
                      disabled={isSavingStock}
                      type="button"
                    >
                      +10
                    </button>
                  </div>
                </div>

                <div className="product-block">
                  <h4>Promoción</h4>
                  {renderPromoEditor(producto)}
                </div>

                <div className="product-actions">
                  <Link to={`/editar/${producto._id}`} className="btn-edit">
                    Editar
                  </Link>

                  {oculto ? (
                    <button
                      className="btn-show"
                      onClick={() => setVisible(producto._id, true)}
                      disabled={isSavingVis}
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
                    type="button"
                  >
                    {isDeleting ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* ===== DESKTOP TABLE ===== */}
      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th className="col-categoria">Categoría</th>
              <th className="col-subcat">Subcategoría</th>
              <th>Stock</th>
              <th className="col-dest">Destacado</th>
              <th className="col-promo">Promo</th>
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
                const stockValue = stockDrafts[producto._id] ?? producto.stock ?? 0;
                const isSavingStock = savingStock.has(producto._id);

                const oculto = producto.visible === false;
                const puedeOcultar = !oculto && Number(stockValue) <= 0;
                const isSavingVis = savingVis.has(producto._id);
                const isDeleting = savingDel.has(producto._id);

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
                    <td className="col-subcat">{producto.subcategoria || "—"}</td>

                    <td>
                      <div className="stock-actions">
                        <button
                          className="stk-btn"
                          onClick={() => changeStockBy(producto._id, -10)}
                          disabled={isSavingStock || stockValue <= 0}
                          type="button"
                        >
                          -10
                        </button>
                        <button
                          className="stk-btn"
                          onClick={() => changeStockBy(producto._id, -1)}
                          disabled={isSavingStock || stockValue <= 0}
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
                            if (e.key === "Escape")
                              setStockDraft(producto._id, producto.stock ?? 0);
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          disabled={isSavingStock}
                          aria-label="Stock"
                        />

                        <button
                          className="stk-btn"
                          onClick={() => changeStockBy(producto._id, +1)}
                          disabled={isSavingStock}
                          type="button"
                        >
                          +1
                        </button>
                        <button
                          className="stk-btn"
                          onClick={() => changeStockBy(producto._id, +10)}
                          disabled={isSavingStock}
                          type="button"
                        >
                          +10
                        </button>
                      </div>
                    </td>

                    <td className="col-dest" style={{ textAlign: "center" }}>
                      {producto.destacado ? "⭐" : "—"}
                    </td>

                    <td className="promo-td col-promo">{renderPromoEditor(producto)}</td>

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
                            type="button"
                          >
                            {isSavingVis ? "Mostrando…" : "Mostrar"}
                          </button>
                        ) : (
                          <button
                            className="btn-hide"
                            onClick={() => setVisible(producto._id, false)}
                            disabled={isSavingVis || !puedeOcultar}
                            title={
                              puedeOcultar ? "Ocultar (sin stock)" : "Solo cuando stock = 0"
                            }
                            type="button"
                          >
                            {isSavingVis ? "Ocultando…" : "Ocultar"}
                          </button>
                        )}

                        <button
                          className="btn-del"
                          onClick={() => askDelete(producto._id, producto.nombre)}
                          disabled={isDeleting}
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
    </div>
  );
}