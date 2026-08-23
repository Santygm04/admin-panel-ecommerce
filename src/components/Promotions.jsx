import { useEffect, useMemo, useState } from "react";
import { Edit3, Megaphone, Power, Plus, Search, Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Table, TBody, Td, Th, THead, Textarea } from "./ui";
import { API_URL, authHeaders } from "../utils/api";
import { notify } from "../utils/toast";
import "./Promotions.css";

const API = `${API_URL}/api/promotions`;

const pad = (n) => String(n).padStart(2, "0");

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function newPromotionForm() {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    text: "",
    productIds: [],
    destinationType: "auto",
    destinationValue: "",
    startAt: toDateTimeLocal(start),
    endAt: toDateTimeLocal(end),
    backgroundColor: "#17121f",
    textColor: "#ffffff",
    priority: 0,
    active: true,
  };
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function productLabel(product) {
  if (!product) return "Producto";
  const code = product.codigoInterno || product.sku;
  return code ? `${product.nombre} · ${code}` : product.nombre;
}

function PromotionForm({ open, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || newPromotionForm());
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [productCache, setProductCache] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initial || newPromotionForm());
    setProductQuery("");
    setError("");
    const selected = (initial?.productRecords || []).reduce((acc, product) => {
      acc[String(product._id)] = product;
      return acc;
    }, {});
    setProductCache(selected);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    if (!productQuery.trim()) {
      setProductResults([]);
      setLoadingProducts(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingProducts(true);
      try {
        const url = new URL(`${API_URL}/api/productos`);
        url.searchParams.set("admin", "true");
        url.searchParams.set("limit", "40");
        if (productQuery.trim()) url.searchParams.set("q", productQuery.trim());
        const response = await fetch(url, { headers: authHeaders(), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "No se pudieron buscar productos");
        const items = Array.isArray(data) ? data : data.items || [];
        setProductResults(items);
        setProductCache((current) => ({
          ...current,
          ...Object.fromEntries(items.map((product) => [String(product._id), product])),
        }));
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoadingProducts(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, productQuery]);

  const selectedProducts = useMemo(
    () => form.productIds.map((id) => productCache[String(id)]).filter(Boolean),
    [form.productIds, productCache]
  );

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const toggleProduct = (product) => {
    const id = String(product._id);
    setProductCache((current) => ({ ...current, [id]: product }));
    setProductQuery("");
    setProductResults([]);
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(id)
        ? current.productIds.filter((productId) => productId !== id)
        : [...current.productIds, id],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.text.trim()) return setError("Escribí el texto que verá el público.");
    if (!form.startAt || !form.endAt || new Date(form.endAt) <= new Date(form.startAt)) {
      return setError("La fecha de finalización debe ser posterior al inicio.");
    }
    if (["product", "products"].includes(form.destinationType) && form.productIds.length === 0) {
      return setError("Asociá al menos un producto para ese destino.");
    }
    if (form.destinationType === "category" && !form.destinationValue.trim()) {
      return setError("Indicá una categoría de destino.");
    }
    if (form.destinationType === "url" && !/^\/(?!\/)|^https?:\/\//i.test(form.destinationValue.trim())) {
      return setError("La URL debe ser interna o comenzar con https://.");
    }

    setSaving(true);
    try {
      const response = await fetch(initial?._id ? `${API}/${initial._id}` : API, {
        method: initial?._id ? "PUT" : "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          priority: Number(form.priority) || 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "No se pudo guardar la promoción");
      notify.success(initial?._id ? "Promoción actualizada" : "Promoción creada");
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
      title={initial?._id ? "Editar promoción" : "Nueva promoción"}
      subtitle="Configurá el mensaje, su vigencia y el destino del click."
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="promotion-form" loading={saving}>
            {saving ? "Guardando…" : "Guardar promoción"}
          </Button>
        </>
      )}
    >
      <form id="promotion-form" className="promotion-form" onSubmit={submit}>
        {error && <div className="ui-banner ui-banner--danger" role="alert">{error}</div>}

        <Field label="Texto de la cinta" required hint="Máximo 240 caracteres. Se mostrará como marquesina en el storefront.">
          <Textarea
            value={form.text}
            maxLength={240}
            required
            placeholder="Envíos a todo el país · 20% OFF en seleccionados"
            onChange={(event) => setField("text", event.target.value)}
          />
          <span className="promotion-counter">{form.text.length}/240</span>
        </Field>

        <div className="promotion-form-grid">
          <Field label="Fecha de inicio" required>
            <Input type="datetime-local" value={form.startAt} required onChange={(event) => setField("startAt", event.target.value)} />
          </Field>
          <Field label="Fecha de finalización" required>
            <Input type="datetime-local" value={form.endAt} required onChange={(event) => setField("endAt", event.target.value)} />
          </Field>
          <Field label="Prioridad" hint="Las promociones con menor número aparecen primero.">
            <Input type="number" min="0" max="9999" value={form.priority} onChange={(event) => setField("priority", event.target.value)} />
          </Field>
          <Field label="Estado">
            <label className="promotion-switch-label">
              <input type="checkbox" checked={form.active} onChange={(event) => setField("active", event.target.checked)} />
              <span>{form.active ? "Activa" : "Inactiva"}</span>
            </label>
          </Field>
        </div>

        <Field label="Productos asociados" hint="Opcional. Buscá por nombre, código interno o SKU y seleccioná varios.">
          <div className="promotion-product-search">
            <Input
              value={productQuery}
              placeholder="Buscar producto o SKU…"
              onChange={(event) => setProductQuery(event.target.value)}
              icon={<Search size={16} />}
            />
            {productQuery.trim() && (
              <div className="promotion-product-results" role="listbox" aria-label="Productos encontrados">
                {loadingProducts && <span className="promotion-search-status">Buscando…</span>}
                {!loadingProducts && productResults.length === 0 && <span className="promotion-search-status">No hay coincidencias.</span>}
                {productResults.map((product) => {
                  const selected = form.productIds.includes(String(product._id));
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`promotion-product-option ${selected ? "is-selected" : ""}`}
                      key={product._id}
                      onClick={() => toggleProduct(product)}
                    >
                      <span>{productLabel(product)}</span>
                      <span>{selected ? "Seleccionado" : "Agregar"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {selectedProducts.length > 0 && (
            <div className="promotion-selected-products">
              {selectedProducts.map((product) => (
                <button type="button" className="promotion-product-chip" key={product._id} onClick={() => toggleProduct(product)}>
                  {product.nombre}<span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
        </Field>

        <div className="promotion-form-grid promotion-form-grid--destination">
          <Field label="Destino al click" hint="Automático: producto si hay uno, landing de promoción si hay varios.">
            <Select value={form.destinationType} onChange={(event) => setField("destinationType", event.target.value)}>
              <option value="auto">Automático según productos</option>
              <option value="product">Producto específico</option>
              <option value="products">Listado de productos asociados</option>
              <option value="category">Categoría</option>
              <option value="url">URL personalizada</option>
            </Select>
          </Field>
          {form.destinationType === "product" ? (
            <Field label="Producto de destino" required>
              <Select value={form.destinationValue} onChange={(event) => setField("destinationValue", event.target.value)}>
                <option value="">Elegí un producto</option>
                {selectedProducts.map((product) => <option key={product._id} value={product._id}>{product.nombre}</option>)}
              </Select>
            </Field>
          ) : form.destinationType === "category" ? (
            <Field label="Slug de categoría" required>
              <Input value={form.destinationValue} placeholder="skincare" onChange={(event) => setField("destinationValue", event.target.value.toLowerCase())} />
            </Field>
          ) : form.destinationType === "url" ? (
            <Field label="URL de destino" required>
              <Input value={form.destinationValue} placeholder="/promos" onChange={(event) => setField("destinationValue", event.target.value)} />
            </Field>
          ) : (
            <div className="promotion-destination-note">La cinta resolverá el destino con los productos seleccionados.</div>
          )}
        </div>

        <div className="promotion-form-grid promotion-form-grid--colors">
          <Field label="Color de fondo">
            <div className="promotion-color-field"><Input type="color" value={form.backgroundColor} onChange={(event) => setField("backgroundColor", event.target.value)} /><Input value={form.backgroundColor} pattern="^#[0-9a-fA-F]{6}$" onChange={(event) => setField("backgroundColor", event.target.value)} /></div>
          </Field>
          <Field label="Color del texto">
            <div className="promotion-color-field"><Input type="color" value={form.textColor} onChange={(event) => setField("textColor", event.target.value)} /><Input value={form.textColor} pattern="^#[0-9a-fA-F]{6}$" onChange={(event) => setField("textColor", event.target.value)} /></div>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export default function Promotions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(new Set());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "No se pudieron cargar las promociones");
      setItems(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing({
      ...item,
      productRecords: item.productIds || [],
      productIds: (item.productIds || []).map((product) => String(product._id || product)),
      startAt: toDateTimeLocal(item.startAt),
      endAt: toDateTimeLocal(item.endAt),
    });
    setFormOpen(true);
  };

  const saveItem = (saved) => {
    setItems((current) => {
      const exists = current.some((item) => item._id === saved._id);
      return exists ? current.map((item) => item._id === saved._id ? saved : item) : [saved, ...current];
    });
    setFormOpen(false);
  };

  const toggle = async (item) => {
    const next = new Set(toggling);
    next.add(item._id);
    setToggling(next);
    try {
      const response = await fetch(`${API}/${item._id}/toggle`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "No se pudo cambiar el estado");
      setItems((current) => current.map((entry) => entry._id === data._id ? data : entry));
      notify.success(data.active ? "Promoción activada" : "Promoción desactivada");
    } catch (toggleError) {
      notify.error(toggleError.message);
    } finally {
      const nextSet = new Set(next);
      nextSet.delete(item._id);
      setToggling(nextSet);
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API}/${deleteTarget._id}`, { method: "DELETE", headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "No se pudo eliminar la promoción");
      setItems((current) => current.filter((item) => item._id !== deleteTarget._id));
      setDeleteTarget(null);
      notify.success("Promoción eliminada");
    } catch (deleteError) {
      notify.error(deleteError.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="ui-page promotions-page">
      <div className="promotions-head">
        <div>
          <div className="promotions-eyebrow"><Megaphone size={15} /> MARKETING</div>
          <h1 className="ui-page-title">Cinta promocional</h1>
          <p className="ui-page-sub">Mensajes visibles en la parte superior de tu tienda, con vigencia y destinos configurables.</p>
        </div>
        <Button onClick={openCreate}><Plus size={17} /> Nueva promoción</Button>
      </div>

      {error && <div className="ui-banner ui-banner--danger promotions-error" role="alert">{error}<Button size="sm" variant="secondary" onClick={load}>Reintentar</Button></div>}

      {loading ? (
        <Card className="promotions-loading" pad>
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<Megaphone size={24} />} title="Todavía no hay promociones" description="Creá el primer mensaje para mostrar una cinta en tu tienda." action={<Button onClick={openCreate}><Plus size={16} /> Crear promoción</Button>} /></Card>
      ) : (
        <Table label="Promociones de cinta">
          <THead>
            <Th>Mensaje</Th><Th>Estado</Th><Th>Vigencia</Th><Th>Productos</Th><Th>Prioridad</Th><Th>Acciones</Th>
          </THead>
          <TBody>
            {items.map((item) => (
              <tr key={item._id}>
                <Td><div className="promotion-message"><span className="promotion-swatch" style={{ background: item.backgroundColor }} /><strong>{item.text}</strong><small>{item.destinationType === "auto" ? "Destino automático" : `Destino: ${item.destinationType}`}</small></div></Td>
                <Td><Badge tone={item.active ? "success" : "neutral"} dot>{item.active ? "Activa" : "Inactiva"}</Badge></Td>
                <Td><div className="promotion-dates"><span>{formatDate(item.startAt)}</span><span>hasta {formatDate(item.endAt)}</span></div></Td>
                <Td>{item.productIds?.length || 0}</Td>
                <Td><Badge tone="gold">{item.priority ?? 0}</Badge></Td>
                <Td><div className="ui-table-actions"><Button size="sm" variant="ghost" onClick={() => toggle(item)} disabled={toggling.has(item._id)} title={item.active ? "Desactivar" : "Activar"} aria-label={item.active ? "Desactivar promoción" : "Activar promoción"}><Power size={16} /></Button><Button size="sm" variant="ghost" onClick={() => openEdit(item)} title="Editar" aria-label="Editar promoción"><Edit3 size={16} /></Button><Button size="sm" variant="danger-ghost" onClick={() => setDeleteTarget(item)} title="Eliminar" aria-label="Eliminar promoción"><Trash2 size={16} /></Button></div></Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}

      <PromotionForm open={formOpen} initial={editing} onClose={() => setFormOpen(false)} onSaved={saveItem} />
      <ConfirmDialog open={Boolean(deleteTarget)} title="Eliminar promoción" message={`¿Eliminar “${deleteTarget?.text || "esta promoción"}”? Esta acción no se puede deshacer.`} confirmText="Eliminar" onConfirm={deleteItem} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </section>
  );
}
