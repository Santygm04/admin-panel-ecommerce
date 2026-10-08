// ProductEdit.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { Button, Field, Input, Select, Textarea, Skeleton } from "./ui";
import { PlusIcon, UploadIcon, XIcon, CopyIcon } from "./ui/icons";
import ProductScheduleModal, { ProductScheduleSwitch } from "./ProductScheduleModal";
import "./ProductForm.css";
import { API_URL } from "../utils/api";
import { cloudinaryErrorMessage, uploadCloudinaryImage } from "../utils/cloudinary";
import { notify } from "../utils/toast";
import { formatARS, getLenceriaPricePreview, isLenceriaCategory, isMarroquineriaCategory, normalizeSlug, parseMoneyInput, parseOptionalIntegerInput, parseOptionalMoneyInput } from "../utils/pricing";
import { scheduleFromProduct, syncNewArrivalTag, toIsoOrNull, validateScheduleRange } from "../utils/schedule";
import { normalizeImageUrl } from "../utils/image";
import { distributeStockAcrossRows, distributeStockEvenly, getVariantRowColor, getVariantRowSize, isActiveVariantRow, parseVariantStock, sumVariantStocks } from "../utils/stockDistribution";
import useProductStockStream from "../hooks/useProductStockStream";

const SIZES  = ["XS","S","M","L","XL","XXL","XXXL","Único"];
const COLORS = ["negro","blanco","beige","nude","rojo","rosa","fucsia","azul","celeste","verde","lila","gris","marrón","multicolor"];
const TONE_COUNTS = Array.from({ length: 24 }, (_, i) => i + 1);

const API = `${API_URL}/api`;
const categorySlug = (category) => normalizeSlug(category?.slug || category?.nombre);
const REALTIME_PRICE_FIELDS = [
  "precio",
  "precioEspecial",
  "precioMayorista",
  "precioCaja",
  "precioMediaCaja",
  "minimoMayorista",
  "minimoMayorista2",
  "precioMayorista2",
  "minimoMayorista3",
  "precioMayorista3",
  "minimoMayorista4",
  "precioMayorista4",
  "unidadesPorCaja",
];

