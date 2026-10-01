// src/utils/schedule.js
// Utilidades compartidas para la vigencia de "Nuevos ingresos" y "Destacados".
// Las fechas viajan como ISO (UTC) y se muestran/editan en hora local.

export const LEGACY_NEW_ARRIVAL_WINDOW_DAYS = 5;
export const NEW_ARRIVAL_TAG = "nuevos-ingresos";

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (number) => String(number).padStart(2, "0");

export const SCHEDULE_KINDS = {
  nuevo: {
    key: "nuevo",
    title: "Nuevos ingresos",
    checkbox: "Mostrar como nuevo",
    shortLabel: "Nuevo",
    badge: "Nuevo",
  },
  destacado: {
    key: "destacado",
    title: "Producto destacado",
    checkbox: "Mostrar como destacado",
    shortLabel: "Destacado",
    badge: "Destacado",
  },
};

export function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function scheduleTimestamp(value) {
  if (value == null || value === "") return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function scheduleWindowState(desde, hasta, now = Date.now()) {
  const from = scheduleTimestamp(desde);
  const to = scheduleTimestamp(hasta);
  if (desde && from == null) return "inactive";
  if (hasta && to == null) return "inactive";
  if (from != null && now < from) return "scheduled";
  if (to != null && now > to) return "expired";
  return "active";
}

export function validateScheduleRange(desde, hasta) {
  const from = scheduleTimestamp(desde);
  const to = scheduleTimestamp(hasta);
  if (from != null && to != null && to <= from) {
    return "La fecha de finalización debe ser posterior a la de inicio.";
  }
  return null;
}

export function getScheduleStatus({ activo, desde, hasta } = {}, now = Date.now()) {
  if (activo !== true) {
    return { key: "inactive", label: "Desactivado", tone: "neutral" };
  }
  const state = scheduleWindowState(desde, hasta, now);
  if (state === "scheduled") return { key: "scheduled", label: "Programado", tone: "info" };
  if (state === "expired") return { key: "expired", label: "Vencido", tone: "warning" };
  return { key: "active", label: "Vigente", tone: "success" };
}

export function formatScheduleDateTime(value, emptyLabel = "Sin vencimiento") {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function computeEndFromDuration(startValue, days, now = Date.now()) {
  const start = scheduleTimestamp(startValue);
  const base = start != null ? start : now;
  return toDateTimeLocal(new Date(base + days * DAY_MS));
}

export function summarizeSchedule(kind, { activo, desde, hasta } = {}) {
  const label = SCHEDULE_KINDS[kind]?.shortLabel || "Etiqueta";
  if (activo !== true) return `${label} desactivado`;
  const from = scheduleTimestamp(desde);
  const to = scheduleTimestamp(hasta);
  if (to == null) {
    return from != null && from > Date.now()
      ? `${label} desde el ${formatScheduleDateTime(desde)} · sin vencimiento`
      : `${label} activo · sin vencimiento`;
  }
  if (from != null && to != null) {
    const durationDays = Math.max(1, Math.round((to - from) / DAY_MS));
    return `${label} durante ${durationDays} día${durationDays === 1 ? "" : "s"} · hasta el ${formatScheduleDateTime(hasta)}`;
  }
  return `${label} hasta el ${formatScheduleDateTime(hasta)}`;
}

export function inferDurationMode({ desde, hasta } = {}) {
  if (!hasta) return "none";
  const from = scheduleTimestamp(desde);
  const to = scheduleTimestamp(hasta);
  if (from != null && to != null) {
    const days = Math.round((to - from) / DAY_MS);
    if ([7, 15, 30].includes(days)) return String(days);
  }
  return "custom";
}

/** Configuración de vigencia a partir del producto (incluye migración legada). */
export function scheduleFromProduct(product, kind) {
  if (kind === "nuevo") {
    if (product?.nuevoActivo === true || product?.nuevoActivo === false) {
      return {
        activo: product.nuevoActivo === true,
        desde: toDateTimeLocal(product.nuevoDesde),
        hasta: toDateTimeLocal(product.nuevoHasta),
      };
    }
    // Registro previo: tag "nuevos-ingresos" + 5 días desde createdAt.
    const tagged = Array.isArray(product?.tags)
      && product.tags.some((tag) => String(tag || "").trim().toLowerCase() === NEW_ARRIVAL_TAG);
    if (!tagged) return { activo: false, desde: "", hasta: "" };
    const created = scheduleTimestamp(product?.createdAt);
    if (created == null) {
      return { activo: product?.nuevoVigente === true, desde: "", hasta: "" };
    }
    const end = created + LEGACY_NEW_ARRIVAL_WINDOW_DAYS * DAY_MS;
    return {
      activo: Date.now() < end,
      desde: toDateTimeLocal(new Date(created)),
      hasta: toDateTimeLocal(new Date(end)),
    };
  }

  return {
    activo: product?.destacado === true,
    desde: toDateTimeLocal(product?.destacadoDesde),
    hasta: toDateTimeLocal(product?.destacadoHasta),
  };
}

export function syncNewArrivalTag(tags, activo) {
  const list = Array.isArray(tags) ? tags : [];
  const set = new Set(list.map((tag) => String(tag || "").trim()).filter(Boolean));
  if (activo) set.add(NEW_ARRIVAL_TAG);
  else set.delete(NEW_ARRIVAL_TAG);
  return Array.from(set);
}

export function schedulePayloadFromState({ activo, desde, hasta }) {
  return {
    activo: activo === true,
    desde: toIsoOrNull(desde),
    hasta: toIsoOrNull(hasta),
  };
}
