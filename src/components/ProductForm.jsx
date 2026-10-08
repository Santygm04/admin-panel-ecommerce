// ProductForm.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { PlusIcon, UploadIcon, XIcon, CopyIcon } from "./ui/icons";
import ProductScheduleModal, { ProductScheduleSwitch } from "./ProductScheduleModal";
import "./ProductForm.css";
import { API_URL } from "../utils/api";
import { cloudinaryErrorMessage, uploadCloudinaryImage } from "../utils/cloudinary";
import { notify } from "../utils/toast";
import { formatARS, getLenceriaPricePreview, isLenceriaCategory, isMarroquineriaCategory, normalizeSlug, parseMoneyInput, parseOptionalIntegerInput, parseOptionalMoneyInput } from "../utils/pricing";
import { syncNewArrivalTag, toIsoOrNull, validateScheduleRange } from "../utils/schedule";
import { distributeStockAcrossRows, distributeStockEvenly, getVariantRowColor, getVariantRowSize, isActiveVariantRow, parseVariantStock, sumVariantStocks } from "../utils/stockDistribution";

// Subcategorías que ofrecen packs de lencería.
const SUBCAT_DESDE_2 = ["vedetinas", "colales", "boxer", "slip", "niña"];
// Medias también utiliza los tiers x2/x6/x12.
const SUBCAT_MEDIAS  = ["medias"];

// Devuelve el mínimo sugerido según subcategoría
const getMinimoSugerido = (subcat) => {
  if (SUBCAT_DESDE_2.includes(subcat)) return 2;
  if (SUBCAT_MEDIAS.includes(subcat))  return 2; // también tiene x6
  return null;
};

const SIZES  = ["XS","S","M","L","XL","XXL","XXXL","Único"];
const COLORS = ["negro","blanco","beige","nude","rojo","rosa","fucsia","azul","celeste","verde","lila","gris","marrón","multicolor"];
const TONE_COUNTS = Array.from({ length: 24 }, (_, i) => i + 1);

const label = (k) => k.charAt(0).toUpperCase() + k.slice(1);
const API = `${API_URL}/api`;
const categorySlug = (category) => normalizeSlug(category?.slug || category?.nombre);

