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
