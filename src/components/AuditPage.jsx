import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  Package,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { Badge, Button, Card, Field, Input, Modal, Select, Table, TBody, Td, Th, THead } from "./ui";
import { formatARS } from "../utils/pricing";
import "./AuditPage.css";

const ACTION_LABELS = {
  "auth.login": "Inicio de sesión",
  "auth.logout": "Cierre de sesión",
  "auth.denied": "Acceso rechazado",
  "auth.forbidden": "Permiso rechazado",
  "auth.profile.update": "Perfil actualizado",
  "auth.password.change": "Contraseña actualizada",
  "auth.credentials.reset": "Credenciales restablecidas",
  "user.create": "Usuario creado",
  "user.update": "Usuario actualizado",
  "user.delete": "Usuario eliminado",
  "permission.request": "Permiso solicitado",
  "product.create": "Producto creado",
  "product.update": "Producto actualizado",
  "product.visibility.update": "Visibilidad modificada",
  "product.delete": "Producto eliminado",
  "category.create": "Categoría creada",
  "category.update": "Categoría actualizada",
  "category.delete": "Categoría eliminada",
  "promotion.create": "Promoción creada",
  "promotion.update": "Promoción actualizada",
  "promotion.toggle": "Promoción activada/desactivada",
  "promotion.delete": "Promoción eliminada",
  "aesthetic-days.activate": "Aesthetic Days activado",
  "aesthetic-days.deactivate": "Aesthetic Days desactivado",
  "banner.create": "Banner creado",
  "banner.update": "Banner actualizado",
  "banner.delete": "Banner eliminado",
  "banner.toggle": "Banner activado/desactivado",
  "banner.archive": "Banner archivado/restaurado",
  "banner.reorder": "Orden de banners actualizado",
  "order.confirm": "Orden confirmada",
  "order.cancel": "Orden cancelada",
  "order.ship": "Orden despachada",
  "order.delivered": "Orden entregada",
  "order.delete": "Orden enviada a papelera",
  "order.delete_permanent": "Orden eliminada permanentemente",
  "shipping.create": "Envío generado",
  "erp.product.create": "Producto creado en ERP",
  "erp.product.update": "Producto actualizado en ERP",
  "erp.product.archive": "Producto archivado en ERP",
  "erp.stock.sync": "Stock sincronizado desde Pitukas",
  "stats.snapshot.run": "Snapshots reconstruidos",
  "stats.snapshot.clear": "Snapshots eliminados",
  "stats.snapshot.reset": "Snapshots reiniciados",
  "stats.snapshot.refresh_day": "Snapshot recalculado",
};

const FIELD_LABELS = {
  nombre: "Nombre",
  name: "Nombre",
  descripcion: "Descripción",
  precio: "Precio",
  precioX2: "Precio x2",
  precioEspecial: "Precio especial",
  precioMayorista: "Precio mayorista",
  precioCaja: "Precio por caja",
  precioMediaCaja: "Precio media caja",
  precioMayorista2: "Precio mayorista x6",
  precioMayorista3: "Precio mayorista x12",
  precioOriginal: "Precio anterior",
  minimoMayorista: "Mínimo mayorista",
  minimoMayorista2: "Mínimo x6",
  minimoMayorista3: "Mínimo x12",
  unidadesPorCaja: "Unidades por caja",
  cantidadTonos: "Cantidad de tonos",
  modoTonos: "Modo de tonos",
  tonosDisponibles: "Tonos",
  publicarEnCajas: "Publicar en cajas",
  categoria: "Categoría",
  subcategoria: "Subcategoría",
  stock: "Stock",
  stockMinimo: "Stock mínimo",
  destacado: "Destacado",
  destacadoDesde: "Destacado desde",
  destacadoHasta: "Destacado hasta",
  nuevoActivo: "Nuevo ingreso activo",
  nuevoDesde: "Nuevo desde",
  nuevoHasta: "Nuevo hasta",
  promo: "Promoción",
  visible: "Visible",
  syncToERP: "Publicado en ERP",
  imagenes: "Imágenes",
  imagen: "Imagen",
  variants: "Variantes",
  codigoInterno: "Código interno",
  sku: "SKU",
  tags: "Etiquetas",
  fields: "Campos",
  username: "Usuario",
  role: "Rol",
  passwordChanged: "Contraseña cambiada",
  password: "Contraseña",
  orderNumber: "Número de orden",
  status: "Estado",
  method: "Método",
  company: "Empresa",
  provider: "Proveedor",
  days: "Días",
  active: "Activo",
  priority: "Prioridad",
  destinationType: "Destino",
  destinationValue: "Destino",
  permission: "Permiso",
  reason: "Motivo",
  requiredAny: "Permiso necesario",
  via: "Vía",
  slug: "Dirección",
  text: "Texto",
  productIds: "Productos",
  alt: "Texto alternativo",
  imagenDesktop: "Imagen escritorio",
  imagenMobile: "Imagen mobile",
  orden: "Orden",
  dispositivo: "Dispositivo",
  linkType: "Tipo de enlace",
  linkValue: "Enlace",
  botonTexto: "Texto del botón",
  abrirNuevaPestana: "Abrir en pestaña nueva",
  archivado: "Archivado",
  email: "Email",
  phone: "Teléfono",
  minimo: "Mínimo",
};

