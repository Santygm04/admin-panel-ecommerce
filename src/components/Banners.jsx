import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  ImageOff,
  Images,
  Link2,
  Monitor,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import BulkBannersModal from "./BulkBannersModal";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton } from "./ui";
import { API_URL, authHeaders } from "../utils/api";
import { cloudinaryErrorMessage, uploadCloudinaryImage } from "../utils/cloudinary";
import { normalizeImageUrl } from "../utils/image";
import { toDateTimeLocal, toIsoOrNull } from "../utils/schedule";
import { notify } from "../utils/toast";
import "./Banners.css";

const API = `${API_URL}/api/banners`;
const PRODUCTS_API = `${API_URL}/api/productos`;
const MAX_IMAGE_MB = 8;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

const ESTADO_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Vigentes" },
  { key: "scheduled", label: "Programados" },
  { key: "expired", label: "Vencidos" },
  { key: "inactive", label: "Inactivos" },
  { key: "archived", label: "Archivados" },
];

const ESTADO_INFO = {
  active: { label: "Vigente", tone: "success" },
  scheduled: { label: "Programado", tone: "info" },
  expired: { label: "Vencido", tone: "warning" },
  inactive: { label: "Inactivo", tone: "neutral" },
  archived: { label: "Archivado", tone: "neutral" },
};

const DEVICE_LABELS = { todos: "Todos los dispositivos", desktop: "Solo escritorio", mobile: "Solo mobile" };
const DEVICE_SHORT = { todos: "Todos", desktop: "Desktop", mobile: "Mobile" };
const LINK_TYPE_LABELS = {
  none: "Sin enlace",
  product: "Producto",
  category: "Categoría",
  promotion: "Promoción",
  url: "URL personalizada",
};

const SORT_OPTIONS = [
  { value: "orden", label: "Orden de aparición" },
  { value: "recientes", label: "Más recientes" },
  { value: "inicio-asc", label: "Inicio más próximo" },
  { value: "inicio-desc", label: "Inicio más lejano" },
  { value: "fin-asc", label: "Vencimiento más próximo" },
  { value: "fin-desc", label: "Vencimiento más lejano" },
  { value: "estado", label: "Estado" },
];

