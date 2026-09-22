export const normalizeSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const isLenceriaCategory = (category) => normalizeSlug(category) === "lenceria";

export const parseMoneyInput = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const hasDot = lastDot !== -1;
  const hasComma = lastComma !== -1;
  let normalized = cleaned;

  if (hasDot && hasComma) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = cleaned.replaceAll(thousandsSep, "").replace(decimalSep, ".");
  } else if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const parts = cleaned.split(sep);
    const tail = parts.at(-1) || "";

    normalized = parts.length > 2 || tail.length === 3
      ? parts.join("")
      : cleaned.replace(sep, ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const parseOptionalMoneyInput = (value) =>
  String(value ?? "").trim() === "" ? null : parseMoneyInput(value);

export const parseOptionalIntegerInput = (value) => {
  if (String(value ?? "").trim() === "") return null;
  const parsed = parseMoneyInput(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
};

const LENCERIA_TIER_DEFINITIONS = [
  { key: "mayorista", priceField: "precioMayorista", minimumField: "minimoMayorista", defaultMinimum: 2 },
  { key: "mayorista2", priceField: "precioMayorista2", minimumField: "minimoMayorista2", defaultMinimum: 6 },
  { key: "mayorista3", priceField: "precioMayorista3", minimumField: "minimoMayorista3", defaultMinimum: 12 },
];

export const formatARS = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return amount.toLocaleString("es-AR", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

export const getLenceriaPricePreview = (product = {}) =>
  LENCERIA_TIER_DEFINITIONS.map(({ key, priceField, minimumField, defaultMinimum }) => {
    const unitPrice = parseOptionalMoneyInput(product?.[priceField]);
    const minimum = parseOptionalIntegerInput(product?.[minimumField]) ?? defaultMinimum;
    const hasPrice = unitPrice != null && unitPrice > 0;

    return {
      key,
      priceField,
      minimumField,
      minimum,
      unitPrice: hasPrice ? unitPrice : null,
      totalPrice: hasPrice ? Number((unitPrice * minimum).toFixed(2)) : null,
    };
  });