const REASON_LABELS = {
  missing_credentials: "faltaron los datos de acceso",
  invalid_credentials: "el usuario o la contraseña no coinciden",
  rate_limited: "demasiados intentos seguidos",
  current_password_invalid: "la contraseña actual no coincide",
  variant_reconfiguration: "quiso reconfigurar variantes sin permiso",
};

const RESOURCE_LABELS = {
  product: "Producto",
  erp_product: "Producto ERP",
  category: "Categoría",
  promotion: "Promoción",
  banner: "Banner",
  order: "Orden",
  user: "Usuario",
  permission: "Permiso",
  stats_snapshot: "Estadísticas",
};

const ROLE_LABELS = {
  admin: "Administradora",
  vendedor: "Vendedor",
  integration: "Pitukas ERP",
  system: "Sistema",
};

const STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  shipped: "Enviada",
  delivered: "Entregada",
  cancelled: "Cancelada",
  rejected: "Rechazada",
};

const QUICK_EVENT_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "security", label: "Accesos" },
  { key: "users", label: "Usuarios" },
  { key: "products", label: "Productos" },
  { key: "sales", label: "Ventas" },
  { key: "categories", label: "Categorías" },
  { key: "promotions", label: "Promociones" },
  { key: "banners", label: "Banners" },
  { key: "stats", label: "Estadísticas" },
  { key: "erp", label: "ERP" },
];

const RESULT_FILTERS = [
  { value: "", label: "Todos" },
  { value: "true", label: "✓ Exitosos" },
  { value: "false", label: "✕ Con problemas" },
];

const ACTION_GROUPS = [
  { label: "Usuarios y permisos", actions: ["user.create", "user.update", "user.delete", "permission.request"] },
  { label: "Accesos", actions: ["auth.login", "auth.logout", "auth.denied", "auth.forbidden", "auth.profile.update", "auth.password.change", "auth.credentials.reset"] },
  { label: "Productos", actions: ["product.create", "product.update", "product.visibility.update", "product.delete"] },
  { label: "Categorías", actions: ["category.create", "category.update", "category.delete"] },
  { label: "Promociones", actions: ["promotion.create", "promotion.update", "promotion.toggle", "promotion.delete", "aesthetic-days.activate", "aesthetic-days.deactivate"] },
  { label: "Banners", actions: ["banner.create", "banner.update", "banner.delete", "banner.toggle", "banner.archive", "banner.reorder"] },
  { label: "Ventas y envíos", actions: ["order.confirm", "order.cancel", "order.ship", "order.delivered", "order.delete", "order.delete_permanent", "shipping.create"] },
  { label: "ERP", actions: ["erp.product.create", "erp.product.update", "erp.product.archive", "erp.stock.sync"] },
  { label: "Estadísticas", actions: ["stats.snapshot.run", "stats.snapshot.clear", "stats.snapshot.reset", "stats.snapshot.refresh_day"] },
];