function formatDate(value, empty = "—") {
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function formatFull(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha inválida";
  return date.toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" });
}

// Los errores de red de fetch llegan en inglés ("Failed to fetch"); los
// traducimos a un mensaje claro para el panel.
function friendlyErrorMessage(error, fallback = "No se pudo completar la acción") {
  const message = String(error?.message || "").trim();
  if (!message || /failed to fetch|load failed|network ?error|fetch failed|networkerror/i.test(message)) {
    return "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  }
  return message;
}

function emptyForm() {
  return {
    _id: null,
    nombre: "",
    alt: "",
    imagenDesktop: "",
    imagenMobile: "",
    dispositivo: "todos",
    orden: 0,
    activo: true,
    desde: "",
    hasta: "",
    linkType: "none",
    linkValue: "",
    botonTexto: "",
    abrirNuevaPestana: false,
  };
}

function formFromBanner(banner) {
  return {
    _id: banner._id,
    nombre: banner.nombre || "",
    alt: banner.alt || "",
    imagenDesktop: banner.imagenDesktop || "",
    imagenMobile: banner.imagenMobile || "",
    dispositivo: banner.dispositivo || "todos",
    orden: Number(banner.orden) || 0,
    activo: banner.activo !== false,
    desde: toDateTimeLocal(banner.desde),
    hasta: toDateTimeLocal(banner.hasta),
    linkType: banner.linkType || "none",
    linkValue: banner.linkValue || "",
    botonTexto: banner.botonTexto || "",
    abrirNuevaPestana: banner.abrirNuevaPestana === true,
  };
}

function serializeForm(form) {
  return {
    nombre: String(form.nombre || "").trim(),
    alt: String(form.alt || "").trim(),
    imagenDesktop: form.imagenDesktop,
    imagenMobile: form.imagenMobile || "",
    dispositivo: form.dispositivo || "todos",
    orden: Number(form.orden) || 0,
    activo: form.activo !== false,
    desde: toIsoOrNull(form.desde),
    hasta: toIsoOrNull(form.hasta),
    linkType: form.linkType || "none",
    linkValue: form.linkValue || "",
    botonTexto: String(form.botonTexto || "").trim(),
    abrirNuevaPestana: form.linkType !== "none" && form.abrirNuevaPestana === true,
  };
}

function linkDestinationLabel(banner) {
  switch (banner.linkType) {
    case "none": return "Sin enlace";
    case "product": return `Producto · ${banner.linkValue}`;
    case "category": return `Categoría · ${banner.linkValue}`;
    case "promotion": return `Promoción · ${banner.linkValue}`;
    case "url": return banner.linkValue;
    default: return "Sin enlace";
  }
}

function bannerHref(banner) {
  if (!banner || banner.linkType === "none" || !banner.linkValue) return null;
  if (banner.linkValid === false) return null;
  switch (banner.linkType) {
    case "product": return `/producto/${banner.linkValue}`;
    case "category": return `/category/${banner.linkValue}`;
    case "promotion": return `/promocion/${banner.linkValue}`;
    case "url": return banner.linkValue;
    default: return null;
  }
}

function dateSummary(form, now = Date.now()) {
  const from = form.desde ? new Date(form.desde).getTime() : null;
  const to = form.hasta ? new Date(form.hasta).getTime() : null;
  if (from && to && to <= from) return { tone: "danger", text: "La fecha de finalización debe ser posterior a la de inicio." };
  if (!from && !to) return { tone: "neutral", text: "Sin fechas: se muestra siempre que el banner esté activo." };
  if (to && to < now) return { tone: "warning", text: `Banner vencido el ${formatFull(form.hasta)}.` };
  if (from && from > now) return { tone: "info", text: `Se publicará el ${formatFull(form.desde)}${to ? ` y vence el ${formatFull(form.hasta)}.` : "."}` };
  if (!to) return { tone: "success", text: `Vigente${from ? ` desde el ${formatFull(form.desde)}` : " ahora"} · sin vencimiento.` };
  return { tone: "success", text: `Vigente hasta el ${formatFull(form.hasta)}.` };
}

function BannerPreview({ banner, onClose }) {
  const [device, setDevice] = useState(banner?.imagenMobile ? "mobile" : "desktop");
  if (!banner) return null;

  const image = device === "mobile"
    ? (banner.imagenMobile || banner.imagenDesktop)
    : (banner.imagenDesktop || banner.imagenMobile);
  const href = bannerHref(banner);
  const estado = ESTADO_INFO[banner.estado] || ESTADO_INFO.inactive;

  return (
    <Modal
      open
      wide
      title={`Previsualización · ${banner.nombre}`}
      subtitle="Así se verá en la página de inicio. El botón es solo una muestra: no navega."
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}
    >
      <div className="bn-preview">
        <div className="bn-preview-switch" role="tablist" aria-label="Dispositivo de previsualización">
          <button
            type="button"
            role="tab"
            aria-selected={device === "desktop"}
            className={`bn-preview-tab ${device === "desktop" ? "is-active" : ""}`}
            onClick={() => setDevice("desktop")}
          >
            <Monitor size={15} /> Escritorio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={device === "mobile"}
            className={`bn-preview-tab ${device === "mobile" ? "is-active" : ""}`}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone size={15} /> Mobile
          </button>
        </div>

        <div className={`bn-preview-frame bn-preview-frame--${device}`}>
          {image ? (
            <img src={normalizeImageUrl(image)} alt={banner.alt || banner.nombre} />
          ) : (
            <div className="bn-preview-noimage"><ImageOff size={26} /> Sin imagen</div>
          )}
          {banner.botonTexto && (
            <span className="bn-preview-cta">{banner.botonTexto}</span>
          )}
        </div>

        {device === "mobile" && !banner.imagenMobile && (
          <p className="bn-preview-note">Este banner no tiene imagen mobile: se usa la de escritorio.</p>
        )}

        <dl className="bn-preview-meta">
          <div><dt>Estado</dt><dd><Badge tone={estado.tone}>{estado.label}</Badge></dd></div>
          <div><dt>Dispositivo</dt><dd>{DEVICE_LABELS[banner.dispositivo] || "Todos"}</dd></div>
          <div><dt>Publicación</dt><dd>{formatDate(banner.desde, "Inmediata")}</dd></div>
          <div><dt>Vencimiento</dt><dd>{formatDate(banner.hasta, "Sin vencimiento")}</dd></div>
          <div className="bn-preview-meta-wide">
            <dt>Enlace</dt>
            <dd>
              {href ? (
                <>
                  <code>{href}</code>
                  <span className="bn-preview-link-note">
                    {banner.linkValid === false
                      ? " · El destino ya no existe, el enlace se desactiva."
                      : banner.abrirNuevaPestana ? " · Se abre en una pestaña nueva." : " · Se abre en la misma pestaña."}
                  </span>
                </>
              ) : "Sin enlace"}
            </dd>
          </div>
          <div className="bn-preview-meta-wide">
            <dt>Texto alternativo</dt>
            <dd>{banner.alt || banner.nombre}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

function ImagePicker({ label, hint, value, uploading, error, onChange, onClear, required = false }) {
  const inputRef = useRef(null);
  return (
    <div className="bn-image-field">
      <div className="bn-image-head">
        <span className="bn-image-label">{label}{required && <b> *</b>}</span>
        {hint && <span className="bn-image-hint">{hint}</span>}
      </div>
      {value ? (
        <div className="bn-image-preview">
          <img src={normalizeImageUrl(value)} alt="" />
          <div className="bn-image-actions">
            <Button size="sm" variant="secondary" type="button" onClick={() => inputRef.current?.click()} loading={uploading}>
              <Upload size={14} /> Reemplazar
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={onClear} disabled={uploading}>
              <Trash2 size={14} /> Quitar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="bn-dropzone"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <span className="ui-spinner" /> : <Upload size={22} />}
          <span>{uploading ? "Subiendo imagen…" : "Hacé click para subir una imagen"}</span>
          <small>JPG, PNG, WebP o AVIF · Máximo {MAX_IMAGE_MB} MB</small>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(event) => { onChange(event.target.files?.[0]); event.target.value = ""; }}
        hidden
      />
      {error && <p className="bn-image-error" role="alert">{error}</p>}
    </div>
  );
}

function BannerForm({ open, banner, onClose, onSaved }) {
  const isEdit = Boolean(banner?._id);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [productLabel, setProductLabel] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categories, setCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    if (!open) return;
    const next = banner ? formFromBanner(banner) : emptyForm();
    setForm(next);
    setInitialForm(next);
    setError("");
    setImageErrors({});
    setProductQuery("");
    setProductResults([]);
    setProductLabel("");
  }, [open, banner]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    Promise.allSettled([
      fetch(`${API_URL}/api/categories`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${API_URL}/api/promotions`, { headers: authHeaders(), signal: controller.signal }).then((r) => r.json()),
    ]).then(([cats, promos]) => {
      if (controller.signal.aborted) return;
      setCategories(Array.isArray(cats.value?.categories) ? cats.value.categories : []);
      setPromotions(Array.isArray(promos.value) ? promos.value : []);
    });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open || !isEdit || form.linkType !== "product" || !form.linkValue || productLabel) return undefined;
    let alive = true;
    fetch(`${PRODUCTS_API}/${form.linkValue}?admin=true`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data?.nombre) setProductLabel(data.nombre); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, isEdit, form.linkType, form.linkValue, productLabel]);

  useEffect(() => {
    if (!open || form.linkType !== "product" || !productQuery.trim()) {
      setProductResults([]);
      setLoadingProducts(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingProducts(true);
      try {
        const url = new URL(PRODUCTS_API);
        url.searchParams.set("admin", "true");
        url.searchParams.set("limit", "10");
        url.searchParams.set("q", productQuery.trim());
        const response = await fetch(url, { headers: authHeaders(), signal: controller.signal });
        const data = await response.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setProductResults(items);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setProductResults([]);
      } finally {
        if (!controller.signal.aborted) setLoadingProducts(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, form.linkType, productQuery]);

  if (!open) return null;

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleFile = async (slot, file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageErrors((current) => ({ ...current, [slot]: "Formato no permitido. Usá JPG, PNG, WebP o AVIF." }));
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setImageErrors((current) => ({ ...current, [slot]: `La imagen supera el máximo de ${MAX_IMAGE_MB} MB.` }));
      return;
    }
    setImageErrors((current) => ({ ...current, [slot]: "" }));
    setUploading(slot);
    try {
      const url = await uploadCloudinaryImage(file, { folder: "banners" });
      setField(slot === "desktop" ? "imagenDesktop" : "imagenMobile", url);
    } catch (uploadError) {
      setImageErrors((current) => ({ ...current, [slot]: cloudinaryErrorMessage(uploadError) }));
    } finally {
      setUploading(null);
    }
  };

  const clearImage = (slot) => {
    if (slot === "desktop") setField("imagenDesktop", "");
    else setField("imagenMobile", "");
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose?.();
  };

  const applyQuickDate = (mode) => {
    if (mode === "clear-start") return setField("desde", "");
    if (mode === "clear-end") return setField("hasta", "");
    if (mode === "clear-all") return setForm((current) => ({ ...current, desde: "", hasta: "" }));
    const days = Number(mode);
    if (!Number.isFinite(days) || days <= 0) return;
    const base = form.desde ? new Date(form.desde).getTime() : Date.now();
    setField("hasta", toDateTimeLocal(new Date(base + days * 24 * 60 * 60 * 1000)));
  };

  const submit = async () => {
    setError("");
    const payload = serializeForm(form);
    if (payload.nombre.length < 2) return setError("El nombre interno es obligatorio.");
    if (!payload.imagenDesktop) return setError("La imagen para escritorio es obligatoria.");
    if (payload.desde && payload.hasta && new Date(payload.hasta) <= new Date(payload.desde)) {
      return setError("La fecha de finalización debe ser posterior a la de inicio.");
    }
    if (payload.linkType !== "none" && !payload.linkValue) {
      return setError("Completá el destino del enlace o elegí “Sin enlace”.");
    }

    setSaving(true);
    try {
      const response = await fetch(isEdit ? `${API}/${form._id}` : API, {
        method: isEdit ? "PUT" : "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "No se pudo guardar el banner");
      notify.success(isEdit ? "Banner actualizado" : "Banner creado");
      onSaved?.();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, "No se pudo guardar el banner"));
    } finally {
      setSaving(false);
    }
  };

  const summary = dateSummary(form);

  return (
    <>
      <Modal
        open
        wide
        title={isEdit ? `Editar banner · ${banner.nombre}` : "Agregar banner"}
        subtitle="Se mostrará en el carrusel de la página de inicio según su estado y fechas."
        onClose={requestClose}
        footer={(
          <>
            <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} loading={saving}>{isEdit ? "Guardar cambios" : "Crear banner"}</Button>
          </>
        )}
      >
        <div className="bn-form">
          <section className="bn-form-section">
            <h3>Imágenes</h3>
            <p>La imagen de escritorio es obligatoria. La de mobile es opcional y se usa en pantallas chicas.</p>
            <div className="bn-image-grid">
              <ImagePicker
                label="Imagen para escritorio"
                hint="Recomendado 1600×900 (16:9)"
                required
                value={form.imagenDesktop}
                uploading={uploading === "desktop"}
                error={imageErrors.desktop}
                onChange={(file) => handleFile("desktop", file)}
                onClear={() => clearImage("desktop")}
              />
              <ImagePicker
                label="Imagen para mobile"
                hint="Opcional · si falta se usa la de escritorio"
                value={form.imagenMobile}
                uploading={uploading === "mobile"}
                error={imageErrors.mobile}
                onChange={(file) => handleFile("mobile", file)}
                onClear={() => clearImage("mobile")}
              />
            </div>
          </section>

          <section className="bn-form-section">
            <h3>Datos del banner</h3>
            <div className="bn-form-grid">
              <Field label="Nombre interno" required>
                <Input value={form.nombre} onChange={(event) => setField("nombre", event.target.value)} placeholder="Ej: Oferta de primavera" maxLength={120} />
              </Field>
              <Field label="Texto alternativo" hint="Describe la imagen para accesibilidad. Si queda vacío se usa el nombre.">
                <Input value={form.alt} onChange={(event) => setField("alt", event.target.value)} placeholder="Ej: Mujer con labial rosa de perfil" maxLength={200} />
              </Field>
              <Field label="Dispositivo">
                <Select value={form.dispositivo} onChange={(event) => setField("dispositivo", event.target.value)}>
                  <option value="todos">Todos los dispositivos</option>
                  <option value="desktop">Solo escritorio</option>
                  <option value="mobile">Solo mobile</option>
                </Select>
              </Field>
              <Field label="Orden de aparición" hint="Menor número aparece primero.">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.orden}
                  onChange={(event) => setField("orden", event.target.value)}
                  onWheel={(event) => event.currentTarget.blur()}
                />
              </Field>
              <label className="ui-check bn-check">
                <input type="checkbox" checked={form.activo} onChange={(event) => setField("activo", event.target.checked)} />
                Banner activo
              </label>
            </div>
          </section>

          <section className="bn-form-section">
            <h3><CalendarClock size={16} /> Fechas de publicación</h3>
            <p>Sin fecha de inicio se publica ya. Sin fecha de finalización queda “Sin vencimiento”.</p>
            <div className="bn-quick-dates">
              <button type="button" className="bn-chip" onClick={() => applyQuickDate("clear-start")}>Sin inicio</button>
              <button type="button" className="bn-chip" onClick={() => applyQuickDate("clear-end")}>Sin vencimiento</button>
              <button type="button" className="bn-chip" onClick={() => applyQuickDate(7)}>7 días</button>
              <button type="button" className="bn-chip" onClick={() => applyQuickDate(15)}>15 días</button>
              <button type="button" className="bn-chip" onClick={() => applyQuickDate(30)}>30 días</button>
              <button type="button" className="bn-chip" onClick={() => applyQuickDate("clear-all")}>Limpiar fechas</button>
            </div>
            <div className="bn-form-grid">
              <Field label="Inicio de publicación" hint="Vacío = se publica de inmediato.">
                <Input type="datetime-local" value={form.desde} onChange={(event) => setField("desde", event.target.value)} />
              </Field>
              <Field label="Fin de publicación" hint="Vacío = sin vencimiento.">
                <Input type="datetime-local" value={form.hasta} onChange={(event) => setField("hasta", event.target.value)} />
              </Field>
            </div>
            <p className={`bn-date-summary is-${summary.tone}`}>{summary.text}</p>
          </section>

          <section className="bn-form-section">
            <h3><Link2 size={16} /> Enlace</h3>
            <div className="bn-form-grid">
              <Field label="Tipo de enlace">
                <Select
                  value={form.linkType}
                  onChange={(event) => setForm((current) => ({ ...current, linkType: event.target.value, linkValue: "" }))}
                >
                  {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>

              {form.linkType === "product" && (
                <div className="bn-form-field-wide">
                  <Field label="Producto de destino" hint="Buscá por nombre, SKU o código interno.">
                    {form.linkValue ? (
                      <div className="bn-selected-link">
                        <span>{productLabel || `Producto ${form.linkValue}`}</span>
                        <Button size="sm" variant="ghost" type="button" onClick={() => { setField("linkValue", ""); setProductLabel(""); }}>
                          <X size={14} /> Cambiar
                        </Button>
                      </div>
                    ) : (
                      <div className="bn-product-search">
                        <Input
                          value={productQuery}
                          onChange={(event) => setProductQuery(event.target.value)}
                          placeholder="Buscar producto…"
                          icon={<Search size={15} />}
                        />
                        {loadingProducts && <span className="bn-search-loading">Buscando…</span>}
                        {!loadingProducts && productQuery.trim() && (
                          productResults.length ? (
                            <ul className="bn-search-results">
                              {productResults.map((product) => (
                                <li key={product._id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setField("linkValue", product._id);
                                      setProductLabel(product.nombre);
                                      setProductResults([]);
                                      setProductQuery("");
                                    }}
                                  >
                                    <strong>{product.nombre}</strong>
                                    <small>{product.sku || product.codigoInterno || "Sin código"}</small>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : <span className="bn-search-loading">Sin resultados.</span>
                        )}
                      </div>
                    )}
                  </Field>
                </div>
              )}

              {form.linkType === "category" && (
                <Field label="Categoría de destino">
                  <Select value={form.linkValue} onChange={(event) => setField("linkValue", event.target.value)}>
                    <option value="">Elegí una categoría</option>
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>{category.nombre || category.slug}</option>
                    ))}
                  </Select>
                </Field>
              )}

              {form.linkType === "promotion" && (
                <Field label="Promoción de destino" hint="Solo promociones de la cinta (no descuentos de producto).">
                  <Select value={form.linkValue} onChange={(event) => setField("linkValue", event.target.value)}>
                    <option value="">Elegí una promoción</option>
                    {promotions.map((promotion) => (
                      <option key={promotion._id} value={promotion._id}>{promotion.text || `Promoción ${promotion._id}`}</option>
                    ))}
                  </Select>
                </Field>
              )}

              {form.linkType === "url" && (
                <Field label="URL de destino" hint="Ruta interna (/category/unas) o dirección https://">
                  <Input value={form.linkValue} onChange={(event) => setField("linkValue", event.target.value)} placeholder="https://… o /category/…" />
                </Field>
              )}

              {form.linkType !== "none" && (
                <>
                  <Field label="Texto del botón" hint="Opcional. Se muestra sobre la imagen (ej: “Ver más”).">
                    <Input value={form.botonTexto} onChange={(event) => setField("botonTexto", event.target.value)} maxLength={60} placeholder="Ver más" />
                  </Field>
                  <label className="ui-check bn-check">
                    <input type="checkbox" checked={form.abrirNuevaPestana} onChange={(event) => setField("abrirNuevaPestana", event.target.checked)} />
                    Abrir en una pestaña nueva
                  </label>
                </>
              )}
            </div>
          </section>

          {error && <div className="ui-banner ui-banner--danger" role="alert">{error}</div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClose}
        title="Descartar cambios"
        message="Tenés cambios sin guardar en el banner. ¿Querés descartarlos?"
        confirmText="Descartar"
        cancelText="Seguir editando"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); onClose?.(); }}
      />
    </>
  );
}

export default function Banners() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ q: "", estado: "all", dispositivo: "todos", sort: "orden", from: "", to: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (override = {}) => {
    setLoading(true);
    setError("");
    try {
      const active = { ...filters, ...override };
      const params = new URLSearchParams();
      if (active.q) params.set("q", active.q);
      if (active.estado && active.estado !== "all") params.set("estado", active.estado);
      if (active.dispositivo && active.dispositivo !== "todos") params.set("dispositivo", active.dispositivo);
      if (active.sort) params.set("sort", active.sort);
      if (active.from) params.set("from", active.from);
      if (active.to) params.set("to", active.to);
      const response = await fetch(`${API}?${params.toString()}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "No se pudieron cargar los banners");
      setItems(Array.isArray(data.items) ? data.items : []);
      setStats(data.stats || {});
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No se pudieron cargar los banners"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.q === search ? current : { ...current, q: search }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const apiAction = async (method, path, body) => {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "No se pudo completar la acción");
    return data;
  };

  const run = async (action, successMessage) => {
    setBusy(true);
    try {
      await action();
      if (successMessage) notify.success(successMessage);
      await load();
    } catch (actionError) {
      notify.error(friendlyErrorMessage(actionError));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const toggleBanner = (banner) => {
    if (banner.activo) {
      setConfirm({
        title: "Desactivar banner",
        message: `“${banner.nombre}” dejará de mostrarse en la página de inicio hasta que lo actives de nuevo.`,
        confirmText: "Desactivar",
        danger: true,
        action: () => run(() => apiAction("PATCH", `/${banner._id}/toggle`, { activo: false }), "Banner desactivado"),
      });
      return;
    }
    run(() => apiAction("PATCH", `/${banner._id}/toggle`, { activo: true }), "Banner activado");
  };

  const archiveBanner = (banner) => {
    if (!banner.archivado) {
      setConfirm({
        title: "Archivar banner",
        message: `“${banner.nombre}” se guardará archivado y no se mostrará en la tienda. Podés restaurarlo cuando quieras.`,
        confirmText: "Archivar",
        action: () => run(() => apiAction("PATCH", `/${banner._id}/archive`, { archivado: true }), "Banner archivado"),
      });
      return;
    }
    run(() => apiAction("PATCH", `/${banner._id}/archive`, { archivado: false }), "Banner restaurado");
  };

  const deleteBanner = (banner) => {
    setConfirm({
      title: "Eliminar banner",
      message: `“${banner.nombre}” se eliminará definitivamente. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
      action: () => run(() => apiAction("DELETE", `/${banner._id}`), "Banner eliminado"),
    });
  };

  const duplicateBanner = (banner) => {
    const payload = serializeForm(formFromBanner(banner));
    run(
      () => apiAction("POST", "", { ...payload, nombre: `${banner.nombre} (copia)`, activo: false, desde: null, hasta: null, orden: (Number(banner.orden) || 0) + 1 }),
      "Banner duplicado (queda desactivado)"
    );
  };

  const moveBanner = (banner, direction) => {
    const ordered = [...items]
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || new Date(a.createdAt) - new Date(b.createdAt))
      .map((item) => item._id);
    const index = ordered.indexOf(banner._id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    run(() => apiAction("PATCH", "/reorder", { ids: ordered }), "Orden actualizado");
  };

  const canReorder = filters.estado === "all" && filters.dispositivo === "todos" && filters.sort === "orden" && !filters.q;

  const nextOrder = useMemo(() => (
    items.reduce((max, item) => Math.max(max, Number(item.orden) || 0), 0) + 1
  ), [items]);

  const kpis = useMemo(() => ([
    { key: "total", label: "Banners", value: stats.total || 0, tone: "brand" },
    { key: "active", label: "Vigentes", value: stats.active || 0, tone: "success" },
    { key: "scheduled", label: "Programados", value: stats.scheduled || 0, tone: "info" },
    { key: "expired", label: "Vencidos", value: stats.expired || 0, tone: "warning" },
    { key: "inactive", label: "Inactivos", value: stats.inactive || 0, tone: "neutral" },
  ]), [stats]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (banner) => { setEditing(banner); setFormOpen(true); };

  return (
    <div className="bn-page">
      <div className="bn-head">
        <div>
          <p className="bn-kicker"><Images size={15} /> Personalización</p>
          <h1 className="ui-page-title">Banners de inicio</h1>
          <p className="ui-page-sub">Administrá las imágenes del carrusel principal: subí, ordená, programá y activá cada banner.</p>
        </div>
        <div className="bn-head-actions">
          <Button variant="secondary" onClick={() => load()} loading={loading}><RefreshCw size={15} /> Actualizar</Button>
          <Button variant="secondary" onClick={() => setBulkOpen(true)}><Images size={16} /> Subir varias</Button>
          <Button onClick={openCreate}><Plus size={16} /> Agregar banner</Button>
        </div>
      </div>

      <div className="bn-kpis">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            className={`bn-kpi bn-kpi--${kpi.tone} ${filters.estado === (kpi.key === "total" ? "all" : kpi.key) ? "is-active" : ""}`}
            onClick={() => setFilters((current) => ({ ...current, estado: kpi.key === "total" ? "all" : kpi.key }))}
          >
            <strong>{kpi.value}</strong>
            <span>{kpi.label}</span>
          </button>
        ))}
      </div>

      <Card pad className="bn-filters">
        <div className="bn-filters-row">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, texto alternativo o destino…"
            icon={<Search size={15} />}
          />
          <Select value={filters.dispositivo} onChange={(event) => setFilters((current) => ({ ...current, dispositivo: event.target.value }))}>
            <option value="todos">Todos los dispositivos</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </Select>
          <Select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <Input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} aria-label="Creados desde" />
          <Input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} aria-label="Creados hasta" />
        </div>
        <div className="bn-filter-chips">
          {ESTADO_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`bn-chip ${filters.estado === filter.key ? "is-active" : ""}`}
              onClick={() => setFilters((current) => ({ ...current, estado: filter.key }))}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      {error && <div className="ui-banner ui-banner--danger" role="alert">{error}</div>}

      {loading ? (
        <div className="bn-grid">
          {[0, 1, 2].map((index) => <Card key={index} pad><Skeleton variant="block" /></Card>)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Images size={24} />}
            title="Todavía no hay banners"
            description="Subí una o varias imágenes para reemplazar los slides por defecto de la página de inicio."
            action={(
              <div className="bn-empty-actions">
                <Button variant="secondary" onClick={() => setBulkOpen(true)}><Images size={16} /> Subir varias</Button>
                <Button onClick={openCreate}><Plus size={16} /> Agregar banner</Button>
              </div>
            )}
          />
        </Card>
      ) : (
        <div className="bn-grid">
          {items.map((banner) => {
            const estado = ESTADO_INFO[banner.estado] || ESTADO_INFO.inactive;
            const thumb = banner.imagenDesktop || banner.imagenMobile;
            return (
              <article key={banner._id} className={`bn-card ${banner.estado === "archived" ? "is-archived" : ""}`}>
                <div className="bn-thumb">
                  {thumb
                    ? <img src={normalizeImageUrl(thumb)} alt="" loading="lazy" />
                    : <div className="bn-thumb-empty"><ImageOff size={22} /></div>}
                  <Badge tone={estado.tone} className="bn-thumb-state">{estado.label}</Badge>
                  <span className="bn-thumb-device">{banner.imagenMobile ? "Desktop + Mobile" : "Solo desktop"}</span>
                </div>
                <div className="bn-card-body">
                  <div className="bn-card-title">
                    <h3>{banner.nombre}</h3>
                    <span className="bn-card-order" title="Orden de aparición">#{Number(banner.orden) || 0}</span>
                  </div>
                  <p className="bn-card-meta"><b>Dispositivo:</b> {DEVICE_SHORT[banner.dispositivo] || "Todos"}</p>
                  <p className="bn-card-meta"><b>Publicación:</b> {formatDate(banner.desde, "Inmediata")}</p>
                  <p className="bn-card-meta"><b>Vencimiento:</b> {formatDate(banner.hasta, "Sin vencimiento")}</p>
                  <p className={`bn-card-meta bn-card-link ${banner.linkType !== "none" && banner.linkValid === false ? "is-broken" : ""}`}>
                    <Link2 size={13} /> {banner.linkType === "none"
                      ? "Sin enlace"
                      : banner.linkValid === false
                        ? "El destino ya no existe (enlace desactivado)"
                        : linkDestinationLabel(banner)}
                  </p>
                  <div className="bn-card-actions">
                    <Button size="sm" variant="secondary" onClick={() => setPreview(banner)}><Eye size={14} /> Previsualizar</Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(banner)}><Pencil size={14} /> Editar</Button>
                  </div>
                  <div className="bn-card-tools">
                    <button type="button" className="bn-tool" disabled={!canReorder || busy} title={canReorder ? "Subir" : "Quitá los filtros para reordenar"} onClick={() => moveBanner(banner, -1)}><ChevronUp size={15} /></button>
                    <button type="button" className="bn-tool" disabled={!canReorder || busy} title={canReorder ? "Bajar" : "Quitá los filtros para reordenar"} onClick={() => moveBanner(banner, 1)}><ChevronDown size={15} /></button>
                    <button type="button" className="bn-tool" disabled={busy} title={banner.activo ? "Desactivar" : "Activar"} onClick={() => toggleBanner(banner)}><Power size={15} /></button>
                    <button type="button" className="bn-tool" disabled={busy} title="Duplicar" onClick={() => duplicateBanner(banner)}><Copy size={15} /></button>
                    <button type="button" className="bn-tool" disabled={busy} title={banner.archivado ? "Restaurar" : "Archivar"} onClick={() => archiveBanner(banner)}>
                      {banner.archivado ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    </button>
                    <button type="button" className="bn-tool bn-tool--danger" disabled={busy} title="Eliminar" onClick={() => deleteBanner(banner)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {formOpen && (
        <BannerForm
          open={formOpen}
          banner={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); }}
        />
      )}

      {preview && <BannerPreview banner={preview} onClose={() => setPreview(null)} />}

      <BulkBannersModal
        open={bulkOpen}
        nextOrder={nextOrder}
        onClose={() => setBulkOpen(false)}
        onCreated={() => load()}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmText={confirm?.confirmText || "Confirmar"}
        danger={confirm?.danger !== false}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.action?.()}
      />
    </div>
  );
}
