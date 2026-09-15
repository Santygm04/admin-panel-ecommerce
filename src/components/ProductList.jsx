import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./ProductList.css";
import ConfirmDialog from "./ConfirmDialog";
import { useAuth } from "./AuthContext";
import { Badge, Button, Card, EmptyState, Input, Select, Spinner } from "./ui";
import { AlertIcon, BoxesIcon, SearchIcon, EditIcon, EyeIcon, EyeOffIcon, TrashIcon } from "./ui/icons";
import { API_URL, authHeaders } from "../utils/api";
import { notify } from "../utils/toast";
import { isLenceriaCategory } from "../utils/pricing";
import { ProductImage } from "../utils/image";

const API = `${API_URL}/api`;
const PAGE_SIZE = 50;
const LEGACY_FETCH_LIMIT = 200;
const DEFAULT_STOCK_MIN = 5;

const stockState = (stock, stockMinimo) => {
  const current = Math.max(0, Number(stock) || 0);
  const minimumValue = Number(stockMinimo);
  const minimum = Number.isFinite(minimumValue) && minimumValue >= 0
    ? minimumValue
    : DEFAULT_STOCK_MIN;

  if (current === 0) return { key: "empty", tone: "danger", label: "Sin stock", current, minimum };
  if (current <= minimum) return { key: "low", tone: "warning", label: "Stock bajo", current, minimum };
  return { key: "available", tone: "success", label: "Stock suficiente", current, minimum };
};

const readStockAlerts = (signal) => axios.get(`${API}/productos/stock-alerts`, {
  params: { admin: true },
  headers: authHeaders(),
  signal,
}).then(({ data }) => data);

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

/* ===== Tag de precio por tier (consistente card/tabla) ===== */
function PriceTag({ label, tone = "neutral" }) {
  return <span className={`price-tag price-tag--${tone}`}>{label}</span>;
}

function PriceTiers({ producto }) {
  const isLenceria = isLenceriaCategory(producto.categoria);
  const minimoMayorista = Number(producto.minimoMayorista) || 0;
  const hasUnit = Number(producto.precio) > 0;
  const tiers = [
    { show: isLenceria ? hasUnit : hasUnit, tone: "neutral", label: "x1", value: producto.precio },
    { show: producto.precioEspecial != null, tone: "gold", label: "Esp", value: producto.precioEspecial },
    {
      show: producto.publicarEnCajas && Number(producto.precioCaja) > 0,
      tone: "brand",
      label: "Caja",
      detail: producto.unidadesPorCaja ? `${producto.unidadesPorCaja} uds.` : null,
      value: producto.precioCaja,
    },
    {
      show: producto.precioMayorista != null,
      tone: "info",
      label: isLenceria ? `x${minimoMayorista || 2}` : "M",
      detail: isLenceria ? null : `mín. $${money(minimoMayorista || 30000)}`,
      value: producto.precioMayorista,
    },
    { show: isLenceria && producto.precioMayorista2 != null, tone: "success", label: `x${producto.minimoMayorista2 || 6}`, value: producto.precioMayorista2 },
    { show: isLenceria && producto.precioMayorista3 != null, tone: "brand", label: `x${producto.minimoMayorista3 || 12}`, value: producto.precioMayorista3 },
  ];
  const visible = tiers.filter((t) => t.show);
  if (!visible.length) return <span className="pl-muted">Sin precios</span>;
  return (
    <div className="price-tiers">
      {visible.map((t) => (
        <span key={t.label} className={`price-row ${t.tone === "neutral" ? "price-row--main" : ""}`}>
          <PriceTag label={t.label} tone={t.tone} />
          ${Number(t.value).toLocaleString("es-AR")}
          {t.detail && <span className="price-row-detail">{t.detail}</span>}
        </span>
      ))}
    </div>
  );
}

