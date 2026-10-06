// Reparte un stock total entre N variantes lo más parejo posible: la parte
// entera para todas y el resto de a una unidad entre las primeras.
export const distributeStockEvenly = (total, count) => {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 0) return [];
  const base = Math.floor(safeTotal / safeCount);
  const remainder = safeTotal % safeCount;
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
};

export const parseVariantStock = (value) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const sumVariantStocks = (variants = []) =>
  (Array.isArray(variants) ? variants : []).reduce(
    (sum, variant) => sum + parseVariantStock(variant?.stock),
    0,
  );

// Una fila sin talle ni color todavía no es una variante real (el submit la ignora).
export const isActiveVariantRow = (variant) => Boolean(
  String(variant?.size ?? variant?.talle ?? "").trim()
  || String(variant?.color ?? "").trim(),
);

export const getVariantRowSize = (variant) => String(variant?.size ?? variant?.talle ?? "").trim();

export const getVariantRowColor = (variant) => String(variant?.color ?? "").trim();

// Reparte el stock total entre las filas activas. Con onlyEmpty solo completa
// las que todavía no tienen cantidad, descontando lo que ya está asignado.
export const distributeStockAcrossRows = (rows, totalStock, { onlyEmpty = false } = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  const active = list.filter(isActiveVariantRow);
  if (!active.length) return list;

  const target = onlyEmpty
    ? active.filter((variant) => String(variant?.stock ?? "").trim() === "")
    : active;
  if (!target.length) return list;

  const assigned = onlyEmpty
    ? active.reduce((sum, variant) => sum + parseVariantStock(variant.stock), 0)
    : 0;
  const remaining = Math.max(0, parseVariantStock(totalStock) - assigned);
  if (remaining <= 0) return list;

  const split = distributeStockEvenly(remaining, target.length);
  const targetSet = new Set(target);
  let index = 0;
  return list.map((variant) => (
    targetSet.has(variant) ? { ...variant, stock: String(split[index++]) } : variant
  ));
};