export default function EditProduct() {
  const { user } = useAuth();
  const isVendedor  = user?.role === "vendedor";
  const canEditCatalog = !isVendedor || user?.permissions?.crearProductos === true;
  const canEditStock = !isVendedor || user?.permissions?.editarStockSolo === true;
  const soloPrecios = isVendedor && canEditCatalog && !canEditStock;
  const soloStock   = isVendedor && !canEditCatalog && canEditStock;
  const { id }   = useParams();
  const nav      = useNavigate();

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [producto, setProducto]     = useState(null);
  const [imagenFiles, setImagenFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [scheduleModal, setScheduleModal] = useState(null);

  const [variantes, setVariantes] = useState([]);
  const [bulkStock, setBulkStock] = useState("");
  const [selSizes, setSelSizes]   = useState([]);
  const [selColors, setSelColors] = useState([]);

  const toggle = (arr, setArr, val) =>
    setArr((list) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]));

  const [categoriasDB, setCategoriasDB] = useState([]);

  useProductStockStream((event, eventType) => {
    const eventId = event?._id || event?.id;
    if (!eventId || String(eventId) !== String(id)) return;
    setProducto((current) => {
      if (!current) return current;
      const next = { ...current };
      if (event.stock !== undefined) next.stock = String(event.stock);
      if (eventType === "product:upsert") {
        for (const field of REALTIME_PRICE_FIELDS) {
          if (Object.hasOwn(event, field)) next[field] = event[field] != null ? String(event[field]) : "";
        }
        const incomingUnitSlug = event.erpUnitSlug ?? event.unitSlug;
        if (incomingUnitSlug !== undefined) next.erpUnitSlug = normalizeSlug(incomingUnitSlug);
        if (event.publicarEnCajas !== undefined) next.publicarEnCajas = event.publicarEnCajas === true;
      }
      return next;
    });
    if (Array.isArray(event.variants)) {
      setVariantes(event.variants.map((variant) => ({
        vid: String(variant.vid || variant.variantId || "").trim(),
        talle: String(variant.talle || variant.size || "").trim(),
        color: String(variant.color || "").trim(),
        stock: variant.stock ? String(variant.stock) : "",
        ...(variant.sku ? { sku: String(variant.sku).trim() } : {}),
      })));
    }
  });

  useEffect(() => {
    (async () => {
      try {
        const [resCats, resProd] = await Promise.all([
          axios.get(`${API}/categories`),
          axios.get(`${API}/productos/${id}`, {
            params: { admin: true },
            headers: { Authorization: `Bearer ${sessionStorage.getItem("aesthetic:token") || ""}` },
          }),
        ]);

        const cats = resCats.data?.categories || [];
        setCategoriasDB(cats);

        const p = resProd.data || {};
        const imagenes = [...new Set([
          ...(Array.isArray(p.imagenes) ? p.imagenes : []),
          p.imagen,
        ].map(normalizeImageUrl).filter(Boolean))];
        const destacadoSchedule = scheduleFromProduct(p, "destacado");
        const nuevoSchedule = scheduleFromProduct(p, "nuevo");
        setProducto({
          nombre:          p.nombre          || "",
          codigoInterno:   p.codigoInterno    || "",
          precio:          p.precio === 0 || p.precio ? String(p.precio) : "",
          precioX2:        p.precioX2        != null ? String(p.precioX2)        : "",
          precioEspecial:  p.precioEspecial  != null ? String(p.precioEspecial)  : "",
          erpUnitSlug:     normalizeSlug(p.erpUnitSlug || p.unitSlug),
          precioMayorista: p.precioMayorista != null ? String(p.precioMayorista) : "",
           precioCaja:      p.precioCaja      != null ? String(p.precioCaja)      : "",
           precioMediaCaja: p.precioMediaCaja != null ? String(p.precioMediaCaja) : "",
          descripcion:     p.descripcion     || "",
          categoria:       normalizeSlug(p.categoria),
          subcategoria:    p.subcategoria    || "",
          stock:           p.stock === 0 || p.stock ? String(p.stock) : "",
          stockMinimo:     p.stockMinimo === 0 || p.stockMinimo ? String(p.stockMinimo) : "5",
          destacado:       destacadoSchedule.activo,
          destacadoDesde:  destacadoSchedule.desde,
          destacadoHasta:  destacadoSchedule.hasta,
          nuevoActivo:     nuevoSchedule.activo,
          nuevoDesde:      nuevoSchedule.desde,
          nuevoHasta:      nuevoSchedule.hasta,
          imagen:          imagenes[0] || "",
          imagenes,
          tags:            Array.isArray(p.tags) ? p.tags : [],
          createdAt:       p.createdAt,
          unidadesPorCaja:  p.unidadesPorCaja  != null ? String(p.unidadesPorCaja)  : "",
          minimoMayorista:  p.minimoMayorista  != null ? String(p.minimoMayorista)  : "",
          minimoMayorista2: p.minimoMayorista2 != null ? String(p.minimoMayorista2) : "",
          precioMayorista2: p.precioMayorista2 != null ? String(p.precioMayorista2) : "",
          minimoMayorista3: p.minimoMayorista3 != null ? String(p.minimoMayorista3) : "",
          precioMayorista3: p.precioMayorista3 != null ? String(p.precioMayorista3) : "",
          minimoMayorista4: p.minimoMayorista4 != null ? String(p.minimoMayorista4) : "",
          precioMayorista4: p.precioMayorista4 != null ? String(p.precioMayorista4) : "",
          cantidadTonos:    p.cantidadTonos    != null ? String(p.cantidadTonos)    : "",
          modoTonos:        p.modoTonos || "automatico",
           tonosDisponibles: Array.isArray(p.tonosDisponibles) ? p.tonosDisponibles : [],
           publicarEnCajas: !!p.publicarEnCajas,
          syncToERP:        !!p.syncToERP,
        });

        const rawVars = Array.isArray(p.variantes) ? p.variantes
                      : Array.isArray(p.variants)  ? p.variants
                      : [];
        setVariantes(
          rawVars.map(v => ({
            vid:   String(v.vid ?? v.variantId ?? "").trim(),
            talle: String(v.talle ?? v.size ?? "").trim(),
            color: String(v.color ?? "").trim(),
            stock: v.stock ? String(v.stock) : "",
            ...(v.sku ? { sku: String(v.sku).trim() } : {}),
          }))
        );
      } catch (e) {
        notify.error("No se pudo cargar el producto");
        nav(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, nav]);

  const subcategorias = useMemo(() =>
    categoriasDB.find(c => categorySlug(c) === normalizeSlug(producto?.categoria))?.subcategorias || [],
    [categoriasDB, producto?.categoria]
  );

  const subcategoriaNormalizada = useMemo(() => {
    if (!producto?.subcategoria || !subcategorias.length) return producto?.subcategoria || "";
    const match = subcategorias.find(
      s => s.toLowerCase() === producto.subcategoria.toLowerCase()
    );
    return match || producto.subcategoria;
  }, [subcategorias, producto?.subcategoria]);

  const isPitukasMayorista = normalizeSlug(producto?.erpUnitSlug) === "pitukas-mayorista";

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setProducto(prev => ({ ...prev, [name]: checked }));
      return;
    }

    const numericOptional = ["precioX2", "precioEspecial", "precioMayorista", "precioCaja", "precioMediaCaja", "precioMayorista2", "unidadesPorCaja", "cantidadTonos", "minimoMayorista", "minimoMayorista2", "minimoMayorista3", "precioMayorista3", "minimoMayorista4", "precioMayorista4", "stockMinimo"];
    if (numericOptional.includes(name)) {
      setProducto(prev => ({ ...prev, [name]: value }));
      return;
    }

    setProducto(prev => {
      const base = { ...prev, [name]: value };
      if (name === "categoria" && value !== prev.categoria) {
        const wasLenceria = isLenceriaCategory(prev.categoria);
        const nextIsLenceria = isLenceriaCategory(value);
        base.subcategoria = "";
        const wasPitukasMayorista = normalizeSlug(prev.erpUnitSlug) === "pitukas-mayorista";
        base.minimoMayorista = nextIsLenceria
          ? (wasLenceria ? prev.minimoMayorista : "2")
          : (wasPitukasMayorista ? (prev.minimoMayorista || "2") : (wasLenceria ? "30000" : (prev.minimoMayorista || "30000")));
        base.minimoMayorista2 = nextIsLenceria ? (prev.minimoMayorista2 || "6") : "";
        base.minimoMayorista3 = nextIsLenceria ? (prev.minimoMayorista3 || "12") : "";
        base.minimoMayorista4 = nextIsLenceria ? (prev.minimoMayorista4 || "4") : "";
      }
      return base;
    });
  };

  const delVar = (i) => setVariantes(v => v.filter((_, idx) => idx !== i));
  const setVar = (i, key, val) => setVariantes(v => v.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  const addBulk = () => {
    if (!selSizes.length && !selColors.length) {
      notify.warning("Elegí al menos un talle o un color"); return;
    }
    setVariantes((list) => {
      const next = [...list];
      if (selSizes.length && selColors.length) {
        selSizes.forEach(sz => selColors.forEach(col => {
          if (!next.some(v => v.talle === sz && v.color === col))
            next.push({ talle: sz, color: col, stock: "" });
        }));
      } else if (selSizes.length) {
        selSizes.forEach(sz => {
          if (!next.some(v => v.talle === sz && !v.color))
            next.push({ talle: sz, color: "", stock: "" });
        });
      } else {
        selColors.forEach(col => {
          if (!next.some(v => !v.talle && v.color === col))
            next.push({ talle: "", color: col, stock: "" });
        });
      }
      // Precarga: las filas nuevas nacen con el reparto del stock total.
      return canEditStock
        ? distributeStockAcrossRows(next, producto?.stock, { onlyEmpty: true })
        : next;
    });
  };

  const distributeEvenly = () => {
    if (!canEditStock) return;
    const rows = variantes.filter(isActiveVariantRow);
    if (!rows.length) {
      notify.warning("Agregá combinaciones primero");
      return;
    }
    if (parseVariantStock(producto?.stock) <= 0) {
      notify.warning("Cargá el stock del producto para poder repartirlo");
      return;
    }
    setVariantes(distributeStockAcrossRows(variantes, producto?.stock));
    notify.success(`Stock repartido entre ${rows.length} variante${rows.length === 1 ? "" : "s"}`);
  };

  const applyStockToAll = () => {
    if (!canEditStock) return;
    const rows = variantes.filter(isActiveVariantRow);
    if (!rows.length) {
      notify.warning("Agregá combinaciones primero");
      return;
    }
    if (String(bulkStock).trim() === "") {
      notify.warning("Escribí una cantidad para aplicar");
      return;
    }
    const stock = parseVariantStock(bulkStock);
    setVariantes(variantes.map((v) => (
      isActiveVariantRow(v) ? { ...v, stock: String(stock) } : v
    )));
    setBulkStock("");
    notify.success(`Stock ${stock} aplicado a ${rows.length} variante${rows.length === 1 ? "" : "s"}`);
  };

  const incrementAllStock = () => {
    if (!canEditStock) return;
    const rows = variantes.filter(isActiveVariantRow);
    if (!rows.length) {
      notify.warning("Agregá combinaciones primero");
      return;
    }
    setVariantes(variantes.map((v) => (
      isActiveVariantRow(v) ? { ...v, stock: String(parseVariantStock(v.stock) + 1) } : v
    )));
  };

  const copyStockToGroup = (index) => {
    if (!canEditStock) return;
    const row = variantes[index];
    if (!row) return;
    const size = getVariantRowSize(row);
    const color = getVariantRowColor(row);
    if (!size && !color) {
      notify.warning("Completá el talle o el color de la fila");
      return;
    }
    const matches = (v) => (size ? getVariantRowSize(v) === size : getVariantRowColor(v) === color);
    const stock = parseVariantStock(row.stock);
    setVariantes(variantes.map((v) => (
      isActiveVariantRow(v) && matches(v) ? { ...v, stock: String(stock) } : v
    )));
    notify.success(`Stock ${stock} aplicado a todo ${size ? `el talle ${size}` : `el color ${color}`}`);
  };

  const handleImageChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setImagenFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
  };

  const removeImagenExistente = (url) => {
    setProducto(prev => {
      const nuevasImagenes = (prev.imagenes || []).filter(u => u !== url);
      return {
        ...prev,
        imagenes: nuevasImagenes,
        imagen: nuevasImagenes[0] || "",
      };
    });
  };

  const removeImagenNueva = (idx) => {
    setImagenFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadImagesIfNeeded = async () => {
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
    const variantRows = variantes.filter(isActiveVariantRow);
    const variantsStock = sumVariantStocks(variantRows);
    const totalStock = parseVariantStock(producto.stock);
    if (canEditStock && variantRows.length > 0 && variantsStock > totalStock) {
      const split = distributeStockEvenly(totalStock, variantRows.length);
      let splitIndex = 0;
      const redistributed = variantes.map((v) => (
        isActiveVariantRow(v) ? { ...v, stock: String(split[splitIndex++]) } : v
      ));
      setVariantes(redistributed);
      notify.warning(
        `El stock de las variantes (${variantsStock}) supera el stock total (${totalStock}). ` +
        `Se dividió automáticamente entre ${variantRows.length} variantes: ${split.join(" / ")}. ` +
        "Revisá y volvé a guardar."
      );
      return;
    }

    setSubmitting(true);
    try {
      const existentes = Array.isArray(producto.imagenes) ? [...producto.imagenes] : [];
      const { urls: nuevas, failed, failures } = await uploadImagesIfNeeded();
      if (failed > 0) {
        notify.error(
          `No se guardaron los cambios porque ${failed} imagen${failed === 1 ? " no pudo" : "es no pudieron"} subirse. ` +
          `${failures.map(({ name, message }) => `${name}: ${message}`).join(" | ")} ` +
          "Revisá el archivo y volvé a intentar."
        );
        return;
      }
      const imagenesActuales = [...new Set([...existentes, ...(nuevas || [])].filter(Boolean))].slice(0, 10);

      const isLenceria = isLenceriaCategory(producto.categoria);
      const precioMayorista = parseOptionalMoneyInput(producto.precioMayorista);
      const precioMayorista2 = parseOptionalMoneyInput(producto.precioMayorista2);
      const precioMayorista3 = parseOptionalMoneyInput(producto.precioMayorista3);
      const precioMayorista4 = parseOptionalMoneyInput(producto.precioMayorista4);

      const clean = variantes
        .map(v => ({
          ...(v.vid ? { vid: String(v.vid).trim() } : {}),
          size:  String(v.talle || "").trim(),
          color: String(v.color || "").trim(),
          stock: parseVariantStock(v.stock),
          ...(v.sku ? { sku: String(v.sku).trim() } : {}),
        }))
        .filter(v => v.size || v.color);

      const body = {
        nombre: producto.nombre,
        codigoInterno: (producto.codigoInterno || "").toUpperCase().trim(),
        precio: parseMoneyInput(producto.precio),
        precioX2: parseOptionalMoneyInput(producto.precioX2),
        precioEspecial:  parseOptionalMoneyInput(producto.precioEspecial),
        precioMayorista,
        precioCaja,
        precioMediaCaja,
        descripcion:     producto.descripcion,
        categoria:       (producto.categoria  || "").toLowerCase(),
        subcategoria:    (producto.subcategoria || "").toLowerCase(),
        stock:           parseOptionalIntegerInput(producto.stock) ?? 0,
        stockMinimo:     parseOptionalIntegerInput(producto.stockMinimo) ?? 5,
        imagenes: imagenesActuales,
        imagen: imagenesActuales[0] || "",
        variants:        clean,
        unidadesPorCaja: parseOptionalIntegerInput(producto.unidadesPorCaja),
        minimoMayorista:  parseOptionalIntegerInput(producto.minimoMayorista) ?? (precioMayorista != null ? (isLenceria || isPitukasMayorista ? 2 : 30000) : null),
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
        destacado:       !!producto.destacado,
        destacadoDesde:  toIsoOrNull(producto.destacadoDesde),
        destacadoHasta:  toIsoOrNull(producto.destacadoHasta),
        nuevoActivo:     !!producto.nuevoActivo,
        nuevoDesde:      toIsoOrNull(producto.nuevoDesde),
        nuevoHasta:      toIsoOrNull(producto.nuevoHasta),
        tags:            syncNewArrivalTag(producto.tags, producto.nuevoActivo),
        syncToERP: !!producto.syncToERP,
      };

      const payload = isVendedor && !soloStock
        ? {
            nombre: body.nombre,
            descripcion: body.descripcion,
            categoria: body.categoria,
            subcategoria: body.subcategoria,
            imagenes: body.imagenes,
            imagen: body.imagen,
            variants: body.variants,
            destacado: body.destacado,
            destacadoDesde: body.destacadoDesde,
            destacadoHasta: body.destacadoHasta,
            nuevoActivo: body.nuevoActivo,
            nuevoDesde: body.nuevoDesde,
            nuevoHasta: body.nuevoHasta,
            tags: body.tags,
            cantidadTonos: body.cantidadTonos,
            modoTonos: body.modoTonos,
            tonosDisponibles: body.tonosDisponibles,
            precio: body.precio,
            precioEspecial: body.precioEspecial,
             precioMayorista: body.precioMayorista,
             precioCaja: body.precioCaja,
             precioMediaCaja: body.precioMediaCaja,
            minimoMayorista: body.minimoMayorista,
            minimoMayorista2: body.minimoMayorista2,
            minimoMayorista3: body.minimoMayorista3,
            precioMayorista2: body.precioMayorista2,
            precioMayorista3: body.precioMayorista3,
            minimoMayorista4: body.minimoMayorista4,
            precioMayorista4: body.precioMayorista4,
            unidadesPorCaja: body.unidadesPorCaja,
            stockMinimo: body.stockMinimo,
            publicarEnCajas: body.publicarEnCajas,
            ...(canEditStock ? { stock: body.stock } : {}),
          }
        : soloStock
          ? {
            stock: body.stock,
            variants: body.variants,
          }
        : body;

      const token = sessionStorage.getItem("aesthetic:token");
      await axios.put(`${API}/productos/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      notify.success("Producto actualizado");
      nav(-1);
    } catch (err) {
      console.error(err);
      notify.error(err?.response?.data?.message || "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !producto) {
    return (
      <div className="product-form">
        <div className="pf-header">
          <div>
            <h2 className="ui-page-title">Editando producto</h2>
          </div>
        </div>
        <div className="ui-stack">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      </div>
    );
  }

  const nuevoSchedule = {
    activo: producto.nuevoActivo === true,
    desde: producto.nuevoDesde,
    hasta: producto.nuevoHasta,
  };
  const destacadoSchedule = {
    activo: producto.destacado === true,
    desde: producto.destacadoDesde,
    hasta: producto.destacadoHasta,
  };
  const [tierX2, tierX4, tierX6, tierX12] = getLenceriaPricePreview(producto);

  const variantRowsCount = variantes.filter(isActiveVariantRow).length;
  const variantsStockSum = sumVariantStocks(variantes.filter(isActiveVariantRow));
  const totalStockParsed = parseVariantStock(producto.stock);
  const variantsStockExceeds = variantRowsCount > 0 && variantsStockSum > totalStockParsed;

  return (
    <form className="product-form" onSubmit={handleSubmit} autoComplete="off">

      {(soloPrecios || soloStock) && (
        <div className="ui-banner ui-banner--info">
           {soloStock ? "Solo podés modificar el stock y el stock de sus variantes." : "Podés modificar el catálogo, pero no el stock."}
        </div>
      )}

      <header className="pf-header">
        <div>
          <h2 className="ui-page-title">Editar producto</h2>
          <p className="pf-sub">
            <span className="pf-muted">ID:</span> {id}
            {producto.createdAt && (
              <> · <span className="pf-muted">Creado:</span> {new Date(producto.createdAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
      </header>

      <Field label="Nombre" required>
        <Input name="nombre" value={producto.nombre} onChange={handleChange} required />
      </Field>

      <Field label="Código interno" hint="Podés buscar este producto por código">
        <Input
          name="codigoInterno"
          value={producto.codigoInterno || ""}
          onChange={handleChange}
          placeholder="Ej: AE0042"
          style={{ textTransform: "uppercase" }}
          disabled={isVendedor}
        />
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
            <Input name="precio" type="text" inputMode="decimal"
              value={producto.precio} onChange={handleChange} />
          </Field>

          <Field label={<><span className="price-tag price-tag--gold">E</span> Precio Especial</>}
            hint="Llevando 5+ productos">
            <Input name="precioEspecial" type="text" inputMode="decimal"
              placeholder="Ej: 1200"
              value={producto.precioEspecial ?? ""} onChange={handleChange} />
          </Field>

          {!isLenceriaCategory(producto.categoria) && (
            <>
              {!isPitukasMayorista && isMarroquineriaCategory(producto.categoria) && (
                <Field label={<><span className="price-tag price-tag--info">x2</span> Precio x2 (mayorista marroquinería)</>}
                  hint="Aplica a toda la marroquinería (carteras, mochilas, bolsos, riñoneras): es el precio mayorista al llevar 2 artículos. Se publica también en la tienda.">
                  <Input name="precioX2" type="text" inputMode="decimal"
                    placeholder="Ej: 7500"
                    value={producto.precioX2 ?? ""} onChange={handleChange} />
                </Field>
              )}
              <Field label={<><span className="price-tag price-tag--info">{isPitukasMayorista ? "x2" : "M"}</span> {isPitukasMayorista ? "Precio x2" : "Precio Mayorista"}</>}
                hint={isPitukasMayorista ? "Precio de la lista x2 de Pitukas Mayorista" : "Precio por unidad al alcanzar el mínimo"}>
                <Input name="precioMayorista" type="text" inputMode="decimal"
                  placeholder="Ej: 900"
                  value={producto.precioMayorista ?? ""} onChange={handleChange} />
              </Field>
              {isPitukasMayorista ? (
                <Field label="Mínimo x2" hint="La lista se aplica al llevar 2 unidades">
                  <Input value="2 unidades" readOnly />
                </Field>
              ) : (
                <Field label="Mínimo mayorista ($)"
                  hint="Subtotal mínimo de compra para activar el precio mayorista">
                  <Input name="minimoMayorista" type="number" min="0" step="1"
                    placeholder="30000"
                    value={producto.minimoMayorista ?? ""} onChange={handleChange}
                    disabled={isVendedor && !canEditCatalog} />
                </Field>
              )}
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
                  value={producto.minimoMayorista ?? ""} onChange={handleChange}
                   disabled={isVendedor && !canEditCatalog} />
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
                  value={producto.minimoMayorista4 ?? ""} onChange={handleChange}
                   disabled={isVendedor && !canEditCatalog} />
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
                  value={producto.minimoMayorista2 ?? ""} onChange={handleChange}
                   disabled={isVendedor && !canEditCatalog} />
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
                  value={producto.minimoMayorista3 ?? ""} onChange={handleChange}
                   disabled={isVendedor && !canEditCatalog} />
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

      {/* ── GRID PRINCIPAL ── */}
      <div className="pf-grid">
        <div className="pf-col">
          <div className="pf-row">
            <Field label="Stock" hint="Las variantes son solo talle/color.">
              <Input name="stock" type="number" inputMode="numeric" min="0" step="1"
                value={producto.stock} onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
                disabled={soloPrecios} />
            </Field>

            <Field label="Stock mínimo" hint="Al llegar a este valor se muestra en amarillo.">
              <Input name="stockMinimo" type="number" min="0" step="1"
                value={producto.stockMinimo} onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()}
                disabled={soloStock} />
            </Field>

            <Field label="Unidades por caja" hint="El contador suma de a múltiplos. Vacío = unidad.">
              <Input name="unidadesPorCaja" type="number" min="1" step="1"
                placeholder="Ej: 8 (bases), 3 (labiales)"
                value={producto.unidadesPorCaja ?? ""} onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()} />
            </Field>

            {(producto.publicarEnCajas || Number(producto.unidadesPorCaja) > 1) && (
              <div className="pf-box-pricing">
                <Field label={<><span className="price-tag price-tag--brand">C</span> Precio por caja</>}
                  hint="Precio final por el bloque completo, no por unidad. Ej: $7.200 por caja de 8.">
                  <Input name="precioCaja" type="text" inputMode="decimal"
                    placeholder="Ej: 7200"
                    value={producto.precioCaja ?? ""} onChange={handleChange}
                    onWheel={(e) => e.currentTarget.blur()} />
                </Field>
                {Number(producto.unidadesPorCaja) > 1 && (
                  <Field label={<><span className="price-tag price-tag--brand">½</span> Precio por media caja</>}
                    hint="Precio total de la mitad de unidades. Si queda vacío, usa la mitad del precio de caja.">
                    <Input name="precioMediaCaja" type="text" inputMode="decimal"
                      placeholder="Ej: 3000"
                      value={producto.precioMediaCaja ?? ""} onChange={handleChange}
                      onWheel={(e) => e.currentTarget.blur()} />
                  </Field>
                )}
              </div>
            )}
          </div>

          {/* ── TONOS ── */}
          <div className="pf-block">
            <div className="pf-block-header">
              <span className="pf-block-title">Tonos del producto <span className="pf-muted pf-normal">(opcional)</span></span>
              <span className="pf-block-hint">Solo para productos con variantes de tono</span>
            </div>
            <div className="pf-tonos-grid">
              <Field label="Cantidad de tonos" hint="Distribución siempre pareja">
                <Select value={producto.cantidadTonos ?? ""}
                  onChange={e => {
                    const n = e.target.value === "" ? "" : Number(e.target.value);
                    const tonos = n ? Array.from({ length: n }, (_, i) => `Tono ${i + 1}`) : [];
                    setProducto(p => ({ ...p, cantidadTonos: n, tonosDisponibles: p.modoTonos === "automatico" ? tonos : (p.tonosDisponibles || []).slice(0, n || 0) }));
                  }}>
                  <option value="">Sin tonos</option>
                   {TONE_COUNTS.map(n => <option key={n} value={n}>{n} tono{n > 1 ? "s" : ""}</option>)}
                </Select>
              </Field>

              {producto.cantidadTonos && (
                <Field label="Modo">
                  <Select value={producto.modoTonos || "automatico"}
                    onChange={e => {
                      const modo = e.target.value;
                      const n = Number(producto.cantidadTonos) || 0;
                      const tonos = modo === "automatico"
                        ? Array.from({ length: n }, (_, i) => `Tono ${i + 1}`)
                        : (producto.tonosDisponibles || []);
                      setProducto(p => ({ ...p, modoTonos: modo, tonosDisponibles: tonos }));
                    }}>
                    <option value="automatico">Automático</option>
                    <option value="manual">Manual</option>
                  </Select>
                </Field>
              )}
            </div>

            {producto.cantidadTonos && producto.modoTonos === "manual" && (
              <div className="pf-tonos-nombres">
                {Array.from({ length: Number(producto.cantidadTonos) }, (_, i) => (
                  <Field key={i} label={`Tono ${i + 1}`}>
                    <Input placeholder="Ej: Beige"
                      value={(producto.tonosDisponibles || [])[i] || ""}
                      onChange={e => {
                        const arr = [...(producto.tonosDisponibles || [])];
                        arr[i] = e.target.value;
                        setProducto(p => ({ ...p, tonosDisponibles: arr }));
                      }} />
                  </Field>
                ))}
              </div>
            )}

            {producto.cantidadTonos && producto.unidadesPorCaja && (
              <div className="ui-banner ui-banner--success">
                ✓ {producto.unidadesPorCaja} uds. ÷ {producto.cantidadTonos} tonos = {Math.floor(producto.unidadesPorCaja / producto.cantidadTonos)} por tono
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
            <Textarea name="descripcion" value={producto.descripcion} onChange={handleChange} required />
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

            <Field label="Subcategoría">
              <Select
                key={`subcat-${subcategorias.length}-${subcategoriaNormalizada}`}
                name="subcategoria"
                value={subcategoriaNormalizada}
                onChange={handleChange}
              >
                <option value="">Seleccionar subcategoría</option>
                {subcategorias.map((sub) => (
                  <option key={sub} value={sub}>{sub.charAt(0).toUpperCase() + sub.slice(1)}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* ── VARIANTES ── */}
          <div className="pf-block">
            <div className="pf-block-header">
              <span className="pf-block-title">Variantes (talle × color)</span>
              <span className="pf-block-hint">Opcional</span>
            </div>

            <div className="pf-choice-group">
              <span className="pf-choice-label">1) Elegí talles</span>
              <div className="pf-choice-grid">
                {SIZES.map((s) => (
                  <button type="button" key={s}
                    className={`pf-choice ${selSizes.includes(s) ? "active" : ""}`}
                    onClick={() => toggle(selSizes, setSelSizes, s)}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="pf-choice-tools">
                <button type="button" className="pf-link" onClick={() => setSelSizes(SIZES)}>Todos</button>
                <button type="button" className="pf-link" onClick={() => setSelSizes([])}>Limpiar</button>
              </div>
            </div>

            <div className="pf-choice-group">
              <span className="pf-choice-label">2) Elegí colores</span>
              <div className="pf-choice-grid">
                {COLORS.map((c) => (
                  <button type="button" key={c}
                    className={`pf-choice ${selColors.includes(c) ? "active" : ""}`}
                    onClick={() => toggle(selColors, setSelColors, c)}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="pf-choice-tools">
                <button type="button" className="pf-link" onClick={() => setSelColors([])}>Limpiar</button>
              </div>
            </div>

            <div className="pf-var-actions">
              <Button variant="secondary" onClick={addBulk} type="button">
                <PlusIcon size={15} /> Agregar combinaciones
              </Button>
              {canEditStock && (
                <Button variant="secondary" onClick={distributeEvenly} type="button">
                  Repartir parejo
                </Button>
              )}
            </div>
            <p className="pf-hint">
              Se crearán todas las combinaciones Talle × Color seleccionadas (sin duplicados).
            </p>

            {variantes.length === 0 ? (
              <p className="pf-muted">No agregaste variantes.</p>
            ) : (
              <div className="pf-var-table">
                <div className="pf-var-row pf-var-row--head">
                  <span>Talle</span>
                  <span>Color</span>
                  <span>Stock</span>
                  <span />
                </div>
                {variantes.map((v, i) => (
                  <div className="pf-var-row" key={`${v.talle}-${v.color}-${i}`}>
                    <Select value={v.talle || ""} onChange={(e) => setVar(i, "talle", e.target.value)}>
                      <option value="">Talle…</option>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    <Select value={v.color || ""} onChange={(e) => setVar(i, "color", e.target.value)}>
                      <option value="">Color…</option>
                      {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <div className="pf-var-stock">
                      <Input
                        type="number" min="0" step="1" inputMode="numeric"
                         value={v.stock ?? ""}
                         onChange={e => setVar(i, "stock", e.target.value)}
                         onFocus={e => e.target.select()}
                         disabled={!canEditStock}
                         style={{ width: 84, textAlign: "center" }}
                      />
                      {canEditStock && (
                        <button
                          type="button"
                          className="pf-var-copy"
                          onClick={() => copyStockToGroup(i)}
                          title={v.talle ? `Aplicar a todo el talle ${v.talle}` : `Aplicar a todo el color ${v.color}`}
                          aria-label={v.talle ? `Aplicar stock a todo el talle ${v.talle}` : `Aplicar stock a todo el color ${v.color}`}
                        >
                          <CopyIcon size={13} />
                        </button>
                      )}
                    </div>
                    <button type="button" className="pf-var-del" onClick={() => delVar(i)} aria-label="Eliminar variante">
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {canEditStock && variantRowsCount > 0 && (
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

            {canEditStock && variantRowsCount > 0 && (
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
              {(previewUrls.length > 0 || producto.imagenes?.length > 0 || producto.imagen) ? (
                <div className="pf-previews">
                  {previewUrls.length === 0 && [...new Set((producto.imagenes?.length > 0 ? producto.imagenes : [producto.imagen]).filter(Boolean))].map((url, i) => (
                    <div className="pf-preview" key={i}>
                       <img src={normalizeImageUrl(url)} alt={`Imagen ${i + 1}`} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
                      <button type="button" className="pf-preview-x" onClick={() => removeImagenExistente(url)}
                        aria-label="Quitar imagen existente">
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                  {previewUrls.map((url, i) => (
                    <div className="pf-preview" key={`nueva-${i}`}>
                      <img src={url} alt={`Nueva ${i + 1}`} />
                      <button type="button" className="pf-preview-x" onClick={() => removeImagenNueva(i)}
                        aria-label="Quitar imagen nueva">
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
            {!isVendedor && (
              <label className="ui-check pf-box-toggle">
                <input type="checkbox" name="publicarEnCajas" checked={!!producto.publicarEnCajas} onChange={handleChange} />
                Publicar en <b className="pf-ni">Packs / Cajas</b>
                <span className="pf-muted" style={{ fontWeight: 400 }}>(incluye cajas de tonos)</span>
              </label>
            )}

            <ProductScheduleSwitch
              kind="nuevo"
              value={nuevoSchedule}
              onConfigure={() => setScheduleModal("nuevo")}
            />

            <label className="ui-check">
              <input type="checkbox" name="syncToERP"
                checked={!!producto.syncToERP}
                onChange={(e) => setProducto({ ...producto, syncToERP: e.target.checked })} />
              Publicar en <b className="pf-ni">ERP</b>
              <span className="pf-muted" style={{ fontWeight: 400 }}>(aparece en Santiago)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="pf-actions">
        <Button variant="secondary" onClick={() => nav(-1)} type="button">Cancelar</Button>
        <Button type="submit" loading={submitting}>
          {submitting ? "Guardando…" : "Guardar cambios"}
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
