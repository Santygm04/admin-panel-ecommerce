import { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  Clock3,
  Edit3,
  Pause,
  Percent,
  Play,
  Search,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton } from "./ui";
import { API_URL, authHeaders } from "../utils/api";
import { ProductImage } from "../utils/image";
import { formatARS } from "../utils/pricing";
import { notify } from "../utils/toast";

const PRODUCTS_API = `${API_URL}/api/productos`;
const PAGE_SIZE = 24;
const PERCENT_PRESETS = [10, 15, 20, 25, 30, 40, 50];
const LABEL_PRESETS = ["Oferta", "Flash", "Liquidación", "Últimas unidades", "Especial online"];

const pad = (number) => String(number).padStart(2, "0");

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(value, emptyLabel = "Sin límite") {
  if (!value) return emptyLabel;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha inválida"
    : date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getPromotionBasePrice(product) {
  const boxPrice = Number(product?.precioCaja);
  const boxUnits = Number(product?.unidadesPorCaja);
  if (product?.publicarEnCajas === true && boxPrice > 0 && Number.isInteger(boxUnits) && boxUnits > 1) {
    return boxPrice / boxUnits;
  }
  const candidates = [
    product?.precio,
    product?.precioMayorista,
    product?.precioEspecial,
    product?.precioX2,
    product?.precioMayorista2,
    product?.precioMayorista3,
  ];
  for (const candidate of candidates) {
    const price = Number(candidate);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return boxPrice > 0 && boxUnits > 0 ? boxPrice / boxUnits : 0;
}

function getDiscountStatus(product, now = Date.now()) {
  const promo = product?.promo;
  const price = Number(promo?.precio);
  const basePrice = getPromotionBasePrice(product);
  if (!(price > 0)) return { key: "none", label: "Sin descuento", tone: "neutral" };
  if (promo?.active !== true) return { key: "paused", label: "Pausado", tone: "neutral" };
  if (!(basePrice > 0) || price >= basePrice) return { key: "invalid", label: "Revisar precio", tone: "danger" };

  const start = promo.desde ? Date.parse(promo.desde) : null;
  const end = promo.hasta ? Date.parse(promo.hasta) : null;
  if (start && now < start) return { key: "scheduled", label: "Programado", tone: "info" };
  if (end && now > end) return { key: "expired", label: "Vencido", tone: "warning" };
  return { key: "active", label: "Activo en tienda", tone: "success" };
}

function getDiscountPercentage(product) {
  const base = getPromotionBasePrice(product);
  const price = Number(product?.promo?.precio);
  return base > 0 && price > 0 && price < base ? Math.round((1 - price / base) * 100) : null;
}

function newDiscountForm(product) {
  const basePrice = getPromotionBasePrice(product);
  const savedPrice = Number(product?.promo?.precio);
  const hasSavedPrice = savedPrice > 0 && savedPrice < basePrice;
  return {
    active: product?.promo?.active !== false,
    mode: hasSavedPrice ? "final" : "percent",
    percentage: hasSavedPrice ? String(getDiscountPercentage(product) || 20) : "20",
    finalPrice: hasSavedPrice ? String(savedPrice) : String(roundMoney(basePrice * 0.8)),
    etiqueta: product?.promo?.etiqueta || "Oferta",
    desde: toDateTimeLocal(product?.promo?.desde),
    hasta: toDateTimeLocal(product?.promo?.hasta),
  };
}

function DiscountForm({ open, product, onClose, onSaved }) {
  const [form, setForm] = useState(() => newDiscountForm(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    setForm(newDiscountForm(product));
    setError("");
  }, [open, product]);

  if (!product) return null;

  const basePrice = getPromotionBasePrice(product);
  const percentage = Number(String(form.percentage).replace(",", "."));
  const typedFinalPrice = Number(String(form.finalPrice).replace(",", "."));
  const finalPrice = form.mode === "percent"
    ? roundMoney(basePrice * (1 - percentage / 100))
    : roundMoney(typedFinalPrice);
  const effectivePercentage = basePrice > 0 && finalPrice > 0
    ? Math.round((1 - finalPrice / basePrice) * 100)
    : 0;
  const validPrice = finalPrice > 0 && finalPrice < basePrice;

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const useSchedule = (days) => {
    if (days === null) {
      setForm((current) => ({ ...current, desde: "", hasta: "" }));
      return;
    }
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setForm((current) => ({
      ...current,
      desde: toDateTimeLocal(start),
      hasta: toDateTimeLocal(end),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!validPrice) return setError("El precio final debe ser mayor a cero y menor al precio base.");
    if (form.desde && form.hasta && new Date(form.hasta) <= new Date(form.desde)) {
      return setError("La fecha de finalización debe ser posterior al inicio.");
    }

    setSaving(true);
    try {
      const response = await fetch(`${PRODUCTS_API}/${product._id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          promo: {
            active: form.active,
            precio: finalPrice,
            etiqueta: form.etiqueta.trim() || "Oferta",
            desde: toIsoOrNull(form.desde),
            hasta: toIsoOrNull(form.hasta),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "No se pudo guardar el descuento");
      notify.success(form.active ? "Descuento guardado" : "Descuento guardado como pausado");
      onSaved(data);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      wide
      title={`Descuento · ${product.nombre}`}
      subtitle="El checkout aplicará este precio solo si mejora el precio vigente del cliente."
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="product-discount-form" loading={saving}>
            {saving ? "Guardando…" : "Guardar descuento"}
          </Button>
        </>
      )}
    >
      <form id="product-discount-form" className="discount-form" onSubmit={submit}>
        {error && <div className="ui-banner ui-banner--danger" role="alert">{error}</div>}

        <div className="discount-product-summary">
          <ProductImage product={product} alt="" className="discount-product-summary__image" />
          <div>
            <span>Precio base</span>
            <strong>${formatARS(basePrice)}</strong>
            <small>{product.sku || product.codigoInterno || product.categoria || "Producto"}</small>
          </div>
          <label className="discount-active-switch">
            <input type="checkbox" checked={form.active} onChange={(event) => setField("active", event.target.checked)} />
            <span>{form.active ? "Publicar descuento" : "Guardar pausado"}</span>
          </label>
        </div>

        <section className="discount-form-section">
          <div className="discount-form-section__head">
            <span className="discount-step">1</span>
            <div><h3>Definí el beneficio</h3><p>Elegí porcentaje o escribí directamente el precio final por unidad.</p></div>
          </div>
          <div className="discount-mode" aria-label="Forma de calcular el descuento">
            <button type="button" aria-pressed={form.mode === "percent"} className={form.mode === "percent" ? "is-active" : ""} onClick={() => setField("mode", "percent")}><Percent size={16} /> Porcentaje</button>
            <button type="button" aria-pressed={form.mode === "final"} className={form.mode === "final" ? "is-active" : ""} onClick={() => setField("mode", "final")}>$ Precio final</button>
          </div>
          {form.mode === "percent" ? (
            <>
              <div className="discount-presets" aria-label="Porcentajes rápidos">
                {PERCENT_PRESETS.map((preset) => (
                  <button type="button" key={preset} aria-pressed={Number(form.percentage) === preset} className={Number(form.percentage) === preset ? "is-active" : ""} onClick={() => setField("percentage", String(preset))}>-{preset}%</button>
                ))}
              </div>
              <Field label="Porcentaje personalizado" hint="Entre 1% y 99%." htmlFor="discount-percentage">
                <Input id="discount-percentage" type="number" min="1" max="99" step="1" value={form.percentage} onChange={(event) => setField("percentage", event.target.value)} />
              </Field>
            </>
          ) : (
            <Field label="Precio promocional por unidad" hint={`Debe ser menor a $${formatARS(basePrice)} por unidad.`} htmlFor="discount-final-price">
              <Input id="discount-final-price" type="number" min="0.01" max={Math.max(0.01, basePrice - 0.01)} step="0.01" prefix="$" value={form.finalPrice} onChange={(event) => setField("finalPrice", event.target.value)} />
            </Field>
          )}
          <div className={`discount-preview ${validPrice ? "is-valid" : "is-invalid"}`}>
            <div><span>Antes</span><del>${formatARS(basePrice)}</del></div>
            <div><span>Final por unidad</span><strong>{validPrice ? `$${formatARS(finalPrice)}` : "Revisar valor"}</strong></div>
            <div><span>Ahorro</span><b>{validPrice ? `${effectivePercentage}% · $${formatARS(basePrice - finalPrice)}` : "—"}</b></div>
          </div>
        </section>

        <section className="discount-form-section">
          <div className="discount-form-section__head">
            <span className="discount-step">2</span>
            <div><h3>Elegí cómo comunicarlo</h3><p>La etiqueta acompaña el precio en la tienda.</p></div>
          </div>
          <div className="discount-label-presets">
            {LABEL_PRESETS.map((label) => (
              <button type="button" key={label} aria-pressed={form.etiqueta === label} className={form.etiqueta === label ? "is-active" : ""} onClick={() => setField("etiqueta", label)}><Tag size={14} /> {label}</button>
            ))}
          </div>
          <Field label="Etiqueta personalizada" hint="Máximo 60 caracteres." htmlFor="discount-label">
            <Input id="discount-label" maxLength="60" value={form.etiqueta} placeholder="Oferta" onChange={(event) => setField("etiqueta", event.target.value)} />
          </Field>
        </section>

        <section className="discount-form-section">
          <div className="discount-form-section__head">
            <span className="discount-step">3</span>
            <div><h3>Programá la vigencia</h3><p>Sin fechas, permanece activo hasta que lo pauses.</p></div>
          </div>
          <div className="discount-schedule-presets">
            <Button type="button" size="sm" variant="secondary" onClick={() => useSchedule(null)}>Sin vencimiento</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => useSchedule(1)}>24 horas</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => useSchedule(7)}>7 días</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => useSchedule(30)}>30 días</Button>
          </div>
          <div className="discount-date-grid">
            <Field label="Comienza" hint="Vacío: inmediatamente." htmlFor="discount-start">
              <Input id="discount-start" type="datetime-local" value={form.desde} onChange={(event) => setField("desde", event.target.value)} />
            </Field>
            <Field label="Finaliza" hint="Vacío: sin vencimiento." htmlFor="discount-end">
              <Input id="discount-end" type="datetime-local" value={form.hasta} onChange={(event) => setField("hasta", event.target.value)} />
            </Field>
          </div>
        </section>
      </form>
    </Modal>
  );
}

function StatCard({ active, icon, label, value, detail, onClick }) {
  return (
    <button type="button" aria-pressed={active} className={`discount-stat ${active ? "is-active" : ""}`} onClick={onClick}>
      <span className="discount-stat__icon" aria-hidden="true">{icon}</span>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
    </button>
  );
}

export default function ProductDiscounts() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, configured: 0, active: 0, scheduled: 0, expired: 0, paused: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [toggling, setToggling] = useState(new Set());
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/categories`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (!controller.signal.aborted) setCategories(Array.isArray(data?.categories) ? data.categories : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatsLoading(true);
    setStatsError(false);
    fetch(`${PRODUCTS_API}/promo-stats?admin=true`, { headers: authHeaders(), signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "No se pudo cargar el resumen");
        return data;
      })
      .then((data) => { if (!controller.signal.aborted) setStats(data); })
      .catch(() => { if (!controller.signal.aborted) setStatsError(true); })
      .finally(() => { if (!controller.signal.aborted) setStatsLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setRefresh((current) => current + 1), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const url = new URL(PRODUCTS_API);
        url.searchParams.set("admin", "true");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("sort", "nombre-asc");
        if (query.trim()) url.searchParams.set("q", query.trim());
        if (category) url.searchParams.set("categoria", category);
        if (status !== "all") url.searchParams.set("promoEstado", status);
        const response = await fetch(url, { headers: authHeaders(), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "No se pudieron cargar los productos");
        if (!controller.signal.aborted) {
          const nextPages = data.pages || 1;
          if (page > nextPages) {
            setItems([]);
            setPage(nextPages);
            return;
          }
          setItems(Array.isArray(data?.items) ? data.items : []);
          setPagination({ page: data.page || 1, pages: nextPages, total: data.total || 0 });
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
          setItems([]);
          setPagination({ page: 1, pages: 1, total: 0 });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, status, page, refresh]);

  const reload = () => setRefresh((current) => current + 1);

  const saveInList = () => {
    setEditing(null);
    reload();
  };

  const toggleDiscount = async (product) => {
    const id = String(product._id);
    const resuming = product.promo?.active !== true;
    const expired = product.promo?.hasta && Date.parse(product.promo.hasta) < Date.now();
    const invalidPrice = !(Number(product.promo?.precio) > 0 && Number(product.promo.precio) < getPromotionBasePrice(product));
    if (resuming && (expired || invalidPrice)) {
      notify.warning(expired ? "Actualizá la vigencia antes de reanudar el descuento" : "Revisá el precio antes de reanudar el descuento");
      setEditing(product);
      return;
    }
    setToggling((current) => new Set(current).add(id));
    try {
      const response = await fetch(`${PRODUCTS_API}/${id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ promo: { active: resuming } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "No se pudo cambiar el estado");
      notify.success(data.promo?.active ? "Descuento reanudado" : "Descuento pausado");
      reload();
    } catch (toggleError) {
      notify.error(toggleError.message);
    } finally {
      setToggling((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const removeDiscount = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const response = await fetch(`${PRODUCTS_API}/${removeTarget._id}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ promo: { active: false, precio: null, desde: null, hasta: null, etiqueta: null } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "No se pudo quitar el descuento");
      notify.success("Descuento eliminado");
      setRemoveTarget(null);
      reload();
    } catch (removeError) {
      notify.error(removeError.message);
    } finally {
      setRemoving(false);
    }
  };

  const filterByStatus = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };

  return (
    <div className="product-discounts">
      <div className="discount-intro">
        <div>
          <span className="discount-intro__eyebrow"><Zap size={14} /> PRECIOS PROMOCIONALES</span>
          <h2>Descuentos por producto</h2>
          <p>Configurá el precio que verá y pagará el cliente. El servidor siempre conserva el mejor precio entre promo, mayorista y Aesthetic Days.</p>
        </div>
        <Badge tone="success" dot>Aplicación automática en checkout</Badge>
      </div>

      <div className="discount-stats" aria-label="Resumen de descuentos">
        <StatCard active={status === "all"} icon={<Percent size={19} />} label="Catálogo" value={statsLoading || statsError ? "—" : stats.total} detail={statsLoading ? "Cargando resumen" : statsError ? "Resumen no disponible" : `${stats.configured} configurados`} onClick={() => filterByStatus("all")} />
        <StatCard active={status === "active"} icon={<Check size={19} />} label="Activos" value={statsLoading || statsError ? "—" : stats.active} detail={statsLoading ? "Cargando resumen" : statsError ? "Resumen no disponible" : "visibles ahora"} onClick={() => filterByStatus("active")} />
        <StatCard active={status === "scheduled"} icon={<CalendarClock size={19} />} label="Programados" value={statsLoading || statsError ? "—" : stats.scheduled} detail={statsLoading ? "Cargando resumen" : statsError ? "Resumen no disponible" : "para más adelante"} onClick={() => filterByStatus("scheduled")} />
        <StatCard active={status === "paused"} icon={<Pause size={19} />} label="Pausados" value={statsLoading || statsError ? "—" : stats.paused} detail={statsLoading ? "Cargando resumen" : statsError ? "Resumen no disponible" : `${stats.expired} vencidos`} onClick={() => filterByStatus("paused")} />
      </div>

      <Card pad className="discount-toolbar">
        <Input type="search" value={query} placeholder="Buscar producto, SKU o código…" icon={<Search size={16} />} onChange={(event) => { setQuery(event.target.value); setPage(1); }} aria-label="Buscar productos" />
        <Select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {categories.map((item) => <option key={item._id || item.slug} value={item.slug}>{item.nombre}</option>)}
        </Select>
        <Select value={status} onChange={(event) => filterByStatus(event.target.value)} aria-label="Filtrar por estado">
          <option value="all">Todos los productos</option>
          <option value="configured">Con descuento configurado</option>
          <option value="active">Activos ahora</option>
          <option value="scheduled">Programados</option>
          <option value="expired">Vencidos</option>
          <option value="paused">Pausados</option>
        </Select>
      </Card>

      {error && <div className="ui-banner ui-banner--danger promotions-error" role="alert">{error}<Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button></div>}

      {loading && items.length === 0 ? (
        <Card pad className="promotions-loading"><Skeleton variant="block" /><Skeleton variant="block" /><Skeleton variant="block" /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<Percent size={24} />} title="No encontramos productos" description="Probá con otra búsqueda o cambiá los filtros." action={<Button variant="secondary" onClick={() => { setQuery(""); setCategory(""); filterByStatus("all"); }}>Limpiar filtros</Button>} /></Card>
      ) : (
        <>
          <div className={`discount-list ${loading ? "is-loading" : ""}`}>
            {items.map((product) => {
              const state = getDiscountStatus(product);
              const percentageValue = getDiscountPercentage(product);
              const hasDiscount = Number(product.promo?.precio) > 0;
              const basePrice = getPromotionBasePrice(product);
              const canConfigure = basePrice > 0;
              return (
                <Card className="discount-row" key={product._id}>
                  <div className="discount-row__product">
                    <div className="discount-row__thumb"><ProductImage product={product} alt="" /></div>
                    <div><strong>{product.nombre}</strong><span>{product.sku || product.codigoInterno || "Sin SKU"}</span><small>{product.categoria || "Sin categoría"}</small></div>
                  </div>
                  <div className="discount-row__price">
                    <span>Precio base</span>
                    <strong className={hasDiscount ? "is-struck" : ""}>${formatARS(basePrice)}</strong>
                  </div>
                  <div className="discount-row__offer">
                    {hasDiscount ? <><strong>${formatARS(product.promo.precio)}</strong>{percentageValue != null && <Badge tone="brand">-{percentageValue}%</Badge>}</> : <span>Sin configurar</span>}
                  </div>
                  <div className="discount-row__status">
                    <Badge tone={state.tone} dot>{state.label}</Badge>
                    {hasDiscount && <small>{product.promo?.etiqueta || "Oferta"}</small>}
                  </div>
                  <div className="discount-row__dates">
                    {hasDiscount ? <><span><Clock3 size={13} /> {formatDate(product.promo?.desde, "Inmediato")}</span><span>hasta {formatDate(product.promo?.hasta)}</span></> : <span>Sin programación</span>}
                  </div>
                  <div className="discount-row__actions">
                    {hasDiscount && (
                      <Button size="sm" variant="ghost" onClick={() => toggleDiscount(product)} disabled={toggling.has(String(product._id))} title={product.promo?.active ? "Pausar" : "Reanudar"} aria-label={product.promo?.active ? "Pausar descuento" : "Reanudar descuento"}>
                        {product.promo?.active ? <Pause size={16} /> : <Play size={16} />}
                      </Button>
                    )}
                    <Button size="sm" variant={hasDiscount ? "secondary" : "primary"} onClick={() => setEditing(product)} disabled={!canConfigure && !hasDiscount} title={!canConfigure ? "El producto necesita un precio unitario base" : undefined}><Edit3 size={15} /> {hasDiscount ? "Editar" : "Crear"}</Button>
                    {hasDiscount && <Button size="sm" variant="danger-ghost" onClick={() => setRemoveTarget(product)} title="Quitar descuento" aria-label="Quitar descuento"><Trash2 size={15} /></Button>}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="discount-pagination">
            <span>{pagination.total} producto{pagination.total !== 1 ? "s" : ""}</span>
            <div><Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button><strong>{pagination.page} / {pagination.pages}</strong><Button size="sm" variant="secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>Siguiente</Button></div>
          </div>
        </>
      )}

      <DiscountForm open={Boolean(editing)} product={editing} onClose={() => setEditing(null)} onSaved={saveInList} />
      <ConfirmDialog open={Boolean(removeTarget)} title="Quitar descuento" message={`¿Quitar el descuento de “${removeTarget?.nombre || "este producto"}”? El producto conservará su precio base.`} confirmText="Quitar descuento" onConfirm={removeDiscount} onCancel={() => setRemoveTarget(null)} loading={removing} />
    </div>
  );
}