function ProductPagination({ pagination, loading, onPageChange, position = "" }) {
  if (!pagination.total) return null;
  const firstVisible = ((pagination.page - 1) * pagination.limit) + 1;
  const lastVisible = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <nav className={`pl-pagination ${position ? `pl-pagination--${position}` : ""}`} aria-label="Paginación de productos">
      <div className="pl-pagination-summary">
        <strong>{firstVisible}–{lastVisible}</strong> de <strong>{pagination.total}</strong> productos
      </div>
      <div className="pl-pagination-controls">
        <Button
          variant="secondary"
          size="sm"
          disabled={pagination.page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          Anterior
        </Button>
        <span className="pl-pagination-current">Página <strong>{pagination.page}</strong> de <strong>{pagination.pages}</strong></span>
        <Button
          variant="secondary"
          size="sm"
          disabled={pagination.page >= pagination.pages || loading}
          onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}

function StockAlerts({ alerts, loading }) {
  if (loading) {
    return <div className="pl-alerts pl-alerts--loading"><Spinner size="sm" /> Revisando alertas de stock…</div>;
  }

  const items = alerts?.items || [];
  const outOfStock = Number(alerts?.outOfStock) || 0;
  const lowStock = Number(alerts?.lowStock) || 0;
  const hasAlerts = outOfStock > 0 || lowStock > 0;

  return (
    <section className={`pl-alerts ${hasAlerts ? "pl-alerts--active" : "pl-alerts--clear"}`} aria-label="Alertas de stock">
      <div className="pl-alerts-heading">
        <div className="pl-alerts-title">
          <span className="pl-alerts-icon"><AlertIcon size={17} /></span>
          <div>
            <strong>Alertas de stock</strong>
            <span>{hasAlerts ? "Revisá estos productos para reponer." : "Todo el catálogo está por encima del mínimo."}</span>
          </div>
        </div>
        <Badge tone={hasAlerts ? "warning" : "success"}>{items.length} {items.length === 1 ? "alerta" : "alertas"}</Badge>
      </div>

      <div className="pl-alert-summary">
        <div className="pl-alert-kpi pl-alert-kpi--danger">
          <strong>{outOfStock}</strong>
          <span>Sin stock</span>
        </div>
        <div className="pl-alert-kpi pl-alert-kpi--warning">
          <strong>{lowStock}</strong>
          <span>Stock bajo</span>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="pl-alert-list">
          {items.map((item) => (
            <li key={item._id}>
              <span className={`pl-alert-dot pl-alert-dot--${item.status}`} aria-hidden="true" />
              <span className="pl-alert-name">{item.nombre}</span>
              <span className="pl-alert-value">
                {item.status === "empty" ? "Agotado" : `${item.stock} / mín. ${item.stockMinimo}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProductList() {
  const { user } = useAuth();
  const soloStock = user?.role === "vendedor" && !!user?.permissions?.editarStockSolo;
  const [productos, setProductos] = useState([]);
  const [categoriasDB, setCategoriasDB] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [soloCajas, setSoloCajas] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: PAGE_SIZE });
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [stockAlerts, setStockAlerts] = useState({ items: [], total: 0, outOfStock: 0, lowStock: 0 });
  const [loadingStockAlerts, setLoadingStockAlerts] = useState(true);

  const [saving, setSaving] = useState(new Set());
  const [drafts, setDrafts] = useState({});

  const [stockDrafts, setStockDrafts] = useState({});
  const [savingStock, setSavingStock] = useState(new Set());

  const [savingVis, setSavingVis] = useState(new Set());

  const [savingDel, setSavingDel] = useState(new Set());
  const [confirmData, setConfirmData] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    readStockAlerts(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setStockAlerts(data);
      })
      .catch((err) => {
        if (err.name !== "CanceledError") setStockAlerts({ items: [], total: 0, outOfStock: 0, lowStock: 0 });
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingStockAlerts(false);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    axios.get(`${API}/categories`, { signal: ctrl.signal })
      .then(({ data }) => {
        if (!ctrl.signal.aborted) setCategoriasDB(data?.categories || []);
      })
      .catch((err) => {
        if (err.name !== "CanceledError") setCategoriasDB([]);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    const t = setTimeout(async () => {
      setLoadingProducts(true);
      try {
        const { data } = await axios.get(`${API}/productos`, {
          params: {
            limit: LEGACY_FETCH_LIMIT,
            page,
            q,
            admin: true,
            ...(categoriaFiltro ? { categoria: categoriaFiltro } : {}),
            ...(soloCajas ? { publicarEnCajas: true } : {}),
          },
          headers: { Authorization: `Bearer ${sessionStorage.getItem("aesthetic:token") || ""}` },
          signal: ctrl.signal,
        });

        const legacyItems = Array.isArray(data) ? data : null;
        const legacyFiltered = legacyItems
          ? legacyItems.filter((product) => (
              (!categoriaFiltro || String(product.categoria || "").toLowerCase() === categoriaFiltro.toLowerCase())
              && (!soloCajas || product.publicarEnCajas === true)
            ))
          : [];
        const items = legacyItems
          ? legacyFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          : data.items || [];
        setProductos(items);
        setPagination(legacyItems
          ? { page, pages: Math.max(1, Math.ceil(legacyFiltered.length / PAGE_SIZE)), total: legacyFiltered.length, limit: PAGE_SIZE }
          : {
              page: data.page || page,
              pages: data.pages || 1,
              total: data.total ?? items.length,
              limit: data.limit || PAGE_SIZE,
            });

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
          notify.error("No se pudieron cargar los productos. Reintentá en unos segundos.");
          console.error("Error al obtener productos", err);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoadingProducts(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, categoriaFiltro, soloCajas, page]);

  const productosFiltrados = productos;

  const categoriasUnicas = useMemo(() => {
    const options = new Map();
    for (const category of categoriasDB) {
      const value = category?.slug || category?.nombre;
      if (value) options.set(value, category?.nombre || value);
    }
    for (const product of productos) {
      if (product.categoria && !options.has(product.categoria)) options.set(product.categoria, product.categoria);
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [categoriasDB, productos]);

  const showNotif = (type, text) => {
    if (type === "ok") {
      notify.success(text);
    } else {
      notify.error(text);
    }
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
      const token = sessionStorage.getItem("aesthetic:token");
      const { data } = await axios.put(`${API}/productos/${id}`, { stock: current }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProductos((prev) =>
        prev.map((p) =>
          p._id === id ? { ...p, stock: data.stock, visible: data.visible } : p
        )
      );
      setStockDrafts((prev) => ({ ...prev, [id]: data.stock }));
      readStockAlerts().then(setStockAlerts).catch(() => {});
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
          resp = await axios.patch(`${API}/productos/${id}/visible`, { visible }, {
            headers: authHeaders(),
          });
        } catch (err) {
          const status = err?.response?.status;
          if (status === 404 || status === 405) {
            resp = await axios.put(`${API}/productos/${id}`, { visible }, {
              headers: authHeaders(),
            });
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

    let deleted = false;
    try {
      const token = sessionStorage.getItem("aesthetic:token");
      await axios.delete(`${API}/productos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProductos((prev) => prev.filter((p) => p._id !== id));
      setPagination((prev) => {
        const total = Math.max(0, prev.total - 1);
        return { ...prev, total, pages: Math.max(1, Math.ceil(total / prev.limit)) };
      });
      if (productos.length === 1 && page > 1) setPage((current) => current - 1);
      showNotif("ok", "Producto eliminado");
      deleted = true;
    } catch (e) {
      console.error("DELETE error:", e?.response?.status, e?.response?.data);
      const message = e?.response?.status === 429
        ? "El servidor limitó temporalmente las operaciones. Esperá unos segundos y volvé a intentar."
        : e?.response?.data?.message || "No se pudo eliminar";
      showNotif("err", message);
    } finally {
      const sd2 = new Set(sd);
      sd2.delete(id);
      setSavingDel(sd2);
      if (deleted) setConfirmData(null);
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
        <label className="ui-check">
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

        <Input
          type="text"
          inputMode="decimal"
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
          className="promo-input"
        />

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

        <Button
          size="sm"
          variant="secondary"
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
              .put(`${API}/productos/${id}`, body, { headers: authHeaders() })
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
          loading={saving.has(producto._id)}
        >
          {saving.has(producto._id) ? "Guardando…" : "Guardar promo"}
        </Button>
      </div>
    );
  };

  const StockControls = ({ producto, compact = false }) => {
    const stockValue = stockDrafts[producto._id] ?? producto.stock ?? 0;
    const status = stockState(stockValue, producto.stockMinimo);
    const isSavingStock = savingStock.has(producto._id);
    const esVendedor = user?.role === "vendedor";
    const minus10Disabled = compact
      ? isSavingStock || stockValue <= 0 || esVendedor
      : isSavingStock || stockValue <= 0 || soloStock;
    const minus1Disabled = compact
      ? isSavingStock || stockValue <= 0 || esVendedor
      : isSavingStock || stockValue <= 0;
    const editDisabled = compact
      ? isSavingStock || esVendedor
      : isSavingStock || soloStock;
    const plusDisabled = compact
      ? isSavingStock || esVendedor
      : isSavingStock || soloStock;
    return (
      <div className={`stock-actions ${compact ? "stock-actions--compact" : ""}`}>
        <div className={`stock-status stock-status--${status.key}`}>
          <Badge tone={status.tone} dot>{status.label}</Badge>
          <span>{status.current} disponibles · mín. {status.minimum}</span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => changeStockBy(producto._id, -10)}
          disabled={minus10Disabled}>-10</Button>
        <Button size="sm" variant="secondary" onClick={() => changeStockBy(producto._id, -1)}
          disabled={minus1Disabled}>-1</Button>
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
          disabled={editDisabled}
          aria-label="Stock"
        />
        <Button size="sm" variant="secondary" onClick={() => changeStockBy(producto._id, +1)}
          disabled={plusDisabled}>+1</Button>
        <Button size="sm" variant="secondary" onClick={() => changeStockBy(producto._id, +10)}
          disabled={plusDisabled}>+10</Button>
        {isSavingStock && <span className="stock-saving">Guardando…</span>}
      </div>
    );
  };

  const RowActions = ({ producto, oculto, puedeOcultar }) => {
    const isSavingVis = savingVis.has(producto._id);
    const isDeleting = savingDel.has(producto._id);
    return (
      <div className="pl-actions">
        {(user?.role !== "vendedor" || user?.permissions?.crearProductos) && (
          <Link to={`/editar/${producto._id}`} className="ui-btn ui-btn--sm ui-btn--secondary" title="Editar">
            <EditIcon size={15} /> Editar
          </Link>
        )}
        {!soloStock && oculto ? (
          <Button size="sm" variant="secondary" onClick={() => setVisible(producto._id, true)}
            disabled={isSavingVis} title="Mostrar producto">
            <EyeIcon size={15} /> {isSavingVis ? "Mostrando…" : "Mostrar"}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setVisible(producto._id, false)}
            disabled={isSavingVis || !puedeOcultar}
            title={puedeOcultar ? "Ocultar (sin stock)" : "Solo cuando stock = 0"}>
            <EyeOffIcon size={15} /> {isSavingVis ? "Ocultando…" : "Ocultar"}
          </Button>
        )}
        {!soloStock && (
          <Button size="sm" variant="danger-ghost" onClick={() => askDelete(producto._id, producto.nombre)}
            disabled={isDeleting} title="Eliminar producto">
            <TrashIcon size={15} /> {isDeleting ? "Eliminando…" : "Eliminar"}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="pl-container">
      <ConfirmDialog
        open={!!confirmData}
        title="Eliminar producto"
        message={
          confirmData
            ? `¿Eliminar definitivamente "${confirmData.nombre}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={deleteNow}
        onCancel={() => setConfirmData(null)}
        loading={confirmData ? savingDel.has(confirmData.id) : false}
      />

      <div className="pl-header">
        <div className="pl-header-top">
          <div className="ui-row">
            <BoxesIcon size={22} />
            <h2 className="ui-page-title">Control de Stock</h2>
          </div>
          <div className="pl-header-stats">
            <Badge tone="neutral">{pagination.total} producto{pagination.total !== 1 ? "s" : ""}</Badge>
            <span>50 por página · Página {pagination.page} de {pagination.pages}</span>
          </div>
        </div>

        <div className="pl-filters">
          <Input
            type="search"
            placeholder="Buscar productos…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            icon={<SearchIcon size={16} />}
            aria-label="Buscar productos"
          />
          <Select
            value={categoriaFiltro}
            onChange={(e) => { setCategoriaFiltro(e.target.value); setPage(1); }}
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categoriasUnicas.map(([value, label]) => (
              <option key={value} value={value}>
                {label === "nuevos-ingresos" ? "Nuevos ingresos" : label}
              </option>
            ))}
          </Select>
          <label className="pl-filter-check">
            <input type="checkbox" checked={soloCajas} onChange={(e) => { setSoloCajas(e.target.checked); setPage(1); }} />
            Solo Packs / Cajas
          </label>
          {(categoriaFiltro || soloCajas || q) && (
            <Button size="sm" variant="ghost" onClick={() => { setCategoriaFiltro(""); setSoloCajas(false); setQ(""); setPage(1); }}>
              Limpiar filtro
            </Button>
          )}
        </div>
        {loadingProducts && (
          <div className="pl-fetching" role="status">
            <Spinner size="sm" /> Actualizando productos…
          </div>
        )}
        <StockAlerts alerts={stockAlerts} loading={loadingStockAlerts} />
      </div>

      <ProductPagination pagination={pagination} loading={loadingProducts} position="top" onPageChange={setPage} />

      {/* ===== MOBILE CARDS ===== */}
      <div className="pl-cards">
        {loadingProducts && productosFiltrados.length === 0 ? (
          <div className="pl-loading-state" role="status">
            <Spinner size="lg" />
            <strong>Cargando productos</strong>
            <span>Estamos preparando la primera página.</span>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <EmptyState
            icon={<BoxesIcon size={24} />}
            title="No hay productos"
            description={q ? `Sin resultados para "${q}".` : "No hay productos en esta categoría."}
          />
        ) : (
          productosFiltrados.map((producto) => {
            const stockValue = stockDrafts[producto._id] ?? producto.stock ?? 0;
            const status = stockState(stockValue, producto.stockMinimo);
            const oculto = producto.visible === false;
            const puedeOcultar = !oculto && Number(stockValue) <= 0;

            return (
              <Card key={producto._id} className="pl-card">
                <div className="pl-card-main">
                  <ProductImage
                    product={producto}
                    alt={producto.nombre}
                    className="pl-card-thumb"
                    loading="lazy"
                  />
                  <div className="pl-card-info">
                    <div className="pl-card-title-row">
                      <h3>{producto.nombre}</h3>
                      <div className="ui-row">
                        {oculto && <Badge tone="neutral" outline>Oculto</Badge>}
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {producto.syncToERP
                          ? <Badge tone="brand">En ERP</Badge>
                          : <Badge tone="neutral" outline>Solo tienda</Badge>}
                        {producto.publicarEnCajas && <Badge tone="gold">Packs / Cajas</Badge>}
                      </div>
                    </div>
                    <PriceTiers producto={producto} />
                    <div className="pl-card-meta">
                      <span><b>Categoría:</b>{" "}
                        {producto.categoria === "nuevos-ingresos"
                          ? "Nuevos ingresos"
                          : producto.categoria?.charAt(0).toUpperCase() + (producto.categoria?.slice(1) || "")}
                      </span>
                      <span><b>Subcategoría:</b> {producto.subcategoria || "—"}</span>
                      <span><b>Destacado:</b> {producto.destacado ? "Sí" : "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="pl-block">
                  <h4>Stock</h4>
                  <StockControls producto={producto} />
                </div>

                {!soloStock && (
                  <div className="pl-block">
                    <h4>Promoción</h4>
                    {renderPromoEditor(producto)}
                  </div>
                )}

                <RowActions producto={producto} oculto={oculto} puedeOcultar={puedeOcultar} />
              </Card>
            );
          })
        )}
      </div>

      {/* ===== DESKTOP TABLE ===== */}
      <div className={`ui-table-wrap pl-table-wrap ${loadingProducts ? "is-loading" : ""}`}>
        {loadingProducts && productosFiltrados.length === 0 && (
          <div className="pl-table-loading" role="status">
            <Spinner size="lg" />
            <strong>Cargando productos…</strong>
          </div>
        )}
        <table className="ui-table pl-table" role="table" aria-label="Productos">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Categoría</th>
              <th>Subcategoría</th>
              <th>Stock</th>
              <th>Destacado</th>
              <th>Promo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.map((producto) => {
              const stockValue = stockDrafts[producto._id] ?? producto.stock ?? 0;
              const oculto = producto.visible === false;
              const puedeOcultar = !oculto && Number(stockValue) <= 0;

              return (
                <tr key={producto._id}>
                  <td>
                    <ProductImage
                      product={producto}
                      alt={producto.nombre}
                      className="pl-thumb"
                      loading="lazy"
                    />
                  </td>
                  <td className="pl-ellipsis">
                    {producto.nombre}
                    {oculto && <Badge tone="neutral" outline className="pl-inline-badge">Oculto</Badge>}
                    {producto.syncToERP
                      ? <Badge tone="brand" className="pl-inline-badge">En ERP</Badge>
                      : <Badge tone="neutral" outline className="pl-inline-badge">Solo tienda</Badge>}
                    {producto.publicarEnCajas && <Badge tone="gold" className="pl-inline-badge">Packs / Cajas</Badge>}
                  </td>
                  <td><PriceTiers producto={producto} /></td>
                  <td>
                    {producto.categoria === "nuevos-ingresos"
                      ? "Nuevos ingresos"
                      : producto.categoria?.charAt(0).toUpperCase() + (producto.categoria?.slice(1) || "")}
                  </td>
                  <td>{producto.subcategoria || "—"}</td>
                  <td><StockControls producto={producto} compact /></td>
                  <td style={{ textAlign: "center" }}>
                    {producto.destacado ? <Badge tone="gold">★</Badge> : "—"}
                  </td>
                  <td className="pl-promo-td">{renderPromoEditor(producto)}</td>
                  <td><RowActions producto={producto} oculto={oculto} puedeOcultar={puedeOcultar} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loadingProducts && productosFiltrados.length === 0 && (
          <EmptyState
            icon={<BoxesIcon size={24} />}
            title="No hay productos"
            description={q ? `Sin resultados para "${q}".` : "No hay productos en esta categoría."}
          />
        )}
      </div>

      <ProductPagination pagination={pagination} loading={loadingProducts} onPageChange={setPage} />
    </div>
  );
}