const actionLabel = (action) => ACTION_LABELS[action] || action || "Evento";
const fieldLabel = (field) => FIELD_LABELS[field] || String(field || "");
const reasonLabel = (reason) => REASON_LABELS[reason] || String(reason || "sin detalle");
const roleLabel = (role) => ROLE_LABELS[role] || role || "-";

function actionTone(action) {
  if (!action) return "neutral";
  if (action.endsWith(".delete") || action.endsWith(".delete_permanent")) return "danger";
  if (action === "auth.denied" || action === "auth.forbidden") return "danger";
  if (action === "auth.login") return "success";
  if (action === "auth.logout") return "neutral";
  if (action.endsWith(".create")) return "info";
  if (action.endsWith(".update") || action.endsWith(".toggle")) return "warning";
  if (action.startsWith("erp") || action.endsWith(".activate") || action.endsWith(".deactivate")) return "info";
  return "brand";
}

function formatDateParts(value) {
  if (!value) return { date: "-", time: "-" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };
  return {
    date: new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date),
    time: new Intl.DateTimeFormat("es-AR", { timeStyle: "short" }).format(date),
  };
}

function formatDate(value) {
  const parts = formatDateParts(value);
  return parts.date === "-" ? "-" : `${parts.date} · ${parts.time}`;
}

function orderRef(metadata = {}) {
  return metadata.orderNumber ? `#${metadata.orderNumber}` : "sin número";
}

function fieldsText(fields) {
  if (!Array.isArray(fields) || !fields.length) return "";
  return fields.map(fieldLabel).join(", ");
}

function resourceText(item) {
  const type = RESOURCE_LABELS[item.resource?.type] || "";
  const metadata = item.metadata || {};
  const name = metadata.name || metadata.slug || metadata.username || "";
  if (type && name) return `${type} · ${name}`;
  if (type) return type;
  if (name) return String(name);
  return "—";
}

function summarizeObject(value) {
  if (!value || typeof value !== "object") return String(value ?? "—");
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "");
  if (!entries.length) return "—";
  return entries
    .map(([key, item]) => `${fieldLabel(key)}: ${typeof item === "object" ? summarizeObject(item) : item}`)
    .join(" · ");
}

function formatMetadataValue(key, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    if (key === "fields" || key.startsWith("required")) return value.map(fieldLabel).join(", ");
    return value.map((item) => (typeof item === "object" ? summarizeObject(item) : String(item))).join(", ");
  }
  if (typeof value === "number") return /precio|minimo|monto|total/i.test(key) ? formatARS(value) : String(value);
  if (typeof value === "object") return summarizeObject(value);
  if (key === "reason") return reasonLabel(value);
  if (key === "status") return STATUS_LABELS[value] || value;
  if (key === "role") return roleLabel(value);
  return String(value);
}

