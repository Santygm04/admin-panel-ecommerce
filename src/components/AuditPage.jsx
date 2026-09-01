import { useEffect, useState } from "react";
import { ClipboardList, Eye, Filter, RefreshCw } from "lucide-react";
import { useAuth } from "./AuthContext";
import { Badge, Button, Card, Field, Input, Modal, Select, Table, TBody, Td, Th, THead } from "./ui";
import "./AuditPage.css";

const ACTION_LABELS = {
  "auth.login": "Inicio de sesión",
  "auth.logout": "Cierre de sesión",
  "auth.denied": "Acceso rechazado",
  "auth.forbidden": "Permiso rechazado",
  "auth.profile.update": "Perfil actualizado",
  "auth.password.change": "Contraseña actualizada",
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
  "stats.snapshot.run": "Snapshots reconstruidos",
  "stats.snapshot.clear": "Snapshots eliminados",
  "stats.snapshot.reset": "Snapshots reiniciados",
  "stats.snapshot.refresh_day": "Snapshot recalculado",
};

const QUICK_EVENT_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "users", label: "Usuarios" },
  { key: "sales", label: "Ventas" },
  { key: "product-created", label: "Producto creado" },
  { key: "products", label: "Productos" },
  { key: "security", label: "Seguridad" },
];

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function actionLabel(action) {
  return ACTION_LABELS[action] || action || "Evento";
}

function metadataLabel(metadata) {
  if (metadata === undefined || metadata === null || metadata === "") return "-";
  if (typeof metadata === "object" && !Object.keys(metadata).length) return "-";
  return String(typeof metadata === "object" ? JSON.stringify(metadata) : metadata).slice(0, 140);
}

function metadataJson(metadata) {
  if (metadata === undefined || metadata === null || metadata === "") return "Sin datos adicionales";
  if (typeof metadata === "object" && !Object.keys(metadata).length) return "Sin datos adicionales";
  return typeof metadata === "object" ? JSON.stringify(metadata, null, 2) : String(metadata);
}

function detailValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function AuditDetailField({ label, value, mono = false }) {
  return (
    <div className="audit-detail-field">
      <dt>{label}</dt>
      <dd className={mono ? "audit-detail-mono" : ""}>{detailValue(value)}</dd>
    </div>
  );
}