export default function ProductForm({ onCreated }) {
  const nav = useNavigate();
  const PRODUCTO_INICIAL = {
    nombre: "",
    codigoInterno: "",
    precio: "",
    precioX2: "",
    precioEspecial: "",
    precioMayorista: "",
    precioCaja: "",
    precioMediaCaja: "",
    descripcion: "",
    categoria: "",
    subcategoria: "",
    stock: "",
    stockMinimo: "5",
    destacado: false,
    destacadoDesde: "",
    destacadoHasta: "",
    nuevoActivo: false,
    nuevoDesde: "",
    nuevoHasta: "",
    tags: [],
    variants: [],
    unidadesPorCaja: "",
    cantidadTonos: "",
    minimoMayorista: "30000",
    minimoMayorista2: "",
    minimoMayorista3: "",
    minimoMayorista4: "",
    precioMayorista2: "",
    precioMayorista3: "",
    precioMayorista4: "",
    modoTonos: "automatico",
    tonosDisponibles: [],
    publicarEnCajas: false,
    syncToERP: false,
  };

  const [producto, setProducto] = useState(PRODUCTO_INICIAL);
  const [submitting, setSubmitting] = useState(false);
  const [bulkStock, setBulkStock] = useState("");
  const [scheduleModal, setScheduleModal] = useState(null);

  const [selSizes, setSelSizes]   = useState([]);
  const [selColors, setSelColors] = useState([]);
  const [imagenFiles, setImagenFiles] = useState([]); // array de File
  const [previewUrls, setPreviewUrls] = useState([]); // array de URLs
  const toggle = (arr, setArr, val) =>
    setArr((list) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setProducto((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (name === "categoria") {
      setProducto((prev) => {
        const wasLenceria = isLenceriaCategory(prev.categoria);
        const nextIsLenceria = isLenceriaCategory(value);
        return {
          ...prev,
          [name]: value,
          subcategoria: "",
          minimoMayorista: nextIsLenceria ? (wasLenceria ? prev.minimoMayorista : "2") : (wasLenceria ? "30000" : (prev.minimoMayorista || "30000")),
          minimoMayorista2: nextIsLenceria ? (prev.minimoMayorista2 || "6") : "",
          minimoMayorista3: nextIsLenceria ? (prev.minimoMayorista3 || "12") : "",
          minimoMayorista4: nextIsLenceria ? (prev.minimoMayorista4 || "4") : "",
        };
      });
      return;
    }

    setProducto((prev) => ({ ...prev, [name]: value }));
  };

  const [categoriasDB, setCategoriasDB] = useState([]);
  useEffect(() => {
    axios.get(`${API}/categories`)
      .then(({ data }) => setCategoriasDB(data.categories || []))
      .catch(() => {});
  }, []);
  const subcategorias = categoriasDB.find(c => categorySlug(c) === normalizeSlug(producto.categoria))?.subcategorias || [];

  const handleImageChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setImagenFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (i) => {
    setImagenFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviewUrls((prev) => prev.filter((_, idx) => idx !== i));
  };

  const uploadImages = async () => {
    if (!imagenFiles.length) return { urls: [], failed: 0 };
    const results = await Promise.allSettled(imagenFiles.map(uploadCloudinaryImage));
    const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failures = results
      .map((result, index) => result.status === "rejected"
        ? { name: imagenFiles[index].name, message: cloudinaryErrorMessage(result.reason) }
        : null)
      .filter(Boolean);
    return { urls, failed: failures.length, failures };
  };

  const addVariant = () =>
    setProducto((p) => ({ ...p, variants: [...(p.variants || []), { size: "", color: "" }] }));

  const updateVariant = (i, key, val) =>
    setProducto((p) => {
      const next = [...(p.variants || [])];
      next[i] = { ...next[i], [key]: val };
      return { ...p, variants: next };
    });

  const removeVariant = (i) =>
    setProducto((p) => {
      const next = [...(p.variants || [])];
      next.splice(i, 1);
      return { ...p, variants: next };
    });

  const addBulk = () => {
    if (!selSizes.length && !selColors.length) {
      notify.warning("Elegí al menos un talle o un color"); return;
    }
    setProducto((p) => {
      const list = [...(p.variants || [])];
      if (selSizes.length && selColors.length) {
        // combinaciones talle × color
        selSizes.forEach((sz) => selColors.forEach((col) => {
          if (!list.some(v => v.size === sz && v.color === col))
            list.push({ size: sz, color: col, stock: "" });
        }));
      } else if (selSizes.length) {
        // solo talles, sin color
        selSizes.forEach((sz) => {
          if (!list.some(v => v.size === sz && !v.color))
            list.push({ size: sz, color: "", stock: "" });
        });
      } else {
        // solo colores, sin talle
        selColors.forEach((col) => {
          if (!list.some(v => !v.size && v.color === col))
            list.push({ size: "", color: col, stock: "" });
        });
      }
      // Precarga: las filas nuevas nacen con el reparto del stock total.
      return { ...p, variants: distributeStockAcrossRows(list, p.stock, { onlyEmpty: true }) };
    });
  };

  const distributeEvenly = () => {
    const rows = (producto.variants || []).filter(isActiveVariantRow);
    if (!rows.length) {
      notify.warning("Agregá combinaciones primero");
      return;
    }
    if (parseVariantStock(producto.stock) <= 0) {
      notify.warning("Cargá el stock del producto para poder repartirlo");
      return;
    }
    const next = distributeStockAcrossRows(producto.variants || [], producto.stock);
    setProducto((prev) => ({ ...prev, variants: next }));
    notify.success(`Stock repartido entre ${rows.length} variante${rows.length === 1 ? "" : "s"}`);
  };

  const applyStockToAll = () => {
    const rows = (producto.variants || []).filter(isActiveVariantRow);
    if (!rows.length) {
      notify.warning("Agregá combinaciones primero");
      return;
    }
    if (String(bulkStock).trim() === "") {
      notify.warning("Escribí una cantidad para aplicar");
      return;
    }
    const stock = parseVariantStock(bulkStock);
    const next = (producto.variants || []).map((v) => (
      isActiveVariantRow(v) ? { ...v, stock: String(stock) } : v
    ));
    setProducto((prev) => ({ ...prev, variants: next }));
    setBulkStock("");
    notify.success(`Stock ${stock} aplicado a ${rows.length} variante${rows.length === 1 ? "" : "s"}`);
  };

  const incrementAllStock = () => {
    const rows = (producto.variants || []).filter(isActiveVariantRow);
    if (!rows.length) {
      notify.warning("Agregá combinaciones primero");
      return;
    }
    const next = (producto.variants || []).map((v) => (
      isActiveVariantRow(v) ? { ...v, stock: String(parseVariantStock(v.stock) + 1) } : v
    ));
    setProducto((prev) => ({ ...prev, variants: next }));
  };

  const copyStockToGroup = (index) => {
    const row = (producto.variants || [])[index];
    if (!row) return;
    const size = getVariantRowSize(row);
    const color = getVariantRowColor(row);
    if (!size && !color) {
      notify.warning("Completá el talle o el color de la fila");
      return;
    }
    const matches = (v) => (size ? getVariantRowSize(v) === size : getVariantRowColor(v) === color);
    const stock = parseVariantStock(row.stock);
    const next = (producto.variants || []).map((v) => (
      isActiveVariantRow(v) && matches(v) ? { ...v, stock: String(stock) } : v
    ));
    setProducto((prev) => ({ ...prev, variants: next }));
    notify.success(`Stock ${stock} aplicado a todo ${size ? `el talle ${size}` : `el color ${color}`}`);
  };

  const selectAllSizes = () => setSelSizes(SIZES);
  const clearSizes  = () => setSelSizes([]);
  const clearColors = () => setSelColors([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const toneCount = Number(producto.cantidadTonos) || 0;
    const boxUnits = Number(producto.unidadesPorCaja) || 0;
    const precioCaja = parseOptionalMoneyInput(producto.precioCaja);
    const precioMediaCaja = parseOptionalMoneyInput(producto.precioMediaCaja);
    const toneNames = (producto.tonosDisponibles || []).map((tone) => String(tone).trim()).filter(Boolean);
    if (producto.publicarEnCajas && boxUnits < 1) {
      notify.warning("Para publicar una caja indicá cuántas unidades trae.");
      return;
    }
    if (producto.publicarEnCajas && boxUnits > 1 && !(precioCaja > 0)) {
      notify.warning("Para publicar una caja indicá el precio del bloque completo.");
      return;
    }
    if (precioMediaCaja > 0 && (!producto.publicarEnCajas || boxUnits <= 1 || boxUnits % 2 !== 0 || !(precioCaja > 0))) {
      notify.warning("La media caja requiere una caja publicada, unidades pares y precio de caja.");
      return;
    }
    if (toneCount > 0 && boxUnits > 0 && toneCount > boxUnits) {
      notify.warning("La cantidad de tonos no puede superar las unidades de la caja.");
      return;
    }
    if (producto.modoTonos === "manual" && toneCount > 0 && (toneNames.length !== toneCount || new Set(toneNames.map((tone) => tone.toLowerCase())).size !== toneCount)) {
      notify.warning("Completá los nombres de tonos sin repetirlos.");
      return;
    }
    const scheduleError = validateScheduleRange(producto.nuevoDesde, producto.nuevoHasta)
      || validateScheduleRange(producto.destacadoDesde, producto.destacadoHasta);
    if (scheduleError) {
      notify.warning(scheduleError);
      return;
    }

    // El stock total se carga primero: las variantes no pueden sumar más que
    // ese total. Si se exceden, no se guarda y se reparte el total entre todas.
    const variantRows = (producto.variants || []).filter(isActiveVariantRow);
    const variantsStock = sumVariantStocks(variantRows);
    const totalStock = parseVariantStock(producto.stock);
    if (variantRows.length > 0 && variantsStock > totalStock) {
      const split = distributeStockEvenly(totalStock, variantRows.length);
      let splitIndex = 0;
      const redistributed = (producto.variants || []).map((v) => (
        isActiveVariantRow(v) ? { ...v, stock: String(split[splitIndex++]) } : v
      ));
      setProducto((prev) => ({ ...prev, variants: redistributed }));
      notify.warning(
        `El stock de las variantes (${variantsStock}) supera el stock total (${totalStock}). ` +
        `Se dividió automáticamente entre ${variantRows.length} variantes: ${split.join(" / ")}. ` +
        "Revisá y volvé a guardar."
      );
      return;
    }

    setSubmitting(true);
    try {
      const { urls: imagenes, failed, failures } = await uploadImages();
      if (failed > 0) {
        notify.error(
          `No se creó el producto porque ${failed} imagen${failed === 1 ? " no pudo" : "es no pudieron"} subirse. ` +
          `${failures.map(({ name, message }) => `${name}: ${message}`).join(" | ")} ` +
          "Revisá el archivo y volvé a intentar."
        );
        return;
      }

      const cleanVariants = (producto.variants || [])
        .filter(v => v.size || v.color)
        .map(v => ({
          size:  String(v.size  || "").trim(),
          color: String(v.color || "").trim(),
          stock: parseVariantStock(v.stock),
        }));

      const isLenceria = isLenceriaCategory(producto.categoria);
      const precioMayorista = parseOptionalMoneyInput(producto.precioMayorista);
      const precioMayorista2 = parseOptionalMoneyInput(producto.precioMayorista2);
      const precioMayorista3 = parseOptionalMoneyInput(producto.precioMayorista3);
      const precioMayorista4 = parseOptionalMoneyInput(producto.precioMayorista4);

      const body = {
        ...producto,
        imagenes,
        imagen: imagenes[0] || "",
        precio:          parseMoneyInput(producto.precio),
        precioX2:        parseOptionalMoneyInput(producto.precioX2),
        precioEspecial:  parseOptionalMoneyInput(producto.precioEspecial),
        precioMayorista,
        precioCaja,
        precioMediaCaja,
        stock:           Number(producto.stock) || 0,
        stockMinimo:     parseOptionalIntegerInput(producto.stockMinimo) ?? 5,
        categoria:    (producto.categoria    || "").toLowerCase(),
        subcategoria: (producto.subcategoria || "").toLowerCase(),
        variants: cleanVariants,
        unidadesPorCaja: parseOptionalIntegerInput(producto.unidadesPorCaja),
        minimoMayorista: parseOptionalIntegerInput(producto.minimoMayorista) ?? (precioMayorista != null ? (isLenceria ? 2 : 30000) : null),
        minimoMayorista2: parseOptionalIntegerInput(producto.minimoMayorista2) ?? (isLenceria && precioMayorista2 != null ? 6 : null),
        precioMayorista2,
        minimoMayorista3: parseOptionalIntegerInput(producto.minimoMayorista3) ?? (isLenceria && precioMayorista3 != null ? 12 : null),
        precioMayorista3,
        minimoMayorista4: parseOptionalIntegerInput(producto.minimoMayorista4) ?? (isLenceria && precioMayorista4 != null ? 4 : null),
        precioMayorista4,
        cantidadTonos:   parseOptionalIntegerInput(producto.cantidadTonos),
        modoTonos:       producto.modoTonos || "automatico",
        tonosDisponibles: producto.tonosDisponibles || [],
        publicarEnCajas: !!producto.publicarEnCajas,
        destacado: !!producto.destacado,
        destacadoDesde: toIsoOrNull(producto.destacadoDesde),
        destacadoHasta: toIsoOrNull(producto.destacadoHasta),
        nuevoActivo: !!producto.nuevoActivo,
        nuevoDesde: toIsoOrNull(producto.nuevoDesde),
        nuevoHasta: toIsoOrNull(producto.nuevoHasta),
        tags: syncNewArrivalTag(producto.tags, producto.nuevoActivo),
        syncToERP: !!producto.syncToERP,
      };

      const token = sessionStorage.getItem("aesthetic:token");
      await axios.post(`${API}/productos`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducto(PRODUCTO_INICIAL);
      setSelSizes([]);
      setSelColors([]);
      setImagenFiles([]);
      setPreviewUrls([]);
      if (onCreated) onCreated();
      notify.success("Producto creado correctamente");
      nav("/dashboard?tab=stock", { replace: true });
    } catch (err) {
      console.error(err?.response?.data || err);
      notify.error(err?.response?.data?.message || "Error al crear producto");
    } finally {
      setSubmitting(false);
    }
  };

  const nuevoSchedule = useMemo(() => ({
    activo: producto.nuevoActivo === true,
    desde: producto.nuevoDesde,
    hasta: producto.nuevoHasta,
  }), [producto.nuevoActivo, producto.nuevoDesde, producto.nuevoHasta]);

  const destacadoSchedule = useMemo(() => ({
    activo: producto.destacado === true,
    desde: producto.destacadoDesde,
    hasta: producto.destacadoHasta,
  }), [producto.destacado, producto.destacadoDesde, producto.destacadoHasta]);

  const [tierX2, tierX4, tierX6, tierX12] = getLenceriaPricePreview(producto);

  const variantRowsCount = (producto.variants || []).filter(isActiveVariantRow).length;
  const variantsStockSum = sumVariantStocks((producto.variants || []).filter(isActiveVariantRow));
  const totalStockParsed = parseVariantStock(producto.stock);
  const variantsStockExceeds = variantRowsCount > 0 && variantsStockSum > totalStockParsed;

  return (
    <form className="product-form" onSubmit={handleSubmit} noValidate>

      <header className="pf-header">
        <div>
          <h2 className="ui-page-title">Subir nuevo producto</h2>
          <p className="pf-sub">
            Cargá el nombre, precios, imagen y categoría.
            <span className="pf-muted"> Las variantes son solo talle/color. El stock es global.</span>
          </p>
        </div>
      </header>

      {/* ── Nombre y código ── */}
      <Field label="Nombre" required>
        <Input name="nombre" value={producto.nombre} onChange={handleChange} required />
      </Field>

      <Field label="Código interno" hint="Podés buscar productos por este código en el buscador">
        <Input name="codigoInterno" value={producto.codigoInterno || ""}
          onChange={handleChange} placeholder="Ej: AE0042" style={{ textTransform: "uppercase" }} />
      </Field>

      {/* ── BLOQUE DE PRECIOS ── */}
      <div className="pf-block">
        <div className="pf-block-header">
          <span className="pf-block-title">Sistema de precios</span>
          <span className="pf-block-hint">Dejá vacío si no aplica el nivel</span>
        </div>

        <div className="pf-precio-grid">
          <Field label={<><span className="price-tag price-tag--neutral">U</span> Precio Unitario</>}
            hint="Precio al elegir “por unidad” (aplica x5 y mayorista). Si queda vacío o en 0 no se muestra en la tienda.">
            <Input
              name="precio"
              type="text"
              inputMode="decimal"
              placeholder="Sin mínimo de compra"
              value={producto.precio}
              onChange={handleChange}
            />
          </Field>

          <Field label={<><span className="price-tag price-tag--gold">E</span> Precio Especial</>}
            hint="Llevando 5+ productos">
            <Input
              name="precioEspecial"
              type="text"
              inputMode="decimal"
              placeholder="Ej: 1200"
              value={producto.precioEspecial}
              onChange={handleChange}
            />
          </Field>

          {!isLenceriaCategory(producto.categoria) && (
            <>
              {isMarroquineriaCategory(producto.categoria) && (
                <Field label={<><span className="price-tag price-tag--info">x2</span> Precio x2 (mayorista marroquinería)</>}
                  hint="Aplica a toda la marroquinería (carteras, mochilas, bolsos, riñoneras): es el precio mayorista al llevar 2 artículos. Se publica también en la tienda.">
                  <Input name="precioX2" type="text" inputMode="decimal"
                    placeholder="Ej: 7500"
                    value={producto.precioX2 ?? ""} onChange={handleChange} />
                </Field>
              )}
              <Field label={<><span className="price-tag price-tag--info">M</span> Precio Mayorista</>}
                hint="Precio por unidad al alcanzar el mínimo">
                <Input name="precioMayorista" type="text" inputMode="decimal"
                  placeholder="Ej: 900"
                  value={producto.precioMayorista ?? ""} onChange={handleChange} />
              </Field>
              <Field label="Mínimo mayorista ($)"
                hint="Subtotal mínimo de compra para activar el precio mayorista">
                <Input name="minimoMayorista" type="number" min="0" step="1"
                  placeholder="30000"
                  value={producto.minimoMayorista ?? ""} onChange={handleChange} />
              </Field>
            </>
          )}

          {isLenceriaCategory(producto.categoria) && (
            <>
              <div className="ui-banner ui-banner--warning pf-full">
                Lencería: cargá el precio de 1 unidad. El panel calcula el total final multiplicando ese valor por la cantidad del pack (x2, x4, x6 o x12).
              </div>

              <Field label={<><span className="price-tag price-tag--info">x{producto.minimoMayorista || 2}</span> Mínimo x{producto.minimoMayorista || 2}</>}
                hint="Cantidad mínima del pack (2 para x2, 4 para x4)">
                <Input name="minimoMayorista" type="number" min="1" step="1"
                  placeholder="2"
                  value={producto.minimoMayorista ?? ""} onChange={handleChange} />
              </Field>

                <Field label={<><span className="price-tag price-tag--info">x{producto.minimoMayorista || 2}</span> Precio por unidad</>}
                  hint={`Este valor se multiplica automáticamente por ${producto.minimoMayorista || 2} unidades.`}>
                 <Input name="precioMayorista" type="text" inputMode="decimal"
                   placeholder="Ej: 900"
                   value={producto.precioMayorista ?? ""} onChange={handleChange}
                   onWheel={e => e.currentTarget.blur()} />
                 <span className="pf-price-preview">
                   Total calculado: <strong>{tierX2.totalPrice != null ? `$${formatARS(tierX2.unitPrice)} × ${tierX2.minimum} = $${formatARS(tierX2.totalPrice)}` : "Ingresá un precio unitario"}</strong>
                 </span>
               </Field>

              <Field label={<><span className="price-tag price-tag--info">x{producto.minimoMayorista4 || 4}</span> Mínimo x{producto.minimoMayorista4 || 4}</>}
                hint="Cantidad mínima del pack x4 (por defecto 4)">
                <Input name="minimoMayorista4" type="number" min="1" step="1"
                  placeholder="4"
                  value={producto.minimoMayorista4 ?? ""} onChange={handleChange} />
              </Field>

                <Field label={<><span className="price-tag price-tag--info">x{producto.minimoMayorista4 || 4}</span> Precio por unidad</>}
                  hint={`Este valor se multiplica automáticamente por ${producto.minimoMayorista4 || 4} unidades.`}>
                 <Input name="precioMayorista4" type="text" inputMode="decimal"
                   placeholder="Ej: 1600"
                   value={producto.precioMayorista4 ?? ""} onChange={handleChange}
                   onWheel={e => e.currentTarget.blur()} />
                 <span className="pf-price-preview">
                   Total calculado: <strong>{tierX4.totalPrice != null ? `$${formatARS(tierX4.unitPrice)} × ${tierX4.minimum} = $${formatARS(tierX4.totalPrice)}` : "Ingresá un precio unitario"}</strong>
                 </span>
               </Field>

              <Field label={<><span className="price-tag price-tag--success">x{producto.minimoMayorista2 || 6}</span> Mínimo x{producto.minimoMayorista2 || 6}</>}
                hint="Cantidad mínima del pack (ej: 6)">
                <Input name="minimoMayorista2" type="number" min="1" step="1"
                  placeholder="6"
                  value={producto.minimoMayorista2 ?? ""} onChange={handleChange} />
              </Field>

                <Field label={<><span className="price-tag price-tag--success">x{producto.minimoMayorista2 || 6}</span> Precio por unidad</>}
                  hint={`Este valor se multiplica automáticamente por ${producto.minimoMayorista2 || 6} unidades.`}>
                 <Input name="precioMayorista2" type="text" inputMode="decimal"
                   placeholder="Ej: 850"
                   value={producto.precioMayorista2 ?? ""} onChange={handleChange}
                   onWheel={e => e.currentTarget.blur()} />
                 <span className="pf-price-preview">
                   Total calculado: <strong>{tierX6.totalPrice != null ? `$${formatARS(tierX6.unitPrice)} × ${tierX6.minimum} = $${formatARS(tierX6.totalPrice)}` : "Ingresá un precio unitario"}</strong>
                 </span>
               </Field>

              <Field label={<><span className="price-tag price-tag--brand">x{producto.minimoMayorista3 || 12}</span> Mínimo x{producto.minimoMayorista3 || 12}</>}
                hint="Cantidad mínima del pack (ej: 12)">
                <Input name="minimoMayorista3" type="number" min="1" step="1"
                  placeholder="12"
                  value={producto.minimoMayorista3 ?? ""} onChange={handleChange} />
              </Field>

                <Field label={<><span className="price-tag price-tag--brand">x{producto.minimoMayorista3 || 12}</span> Precio por unidad</>}
                  hint={`Este valor se multiplica automáticamente por ${producto.minimoMayorista3 || 12} unidades.`}>
                 <Input name="precioMayorista3" type="text" inputMode="decimal"
                   placeholder="Ej: 800"
                   value={producto.precioMayorista3 ?? ""} onChange={handleChange}
                   onWheel={e => e.currentTarget.blur()} />
                 <span className="pf-price-preview">
                   Total calculado: <strong>{tierX12.totalPrice != null ? `$${formatARS(tierX12.unitPrice)} × ${tierX12.minimum} = $${formatARS(tierX12.totalPrice)}` : "Ingresá un precio unitario"}</strong>
                 </span>
               </Field>
            </>
          )}
        </div>
      </div>

      {/* ── Grid principal ── */}
      <div className="pf-grid">
        <div className="pf-col">
          <div className="pf-row">
            <Field label="Stock" required>
              <Input name="stock" type="number" min="0" step="1"
                value={producto.stock} onChange={handleChange} required />
            </Field>

            <Field label="Stock mínimo" hint="Al llegar a este valor se muestra en amarillo.">
              <Input name="stockMinimo" type="number" min="0" step="1"
                value={producto.stockMinimo} onChange={handleChange} required />
            </Field>

            <Field label="Unidades por caja" hint="El contador sumará de a este múltiplo. Vacío = unidad.">
              <Input name="unidadesPorCaja" type="number" min="1" step="1"
                placeholder="Ej: 8 (bases), 3 (labiales)"
                value={producto.unidadesPorCaja} onChange={handleChange} />
            </Field>

            {(producto.publicarEnCajas || Number(producto.unidadesPorCaja) > 1) && (
              <div className="pf-box-pricing">
                <Field label={<><span className="price-tag price-tag--brand">C</span> Precio por caja</>}
                  hint="Precio final por el bloque completo, no por unidad. Ej: $7.200 por caja de 8.">
                  <Input name="precioCaja" type="text" inputMode="decimal"
                    placeholder="Ej: 7200"
                    value={producto.precioCaja ?? ""} onChange={handleChange} />
                </Field>
                {Number(producto.unidadesPorCaja) > 1 && (
                  <Field label={<><span className="price-tag price-tag--brand">½</span> Precio por media caja</>}
                    hint="Precio total de la mitad de unidades. Si queda vacío, usa la mitad del precio de caja.">
                    <Input name="precioMediaCaja" type="text" inputMode="decimal"
                      placeholder="Ej: 3000"
                      value={producto.precioMediaCaja ?? ""} onChange={handleChange} />
                  </Field>
                )}
              </div>
            )}
          </div>

          {/* ── SELECTOR DE TONOS ── */}
          <div className="pf-block">
            <div className="pf-block-header">
              <span className="pf-block-title">Tonos del producto <span className="pf-muted pf-normal">(opcional)</span></span>
              <span className="pf-block-hint">Solo para productos con variantes de tono</span>
            </div>

            <div className="pf-tonos-grid">
              <Field label="Cantidad de tonos"
                hint="La distribución siempre es pareja (ej: 8 uds. ÷ 4 tonos = 2 c/u)">
                <Select name="cantidadTonos" value={producto.cantidadTonos}
                  onChange={e => {
                    const n = e.target.value === "" ? "" : Number(e.target.value);
                    const tonos = n ? Array.from({ length: n }, (_, i) => `Tono ${i + 1}`) : [];
                    setProducto(p => ({ ...p, cantidadTonos: n, tonosDisponibles: p.modoTonos === "automatico" ? tonos : p.tonosDisponibles.slice(0, n || 0) }));
                  }}>
                  <option value="">Sin tonos</option>
                   {TONE_COUNTS.map(n => <option key={n} value={n}>{n} tono{n > 1 ? "s" : ""}</option>)}
                </Select>
              </Field>

              {producto.cantidadTonos && (
                <Field label="Modo de tonos">
                  <Select name="modoTonos" value={producto.modoTonos}
                    onChange={e => {
                      const modo = e.target.value;
                      const n = Number(producto.cantidadTonos) || 0;
                      const tonos = modo === "automatico"
                        ? Array.from({ length: n }, (_, i) => `Tono ${i + 1}`)
                        : producto.tonosDisponibles;
                      setProducto(p => ({ ...p, modoTonos: modo, tonosDisponibles: tonos }));
                    }}>
                    <option value="automatico">Automático (Tono 1, 2, 3…)</option>
                    <option value="manual">Manual (nombrar cada tono)</option>
                  </Select>
                </Field>
              )}
            </div>

            {producto.cantidadTonos && producto.modoTonos === "manual" && (
              <div className="pf-tonos-nombres">
                {Array.from({ length: Number(producto.cantidadTonos) }, (_, i) => (
                  <Field key={i} label={`Tono ${i + 1}`}>
                    <Input
                      placeholder="Ej: Beige"
                      value={producto.tonosDisponibles[i] || ""}
                      onChange={e => {
                        const arr = [...(producto.tonosDisponibles || [])];
                        arr[i] = e.target.value;
                        setProducto(p => ({ ...p, tonosDisponibles: arr }));
                      }}
                    />
                  </Field>
                ))}
              </div>
            )}

            {producto.cantidadTonos && producto.unidadesPorCaja && (
              <div className="ui-banner ui-banner--success">
                ✓ {producto.unidadesPorCaja} unidades ÷ {producto.cantidadTonos} tonos = {Math.floor(producto.unidadesPorCaja / producto.cantidadTonos)} por tono
                {producto.unidadesPorCaja % producto.cantidadTonos > 0 && ` (+${producto.unidadesPorCaja % producto.cantidadTonos} extra)`}
              </div>
            )}
            {producto.publicarEnCajas && (
              <div className="ui-banner ui-banner--info pf-box-banner">
                Esta publicación aparecerá en <b>Packs / Cajas</b>. En la tienda el cliente elige{" "}
                <b>por unidad</b> (con x5 y mayorista según la escala), <b>caja completa</b> de {producto.unidadesPorCaja || "..."} unidades
                {Number(producto.unidadesPorCaja) > 1 && Number(producto.unidadesPorCaja) % 2 === 0 ? <> o <b>media caja</b></> : null}.
              </div>
            )}
          </div>

          <Field label="Descripción" required>
            <Textarea
              name="descripcion"
              value={producto.descripcion}
              onChange={handleChange}
              required
            />
          </Field>

          <div className="pf-row">
            <Field label="Categoría" required>
              <Select name="categoria" value={producto.categoria} onChange={handleChange} required>
                <option value="">Seleccionar categoría</option>
                {categoriasDB.map((cat) => (
                  <option key={cat._id || cat.slug} value={categorySlug(cat)}>{cat.nombre}</option>
                ))}
              </Select>
            </Field>

            {subcategorias.length > 0 && (
              <Field label="Subcategoría" required>
                <Select name="subcategoria" value={producto.subcategoria} onChange={handleChange} required>
                  <option value="">Seleccionar subcategoría</option>
                  {subcategorias.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub.charAt(0).toUpperCase() + sub.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {/* ── Variantes ── */}
          <div className="pf-block">
            <div className="pf-block-header">
              <span className="pf-block-title">Variantes (talle × color)</span>
              <span className="pf-block-hint">Opcional</span>
            </div>

            <div className="pf-choice-group">
              <span className="pf-choice-label">1) Elegí talles <span className="pf-muted">(opcional)</span></span>
              <div className="pf-choice-grid">
                {SIZES.map((s) => (
                  <button
                    type="button" key={s}
                    className={`pf-choice ${selSizes.includes(s) ? "active" : ""}`}
                    onClick={() => toggle(selSizes, setSelSizes, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="pf-choice-tools">
                <button type="button" className="pf-link" onClick={selectAllSizes}>Todos</button>
                <button type="button" className="pf-link" onClick={clearSizes}>Limpiar</button>
              </div>
            </div>

            <div className="pf-choice-group">
              <span className="pf-choice-label">2) Elegí colores <span className="pf-muted">(opcional)</span></span>
              <div className="pf-choice-grid">
                {COLORS.map((c) => (
                  <button
                    type="button" key={c}
                    className={`pf-choice ${selColors.includes(c) ? "active" : ""}`}
                    onClick={() => toggle(selColors, setSelColors, c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="pf-choice-tools">
                <button type="button" className="pf-link" onClick={clearColors}>Limpiar</button>
              </div>
            </div>

            <div className="pf-var-actions">
              <Button variant="secondary" onClick={addBulk} type="button">
                <PlusIcon size={15} /> Agregar combinaciones
              </Button>
              <Button variant="secondary" onClick={distributeEvenly} type="button">
                Repartir parejo
              </Button>
            </div>
            <p className="pf-hint">Se crearán todas las combinaciones Talle × Color (sin duplicados).</p>

            {(producto.variants || []).length === 0 ? (
              <p className="pf-muted">No agregaste variantes.</p>
            ) : (
              <div className="pf-var-table">
                <div className="pf-var-row pf-var-row--head">
                  <span>Talle</span>
                  <span>Color</span>
                  <span>Stock</span>
                  <span />
                </div>
                {(producto.variants || []).map((v, i) => (
                  <div className="pf-var-row" key={`${v.size}-${v.color}-${i}`}>
                    <Select value={v.size || ""} onChange={e => updateVariant(i, "size", e.target.value)}>
                      <option value="">Talle…</option>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    <Select value={v.color || ""} onChange={e => updateVariant(i, "color", e.target.value)}>
                      <option value="">Color…</option>
                      {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <div className="pf-var-stock">
                      <Input
                        type="number" min="0" step="1" inputMode="numeric"
                        value={v.stock ?? ""}
                        onChange={e => updateVariant(i, "stock", e.target.value)}
                        onFocus={e => e.target.select()}
                        style={{ width: 84, textAlign: "center" }}
                      />
                      <button
                        type="button"
                        className="pf-var-copy"
                        onClick={() => copyStockToGroup(i)}
                        title={v.size ? `Aplicar a todo el talle ${v.size}` : `Aplicar a todo el color ${v.color}`}
                        aria-label={v.size ? `Aplicar stock a todo el talle ${v.size}` : `Aplicar stock a todo el color ${v.color}`}
                      >
                        <CopyIcon size={13} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="pf-var-del"
                      onClick={() => removeVariant(i)}
                      aria-label="Eliminar variante"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {variantRowsCount > 0 && (
              <div className="pf-var-tools">
                <Input
                  type="number" min="0" step="1" inputMode="numeric"
                  placeholder="Cant."
                  value={bulkStock}
                  onChange={(e) => setBulkStock(e.target.value)}
                  style={{ width: 84, textAlign: "center" }}
                  aria-label="Cantidad de stock para todas las variantes"
                />
                <Button variant="secondary" type="button" onClick={applyStockToAll}>A todas</Button>
                <Button variant="secondary" type="button" onClick={incrementAllStock}>+1 a todas</Button>
              </div>
            )}

            {variantRowsCount > 0 && (
              variantsStockExceeds ? (
                <div className="ui-banner ui-banner--danger" style={{ marginTop: 10 }}>
                  ⚠ Las variantes suman {variantsStockSum} y el stock total es {totalStockParsed}.
                  No se guardará así: al guardar se divide el total entre las {variantRowsCount} variantes.
                </div>
              ) : (
                <p className="pf-hint">Stock de variantes: {variantsStockSum} de {totalStockParsed}.</p>
              )
            )}
          </div>
        </div>

        {/* ── Columna derecha ── */}
        <div className="pf-col pf-side">
          <Field label="Imagen" hint="Ctrl+click para seleccionar varias">
            <label className="pf-dropzone">
              <input type="file" accept="image/*" multiple onChange={handleImageChange} />
              {previewUrls.length > 0 ? (
                <div className="pf-previews">
                  {previewUrls.map((url, i) => (
                    <div className="pf-preview" key={i}>
                      <img src={url} alt={`Vista previa ${i + 1}`} />
                      <button
                        type="button"
                        className="pf-preview-x"
                        onClick={() => removeImage(i)}
                        aria-label="Quitar imagen"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pf-dz-empty">
                  <UploadIcon size={26} />
                  <div>Arrastrá una imagen o <u>hacé click</u></div>
                  <small className="pf-muted">JPG/PNG vertical · Recomendado 700×900 (4:5)</small>
                </div>
              )}
            </label>
          </Field>

          <div className="pf-switches">
            <ProductScheduleSwitch
              kind="destacado"
              value={destacadoSchedule}
              onConfigure={() => setScheduleModal("destacado")}
            />
            <label className="ui-check pf-box-toggle">
              <input
                type="checkbox"
                name="publicarEnCajas"
                checked={!!producto.publicarEnCajas}
                onChange={handleChange}
              />
              Publicar en <b className="pf-ni">Packs / Cajas</b>
              <span className="pf-muted" style={{ fontWeight: 400 }}>(incluye cajas de tonos)</span>
            </label>
            <ProductScheduleSwitch
              kind="nuevo"
              value={nuevoSchedule}
              onConfigure={() => setScheduleModal("nuevo")}
            />
            <label className="ui-check">
              <input
                type="checkbox"
                name="syncToERP"
                checked={!!producto.syncToERP}
                onChange={(e) => setProducto({ ...producto, syncToERP: e.target.checked })}
              />
              Publicar en <b className="pf-ni">ERP</b>
              <span className="pf-muted" style={{ fontWeight: 400 }}>(aparece en Santiago)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="pf-actions">
        <Button type="submit" size="lg" loading={submitting}>
          {submitting ? "Creando…" : "Crear producto"}
        </Button>
      </div>

      <ProductScheduleModal
        open={scheduleModal !== null}
        kind={scheduleModal || "nuevo"}
        value={scheduleModal === "destacado" ? destacadoSchedule : nuevoSchedule}
        productName={producto.nombre}
        onClose={() => setScheduleModal(null)}
        onSave={(next) => {
          if (scheduleModal === "destacado") {
            setProducto((prev) => ({
              ...prev,
              destacado: next.activo,
              destacadoDesde: next.desde,
              destacadoHasta: next.hasta,
            }));
          } else {
            setProducto((prev) => ({
              ...prev,
              nuevoActivo: next.activo,
              nuevoDesde: next.desde,
              nuevoHasta: next.hasta,
              tags: syncNewArrivalTag(prev.tags, next.activo),
            }));
          }
          setScheduleModal(null);
        }}
      />
    </form>
  );
}