function eventStory(item) {
  const metadata = item.metadata || {};
  const product = metadata.name ? `«${metadata.name}»` : "";
  const withFields = fieldsText(metadata.fields) ? ` Campos modificados: ${fieldsText(metadata.fields)}.` : "";

  switch (item.action) {
    case "auth.login":
      return item.success
        ? `Inició sesión en el panel${metadata.username ? ` como ${metadata.username}` : ""}.`
        : `No pudo iniciar sesión porque ${reasonLabel(metadata.reason || "invalid_credentials")}.`;
    case "auth.logout":
      return "Cerró sesión en el panel.";
    case "auth.denied":
      return "Se rechazó un acceso porque la sesión no era válida.";
    case "auth.forbidden":
      if (fieldsText(metadata.fields)) return `Se bloqueó un cambio fuera de sus permisos: ${fieldsText(metadata.fields)}.`;
      if (Array.isArray(metadata.requiredAny)) return `Se bloqueó una acción sin los permisos necesarios (${metadata.requiredAny.map(fieldLabel).join(", ")}).`;
      return `Se bloqueó una acción no permitida${metadata.reason ? ` porque ${reasonLabel(metadata.reason)}` : ""}.`;
    case "auth.profile.update":
      return `Actualizó su perfil.${withFields}`;
    case "auth.password.change":
      return "Cambió la contraseña de su cuenta.";
    case "auth.credentials.reset":
      return `Restableció las credenciales de ${metadata.username ? `«${metadata.username}»` : "un usuario"}.`;
    case "user.create":
      return `Creó el usuario «${metadata.username || "sin nombre"}»${metadata.role ? ` con rol ${roleLabel(metadata.role)}` : ""}.`;
    case "user.update":
      return `Editó un usuario${metadata.passwordChanged ? " y cambió su contraseña" : ""}.${withFields}`;
    case "user.delete":
      return `Eliminó el usuario «${metadata.username || "sin nombre"}».`;
    case "permission.request":
      return `Solicitó el permiso ${fieldLabel(metadata.permission)}.`;
    case "product.create":
      return `Cargó el producto ${product || "nuevo"}.`;
    case "product.update":
      return `Editó ${product ? `el producto ${product}` : "un producto"}.${withFields}`;
    case "product.visibility.update":
      return `Cambió la visibilidad del producto: ahora está ${metadata.visible ? "visible en la tienda" : "oculto"}.`;
    case "product.delete":
      return `Eliminó el producto ${product || "del catálogo"}.`;
    case "category.create":
      return `Creó la categoría «${metadata.slug || "sin nombre"}».`;
    case "category.update":
      return `Editó una categoría.${withFields}`;
    case "category.delete":
      return `Eliminó la categoría «${metadata.slug || "sin nombre"}».`;
    case "promotion.create":
      return `Creó una promoción para la cinta${metadata.text ? `: «${metadata.text}»` : ""}.`;
    case "promotion.update":
      return `Editó la promoción${metadata.text ? ` «${metadata.text}»` : ""}.${withFields}`;
    case "promotion.toggle":
      return `La promoción${metadata.text ? ` «${metadata.text}»` : ""} quedó ${metadata.active ? "activa" : "pausada"}.`;
    case "promotion.delete":
      return `Eliminó la promoción${metadata.text ? ` «${metadata.text}»` : ""}.`;
    case "aesthetic-days.activate":
      return "Activó Aesthetic Days para toda la tienda.";
    case "aesthetic-days.deactivate":
      return "Desactivó Aesthetic Days.";
    case "banner.create":
      return `Creó el banner «${metadata.nombre || "sin nombre"}».`;
    case "banner.update":
      return `Editó el banner «${metadata.nombre || "sin nombre"}».${withFields}`;
    case "banner.delete":
      return `Eliminó el banner «${metadata.nombre || "sin nombre"}».`;
    case "banner.toggle":
      return `El banner «${metadata.nombre || "sin nombre"}» quedó ${metadata.activo ? "activo" : "desactivado"}.`;
    case "banner.archive":
      return `El banner «${metadata.nombre || "sin nombre"}» quedó ${metadata.archivado ? "archivado" : "restaurado"}.`;
    case "banner.reorder":
      return `Reordenó los banners del inicio${metadata.total ? ` (${metadata.total} en total)` : ""}.`;
    case "order.confirm":
      return `Confirmó la orden ${orderRef(metadata)}.`;
    case "order.cancel":
      return `Canceló la orden ${orderRef(metadata)}.`;
    case "order.ship":
      return `Marcó como enviada la orden ${orderRef(metadata)}${metadata.company ? ` por ${metadata.company}` : ""}.`;
    case "order.delivered":
      return `Marcó como entregada la orden ${orderRef(metadata)}.`;
    case "order.delete":
      return `Envió a la papelera la orden ${orderRef(metadata)}.`;
    case "order.delete_permanent":
      return `Eliminó definitivamente la orden ${orderRef(metadata)}.`;
    case "shipping.create":
      return `Generó un envío con ${metadata.provider || "Andreani"} para la orden ${orderRef(metadata)}.`;
    case "erp.product.create":
      return "Se creó un producto desde el ERP (Pitukas).";
    case "erp.product.update":
      return "Se actualizó un producto desde el ERP (Pitukas).";
    case "erp.product.archive":
      return "Se archivó un producto desde el ERP (Pitukas).";
    case "erp.stock.sync":
      return "Se sincronizó el stock desde Pitukas.";
    case "stats.snapshot.run":
      return `Reconstruyó los snapshots de estadísticas${metadata.days ? ` (${metadata.days} días)` : ""}.`;
    case "stats.snapshot.clear":
      return "Eliminó snapshots de estadísticas.";
    case "stats.snapshot.reset":
      return `Reinició snapshots de estadísticas${metadata.days ? ` (${metadata.days} días)` : ""}.`;
    case "stats.snapshot.refresh_day":
      return "Recalculó un día de estadísticas.";
    default:
      return `${actionLabel(item.action)}.`;
  }
}