function AuditDetailModal({ event, onClose }) {
  if (!event) return null;

  const resultLabel = event.success ? "Operación exitosa" : `Operación rechazada · ${event.statusCode || 403}`;
  const actor = event.actor?.username || "Sistema";
  const resource = event.resource?.type
    ? `${event.resource.type}${event.resource.id ? ` · ${event.resource.id}` : ""}`
    : "Sin recurso asociado";

  return (
    <Modal
      open
      wide
      title={actionLabel(event.action)}
      subtitle={`Evento registrado el ${formatDate(event.createdAt)}`}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}
    >
      <div className="audit-detail-modal">
        <div className={`audit-detail-result ${event.success ? "is-success" : "is-danger"}`}>
          <span className="audit-detail-result-dot" aria-hidden="true" />
          <div>
            <strong>{resultLabel}</strong>
            <span>{event.success ? "La solicitud se completó correctamente." : "La solicitud no llegó a completarse."}</span>
          </div>
        </div>

        <dl className="audit-detail-grid">
          <AuditDetailField label="Usuario" value={actor} />
          <AuditDetailField label="Rol" value={event.actor?.role || "-"} />
          <AuditDetailField label="Acción técnica" value={event.action} mono />
          <AuditDetailField label="Recurso" value={resource} mono />
          <AuditDetailField label="Método" value={event.method} mono />
          <AuditDetailField label="Código HTTP" value={event.statusCode} mono />
          <AuditDetailField label="Dirección IP" value={event.ip} mono />
          <AuditDetailField label="ID del usuario" value={event.actor?.userId} mono />
          <AuditDetailField label="Ruta solicitada" value={event.path} mono />
          <AuditDetailField label="User-Agent" value={event.userAgent} mono />
        </dl>

        <section className="audit-detail-section" aria-labelledby="audit-metadata-title">
          <div className="audit-detail-section-head">
            <div>
              <h3 id="audit-metadata-title">Datos del evento</h3>
              <p>Información adicional guardada para entender qué ocurrió.</p>
            </div>
            <Badge tone="info">JSON</Badge>
          </div>
          <pre className="audit-metadata-code">{metadataJson(event.metadata)}</pre>
        </section>
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
    // La consulta debe reiniciarse solamente al cambiar la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const selectEventType = (type) => {
    const nextFilters = { ...filters, action: "" };
    setEventType(type);
    setFilters(nextFilters);
    load(1, nextFilters, type);
  };

  return (
    <div className="audit-page">
      <div className="audit-head">
        <div>
          <p className="audit-kicker"><ClipboardList size={15} /> Control administrativo</p>
          <h1 className="ui-page-title">Auditoría</h1>
          <p className="ui-page-sub">Registro de accesos, cambios y operaciones sensibles del panel.</p>
        </div>
        <Button variant="secondary" onClick={() => load(data.page)} loading={loading}>
          <RefreshCw size={15} /> Actualizar
        </Button>
      </div>

      <Card pad className="audit-filters">
        <div className="audit-filter-title"><Filter size={16} /> Filtrar eventos</div>
        <div className="audit-quick-filters" aria-label="Filtros rápidos por tipo de actividad">
          <span className="audit-quick-label">Acceso rápido</span>
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
        <form className="audit-filter-grid" onSubmit={(event) => { event.preventDefault(); load(1); }}>
          <Field label="Acción exacta" hint="Opcional: buscá un código como user.update">
            <Input value={filters.action} onChange={(event) => { updateFilter("action", event.target.value); if (event.target.value) setEventType("all"); }} placeholder="Ej: user.update" />
          </Field>
          <Field label="Usuario">
            <Input value={filters.username} onChange={(event) => updateFilter("username", event.target.value)} placeholder="Buscar usuario" />
          </Field>
          <Field label="Resultado">
            <Select value={filters.success} onChange={(event) => updateFilter("success", event.target.value)}>
              <option value="">Todos</option>
              <option value="true">Exitosos</option>
              <option value="false">Rechazados</option>
            </Select>
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
          <span>Página {data.page || 1} de {data.pages || 1}</span>
        </div>
        {loading ? (
          <div className="audit-loading">Cargando eventos…</div>
        ) : data.items?.length ? (
          <Table label="Registro de auditoría" className="audit-table-wrap">
            <THead>
              <Th>Fecha</Th>
              <Th>Usuario</Th>
              <Th>Acción</Th>
              <Th>Recurso</Th>
              <Th>Detalle</Th>
              <Th>Resultado</Th>
              <Th>Origen</Th>
            </THead>
            <TBody>
              {data.items.map((item) => (
                <tr key={item._id}>
                  <Td data-label="Fecha">{formatDate(item.createdAt)}</Td>
                  <Td data-label="Usuario">
                    <strong>{item.actor?.username || "Sistema"}</strong>
                    {item.actor?.role && <small>{item.actor.role}</small>}
                  </Td>
                  <Td data-label="Acción">
                    <strong>{actionLabel(item.action)}</strong>
                    <small>{item.action}</small>
                  </Td>
                  <Td data-label="Recurso">{item.resource?.type ? `${item.resource.type}${item.resource.id ? ` · ${item.resource.id.slice(0, 12)}` : ""}` : "-"}</Td>
                   <Td data-label="Detalle">
                     <div className="audit-detail-cell">
                       <small className="audit-detail" title={metadataLabel(item.metadata)}>{metadataLabel(item.metadata)}</small>
                       <Button
                         variant="ghost"
                         size="sm"
                         className="audit-detail-btn"
                         onClick={() => setSelectedEvent(item)}
                         aria-label={`Ver detalle de ${actionLabel(item.action)}`}
                       >
                         <Eye size={15} /> Ver detalle
                       </Button>
                     </div>
                   </Td>
                  <Td data-label="Resultado"><Badge tone={item.success ? "success" : "danger"}>{item.success ? "OK" : `${item.statusCode || 403}`}</Badge></Td>
                  <Td data-label="Origen">{item.ip || "-"}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <div className="audit-empty">No hay eventos para los filtros seleccionados.</div>
        )}
        <div className="audit-pagination">
          <Button variant="secondary" size="sm" disabled={data.page <= 1 || loading} onClick={() => load(data.page - 1)}>
            Anterior
          </Button>
          <Button variant="secondary" size="sm" disabled={data.page >= data.pages || loading} onClick={() => load(data.page + 1)}>
            Siguiente
          </Button>
        </div>
      </Card>

      <AuditDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