function metadataEntries(metadata) {
  if (!metadata || typeof metadata !== "object") return [];
  return Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function paginatorPages(totalPages, current) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
  if (current >= totalPages - 3) return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", current - 1, current, current + 1, "…", totalPages];
}

function AuditDetailField({ label, value, mono = false }) {
  return (
    <div className="audit-detail-field">
      <dt>{label}</dt>
      <dd className={mono ? "audit-detail-mono" : ""}>{value === undefined || value === null || value === "" ? "—" : String(value)}</dd>
    </div>
  );
}

function AuditDetailModal({ event, onClose }) {
  if (!event) return null;

  const metadata = event.metadata || {};
  const entries = metadataEntries(metadata);
  const actorName = event.actor?.username || "";
  const actor = actorName || (metadata.username ? `Intento con «${metadata.username}»` : "Sin sesión");

  return (
    <Modal
      open
      wide
      title={actionLabel(event.action)}
      subtitle={`${formatDate(event.createdAt)} · ${actor}`}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}
    >
      <div className="audit-detail-modal">
        <div className={`audit-detail-result ${event.success ? "is-success" : "is-danger"}`}>
          <span className="audit-detail-result-dot" aria-hidden="true" />
          <div>
            <strong>{event.success ? "Salió bien" : "No se completó"}</strong>
            <span>{event.success ? "La operación se completó correctamente." : `La operación fue rechazada (código ${event.statusCode || 403}).`}</span>
          </div>
        </div>

        <section className="audit-detail-section" aria-labelledby="audit-story-title">
          <div className="audit-detail-section-head">
            <div>
              <h3 id="audit-story-title">Qué pasó</h3>
              <p>Resumen en palabras de la acción registrada.</p>
            </div>
            <Badge tone={actionTone(event.action)}>{actionLabel(event.action)}</Badge>
          </div>
          <div className="audit-story">
            <p>{eventStory(event)}</p>
            <div className="audit-story-meta">
              <span><b>Quién:</b> {actor}{actorName && event.actor?.role ? ` (${roleLabel(event.actor.role)})` : ""}</span>
              <span><b>Cuándo:</b> {formatDate(event.createdAt)}</span>
              <span><b>Dónde:</b> {resourceText(event)}</span>
            </div>
          </div>
        </section>

        <section className="audit-detail-section" aria-labelledby="audit-data-title">
          <div className="audit-detail-section-head">
            <div>
              <h3 id="audit-data-title">Datos del evento</h3>
              <p>La información que se guardó, con nombres claros.</p>
            </div>
          </div>
          {entries.length ? (
            <dl className="audit-detail-grid">
              {entries.map(([key, value]) => (
                <AuditDetailField key={key} label={fieldLabel(key)} value={formatMetadataValue(key, value)} />
              ))}
            </dl>
          ) : (
            <p className="audit-detail-empty">Este evento no guardó datos extra.</p>
          )}
        </section>

        <details className="audit-tech">
          <summary>Datos técnicos (para soporte)</summary>
          <dl className="audit-detail-grid">
            <AuditDetailField label="Fecha exacta" value={new Date(event.createdAt).toLocaleString("es-AR")} />
            <AuditDetailField label="Acción interna" value={event.action} mono />
            <AuditDetailField label="Usuario" value={actor} />
            <AuditDetailField label="ID del usuario" value={event.actor?.userId} mono />
            <AuditDetailField label="Recurso" value={resourceText(event)} />
            <AuditDetailField label="ID del recurso" value={event.resource?.id} mono />
            <AuditDetailField label="Dirección IP" value={event.ip} mono />
            <AuditDetailField label="Método y ruta" value={`${event.method || "-"} ${event.path || ""}`} mono />
            <AuditDetailField label="Código de respuesta" value={event.statusCode} mono />
            <AuditDetailField label="Navegador" value={event.userAgent} mono />
          </dl>
        </details>
      </div>
    </Modal>
  );
}

export default function AuditPage() {
  const { getAuditLogs, token } = useAuth();
  const [filters, setFilters] = useState({ action: "", username: "", success: "", from: "", to: "" });
  const [eventType, setEventType] = useState("all");
  const [data, setData] = useState({ items: [], page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const load = async (page = 1, values = filters, type = eventType) => {
    setLoading(true);
    setError("");
    try {
      const result = await getAuditLogs({ ...values, eventType: type === "all" ? "" : type, page, limit: 25 });
      setData(result);
    } catch (err) {
      setError(err?.message || "No se pudo cargar la auditoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const selectAction = (value) => {
    updateFilter("action", value);
    setEventType("all");
  };

  const selectEventType = (type) => {
    const nextFilters = { ...filters, action: "" };
    setEventType(type);
    setFilters(nextFilters);
    load(1, nextFilters, type);
  };

  const selectResult = (value) => {
    const nextFilters = { ...filters, success: value };
    setFilters(nextFilters);
    load(1, nextFilters, eventType);
  };

  const items = data.items || [];
  const successCount = items.filter((item) => item.success).length;
  const failedCount = items.filter((item) => !item.success).length;
  const productChanges = items.filter((item) => item.action?.startsWith("product.") || item.action?.startsWith("erp.product")).length;

  const kpis = [
    { key: "total", label: "Eventos registrados", hint: "Todo el historial", value: data.total || 0, tone: "brand", icon: <ClipboardList size={18} /> },
    { key: "ok", label: "Operaciones exitosas", hint: "En esta página", value: successCount, tone: "success", icon: <ShieldCheck size={18} /> },
    { key: "failed", label: "Con problemas", hint: "En esta página", value: failedCount, tone: "danger", icon: <AlertTriangle size={18} /> },
    { key: "products", label: "Cambios de productos", hint: "En esta página", value: productChanges, tone: "warning", icon: <Package size={18} /> },
  ];

  const totalPages = data.pages || 1;
  const currentPage = data.page || 1;

  return (
    <div className="audit-page">
      <div className="audit-head">
        <div>
          <p className="audit-kicker"><ClipboardList size={15} /> Control administrativo</p>
          <h1 className="ui-page-title">Auditoría</h1>
          <p className="ui-page-sub">Historial simple de lo que pasó en el panel: quién entró, qué cambió y qué falló.</p>
        </div>
        <Button variant="secondary" onClick={() => load(currentPage)} loading={loading}>
          <RefreshCw size={15} /> Actualizar
        </Button>
      </div>

      <div className="audit-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.key} className={`audit-kpi audit-kpi--${kpi.tone}`}>
            <span className="audit-kpi-icon" aria-hidden="true">{kpi.icon}</span>
            <div className="audit-kpi-body">
              <strong>{kpi.value}</strong>
              <span>{kpi.label}</span>
              <small>{kpi.hint}</small>
            </div>
          </div>
        ))}
      </div>

      <Card pad className="audit-filters">
        <div className="audit-filter-title"><Filter size={16} /> Filtrar eventos</div>

        <div className="audit-quick-filters" aria-label="Filtros rápidos por tipo de actividad">
          <span className="audit-quick-label">Tipo de actividad</span>
          <div className="audit-quick-options">
            {QUICK_EVENT_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`audit-quick-option ${eventType === key ? "is-active" : ""}`}
                aria-pressed={eventType === key}
                onClick={() => selectEventType(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="audit-quick-filters" aria-label="Filtros rápidos por resultado">
          <span className="audit-quick-label">Resultado</span>
          <div className="audit-quick-options">
            {RESULT_FILTERS.map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                className={`audit-quick-option ${filters.success === value ? "is-active" : ""}`}
                aria-pressed={filters.success === value}
                onClick={() => selectResult(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <form className="audit-filter-grid" onSubmit={(event) => { event.preventDefault(); load(1); }}>
          <Field label="Acción del panel" hint="Agrupadas por sección">
            <Select value={filters.action} onChange={(event) => selectAction(event.target.value)}>
              <option value="">Todas las acciones</option>
              {ACTION_GROUPS.map(({ label, actions }) => (
                <optgroup key={label} label={label}>
                  {actions.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Usuario">
            <Input value={filters.username} onChange={(event) => updateFilter("username", event.target.value)} placeholder="Buscar usuario" />
          </Field>
          <Field label="Desde"><Input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></Field>
          <div className="audit-filter-action"><Button type="submit"><Filter size={15} /> Aplicar filtros</Button></div>
        </form>
      </Card>

      {error && <div className="ui-banner ui-banner--danger" role="alert">{error}</div>}

      <Card className="audit-table-card">
        <div className="audit-table-meta">
          <strong>{data.total || 0} eventos</strong>
          <span>Página {currentPage} de {totalPages}</span>
        </div>
        {loading ? (
          <div className="audit-loading">Cargando eventos…</div>
        ) : items.length ? (
          <Table label="Registro de auditoría" className="audit-table-wrap">
            <THead>
              <Th>Fecha</Th>
              <Th>Usuario</Th>
              <Th>Acción</Th>
              <Th>Qué</Th>
              <Th>Detalle</Th>
              <Th>Resultado</Th>
              <Th>Origen</Th>
            </THead>
            <TBody>
              {items.map((item) => {
                const dateParts = formatDateParts(item.createdAt);
                const story = eventStory(item);
                return (
                  <tr key={item._id}>
                    <Td data-label="Fecha">
                      <div className="audit-date-cell">
                        <strong>{dateParts.date}</strong>
                        <span>{dateParts.time}</span>
                      </div>
                    </Td>
                    <Td data-label="Usuario">
                      <strong>{item.actor?.username || "Sin sesión"}</strong>
                      {item.actor?.role && <small>{roleLabel(item.actor.role)}</small>}
                    </Td>
                    <Td data-label="Acción">
                      <Badge tone={actionTone(item.action)}>{actionLabel(item.action)}</Badge>
                    </Td>
                    <Td data-label="Qué">{resourceText(item)}</Td>
                    <Td data-label="Detalle">
                      <div className="audit-detail-cell">
                        <small className="audit-detail" title={story}>{story}</small>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="audit-detail-btn"
                          onClick={() => setSelectedEvent(item)}
                          aria-label={`Ver detalle de ${actionLabel(item.action)}`}
                        >
                          <Eye size={15} /> Ver
                        </Button>
                      </div>
                    </Td>
                    <Td data-label="Resultado">
                      <Badge tone={item.success ? "success" : "danger"}>{item.success ? "OK" : "Rechazado"}</Badge>
                    </Td>
                    <Td data-label="Origen">{item.ip || "—"}</Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <div className="audit-empty">
            <ShieldCheck size={28} aria-hidden="true" />
            <p>No hay eventos para los filtros elegidos.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="audit-pagination">
            <span className="audit-pagination-info">
              {((currentPage - 1) * (data.limit || 25)) + 1}–{Math.min(currentPage * (data.limit || 25), data.total || 0)} de {data.total || 0}
            </span>
            <div className="audit-pagination-pages">
              <button
                type="button"
                className="audit-page-btn"
                disabled={currentPage <= 1 || loading}
                onClick={() => load(currentPage - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              {paginatorPages(totalPages, currentPage).map((pageNumber, index) => (
                pageNumber === "…" ? (
                  <span key={`dots-${index}`} className="audit-page-dots">···</span>
                ) : (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`audit-page-btn ${pageNumber === currentPage ? "is-active" : ""}`}
                    disabled={loading}
                    onClick={() => load(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                )
              ))}
              <button
                type="button"
                className="audit-page-btn"
                disabled={currentPage >= totalPages || loading}
                onClick={() => load(currentPage + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </Card>

      <AuditDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
