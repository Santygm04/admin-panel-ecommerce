// ProductEdit.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import { Button, Field, Input, Select, Textarea, Skeleton } from "./ui";
import { PlusIcon, UploadIcon, XIcon } from "./ui/icons";
import "./ProductForm.css";

const SIZES  = ["XS","S","M","L","XL","XXL","XXXL","Único"];
const COLORS = ["negro","blanco","beige","nude","rojo","rosa","fucsia","azul","celeste","verde","lila","gris","marrón","multicolor"];

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API = API_BASE ? `${API_BASE}/api` : "/api";

export default function EditProduct() {
  const { user } = useAuth();
  const isVendedor  = user?.role === "vendedor";
  const soloPrecios = isVendedor && !user?.permissions?.editarStockSolo;
  const soloStock   = isVendedor && !!user?.permissions?.editarStockSolo;
  const { id }   = useParams();
  const nav      = useNavigate();

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [producto, setProducto]     = useState(null);
  const [imagenFiles, setImagenFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [variantes, setVariantes] = useState([]);
  const [selSizes, setSelSizes]   = useState([]);
  const [selColors, setSelColors] = useState([]);

  const toggle = (arr, setArr, val) =>
    setArr((list) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]));

  const [categoriasDB, setCategoriasDB] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [resCats, resProd] = await Promise.all([
          axios.get(`${API}/categories`),
          axios.get(`${API}/productos/${id}`, {
            params: { admin: true },
            headers: { Authorization: `Bearer ${localStorage.getItem("aesthetic:token")}` },
          }),
        ]);

        const cats = resCats.data?.categories || [];
        setCategoriasDB(cats);

        const p = resProd.data || {};
        setProducto({
          nombre:          p.nombre          || "",
          codigoInterno:   p.codigoInterno    || "",
          precio:          p.precio === 0 || p.precio ? String(p.precio) : "",
          precioEspecial:  p.precioEspecial  != null ? String(p.precioEspecial)  : "",
          precioMayorista: p.precioMayorista != null ? String(p.precioMayorista) : "",
          descripcion:     p.descripcion     || "",
          categoria:       p.categoria       || "",
          subcategoria:    p.subcategoria    || "",
          stock:           p.stock === 0 || p.stock ? String(p.stock) : "",
          destacado:       !!p.destacado,
          imagen:          p.imagen          || "",
          imagenes:        Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : (p.imagen ? [p.imagen] : []),
          tags:            Array.isArray(p.tags) ? p.tags : [],
          createdAt:       p.createdAt,
          unidadesPorCaja:  p.unidadesPorCaja  != null ? String(p.unidadesPorCaja)  : "",
          minimoMayorista:  p.minimoMayorista  != null ? String(p.minimoMayorista)  : "",
          minimoMayorista2: p.minimoMayorista2 != null ? String(p.minimoMayorista2) : "",
          precioMayorista2: p.precioMayorista2 != null ? String(p.precioMayorista2) : "",
          minimoMayorista3: p.minimoMayorista3 != null ? String(p.minimoMayorista3) : "",
          precioMayorista3: p.precioMayorista3 != null ? String(p.precioMayorista3) : "",
          cantidadTonos:    p.cantidadTonos    != null ? String(p.cantidadTonos)    : "",
          modoTonos:        p.modoTonos || "automatico",
          tonosDisponibles: Array.isArray(p.tonosDisponibles) ? p.tonosDisponibles : [],
          syncToERP:        !!p.syncToERP,
        });

        const rawVars = Array.isArray(p.variantes) ? p.variantes
                      : Array.isArray(p.variants)  ? p.variants
                      : [];
        setVariantes(
          rawVars.map(v => ({
            talle: String(v.talle ?? v.size ?? "").trim(),
            color: String(v.color ?? "").trim(),
            stock: Number(v.stock ?? 0),
          }))
        );
      } catch (e) {
        toast.error("No se pudo cargar el producto");
        nav(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, nav]);

  const subcategorias = useMemo(() =>
    categoriasDB.find(c => c.slug === producto?.categoria)?.subcategorias || [],
    [categoriasDB, producto?.categoria]
  );

  const subcategoriaNormalizada = useMemo(() => {
    if (!producto?.subcategoria || !subcategorias.length) return producto?.subcategoria || "";
    const match = subcategorias.find(
      s => s.toLowerCase() === producto.subcategoria.toLowerCase()
    );
    return match || producto.subcategoria;
  }, [subcategorias, producto?.subcategoria]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "isNuevoIngreso") {
      setProducto(prev => {
        const set = new Set(prev.tags || []);
        if (checked) set.add("nuevos-ingresos");
        else set.delete("nuevos-ingresos");
        return { ...prev, tags: Array.from(set) };
      });
      return;
    }

    if (type === "checkbox") {
      setProducto(prev => ({ ...prev, [name]: checked }));
      return;
    }

    const numericOptional = ["precioEspecial", "precioMayorista", "precioMayorista2", "unidadesPorCaja", "cantidadTonos", "minimoMayorista", "minimoMayorista2", "minimoMayorista3", "precioMayorista3"];
    if (numericOptional.includes(name)) {
      setProducto(prev => ({ ...prev, [name]: value }));
      return;
    }

    setProducto(prev => {
      const base = { ...prev, [name]: value };
      if (name === "categoria" && value !== prev.categoria) base.subcategoria = "";
      return base;
    });
  };

  const delVar = (i) => setVariantes(v => v.filter((_, idx) => idx !== i));
  const setVar = (i, key, val) => setVariantes(v => v.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  const addBulk = () => {
    if (!selSizes.length && !selColors.length) {
      toast.warn("Elegí al menos un talle o un color"); return;
    }
    setVariantes((list) => {
      const next = [...list];
      if (selSizes.length && selColors.length) {
        selSizes.forEach(sz => selColors.forEach(col => {
          if (!next.some(v => v.talle === sz && v.color === col))
            next.push({ talle: sz, color: col, stock: 0 });
        }));
      } else if (selSizes.length) {
        selSizes.forEach(sz => {
          if (!next.some(v => v.talle === sz && !v.color))
            next.push({ talle: sz, color: "", stock: 0 });
        });
      } else {
        selColors.forEach(col => {
          if (!next.some(v => !v.talle && v.color === col))
            next.push({ talle: "", color: col });
        });
      }
      return next;
    });
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
    // Sube cada imagen por separado: si Cloudinary falla (upload preset
    // inexistente → 401), la edición continúa sin esas imágenes.
    const results = await Promise.allSettled(imagenFiles.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "aesthetic");
      formData.append("folder", "productos");
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dl2vebaou"}/image/upload`,
        formData
      );
      return res.data.secure_url;
    }));
    const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failed = results.filter((r) => r.status === "rejected").length;
    return { urls, failed };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const existentes = Array.isArray(producto.imagenes) ? [...producto.imagenes] : [];
      const { urls: nuevas, failed } = await uploadImagesIfNeeded();
      if (failed > 0) {
        toast.warn(
          `${failed} imagen(es) no se pudieron subir a Cloudinary (preset "aesthetic" no autorizado). ` +
          'Se guarda el resto de los cambios.'
        );
      }
      const imagenesActuales = [...new Set([...existentes, ...(nuevas || [])].filter(Boolean))].slice(0, 10);

      const safeNum = (s) => {
        const str = String(s).trim().replace(",", ".");
        const n = parseFloat(str);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
      };
      const safeInt = safeNum;

      const clean = variantes
        .map(v => ({
          size:  String(v.talle || "").trim(),
          color: String(v.color || "").trim(),
          stock: Number(v.stock ?? 0),
        }))
        .filter(v => v.size || v.color);

      const body = {
        nombre: producto.nombre,
        codigoInterno: (producto.codigoInterno || "").toUpperCase().trim(),
        precio: safeInt(producto.precio),
        precioEspecial:  producto.precioEspecial  !== "" ? safeInt(producto.precioEspecial)  : null,
        precioMayorista: producto.precioMayorista !== "" ? safeInt(producto.precioMayorista) : null,
        descripcion:     producto.descripcion,
        categoria:       (producto.categoria  || "").toLowerCase(),
        subcategoria:    (producto.subcategoria || "").toLowerCase(),
        stock:           safeInt(producto.stock),
        destacado:       !!producto.destacado,
        tags:            producto.tags || [],
        imagenes: imagenesActuales,
        variants:        clean,
        unidadesPorCaja: producto.unidadesPorCaja !== "" ? safeInt(producto.unidadesPorCaja) : null,
        minimoMayorista:  producto.minimoMayorista  !== "" ? safeInt(producto.minimoMayorista)  : null,
        minimoMayorista2: producto.minimoMayorista2 !== "" ? safeInt(producto.minimoMayorista2) : null,
        precioMayorista2: producto.precioMayorista2 !== "" ? safeInt(producto.precioMayorista2) : null,
        minimoMayorista3: producto.minimoMayorista3 !== "" ? Number(producto.minimoMayorista3) : null,
        precioMayorista3: producto.precioMayorista3 !== "" ? Number(producto.precioMayorista3) : null,
        cantidadTonos:   producto.cantidadTonos   !== "" ? safeInt(producto.cantidadTonos)   : null,
        modoTonos:       producto.modoTonos || "automatico",
        tonosDisponibles: producto.tonosDisponibles || [],
        syncToERP: !!producto.syncToERP,
      };

      const payload = isVendedor
        ? {
            nombre: body.nombre,
            descripcion: body.descripcion,
            categoria: body.categoria,
            subcategoria: body.subcategoria,
            imagenes: body.imagenes,
            variants: body.variants,
            destacado: body.destacado,
            tags: body.tags,
            cantidadTonos: body.cantidadTonos,
            modoTonos: body.modoTonos,
            tonosDisponibles: body.tonosDisponibles,
            precio: body.precio,
            precioEspecial: body.precioEspecial,
            precioMayorista: body.precioMayorista,
            precioMayorista2: body.precioMayorista2,
            precioMayorista3: body.precioMayorista3,
          }
        : soloStock
        ? {
            precio: body.precio,
            precioEspecial: body.precioEspecial,
            precioMayorista: body.precioMayorista,
            precioMayorista2: body.precioMayorista2,
            precioMayorista3: body.precioMayorista3,
            minimoMayorista: body.minimoMayorista,
            minimoMayorista2: body.minimoMayorista2,
            minimoMayorista3: body.minimoMayorista3,
            stock: body.stock,
            variants: body.variants,
          }
        : body;

      const token = localStorage.getItem("aesthetic:token");
      await axios.put(`${API}/productos/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Producto actualizado");
      nav(-1);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Error al actualizar");
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

  const isNuevoIngreso = (producto.tags || []).includes("nuevos-ingresos");

  return (
    <form className="product-form" onSubmit={handleSubmit} autoComplete="off">

      {soloPrecios && (
        <div className="ui-banner ui-banner--info">
          Solo podés modificar los precios del producto.
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
          <Field label={<><span className="price-tag price-tag--neutral">U</span> Precio Unitario <span className="pf-req">*</span></>}
            hint="Sin mínimo de compra">
            <Input name="precio" type="text" inputMode="decimal"
              value={producto.precio} onChange={handleChange}
              required={producto.categoria !== "lenceria"} />
          </Field>

          <Field label={<><span className="price-tag price-tag--gold">E</span> Precio Especial</>}
            hint="Llevando 5+ productos">
            <Input name="precioEspecial" type="text" inputMode="decimal"
              placeholder="Ej: 1200"
              value={producto.precioEspecial ?? ""} onChange={handleChange} />
          </Field>

          {producto.categoria !== "lenceria" && (
            <>
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
                  value={producto.minimoMayorista ?? ""} onChange={handleChange}
                  disabled={isVendedor} />
              </Field>
            </>
          )}

          {producto.categoria === "lenceria" && (
            <>
              <div className="ui-banner ui-banner--warning pf-full">
                Lencería: cargá el precio total de cada pack. El precio por unidad se calcula automáticamente.
              </div>

              <Field label={<><span className="price-tag price-tag--info">x2</span> Mínimo x2</>}
                hint="Cantidad mínima (ej: 2)">
                <Input name="minimoMayorista" type="number" min="1" step="1"
                  placeholder="2"
                  value={producto.minimoMayorista ?? ""} onChange={handleChange}
                  disabled={isVendedor} />
              </Field>

              <Field label={<><span className="price-tag price-tag--info">x2$</span> Precio total x2</>}
                hint={`Total por ${producto.minimoMayorista || 2} unidades`}>
                <Input name="precioMayorista" type="number" min="0" step="0.01"
                  placeholder="Ej: 1800"
                  value={producto.precioMayorista ?? ""} onChange={handleChange}
                  onWheel={e => e.currentTarget.blur()} />
              </Field>

              <Field label={<><span className="price-tag price-tag--success">x6</span> Mínimo x6</>}
                hint="Cantidad mínima (ej: 6)">
                <Input name="minimoMayorista2" type="number" min="1" step="1"
                  placeholder="6"
                  value={producto.minimoMayorista2 ?? ""} onChange={handleChange}
                  disabled={isVendedor} />
              </Field>

              <Field label={<><span className="price-tag price-tag--success">x6$</span> Precio total x6</>}
                hint={`Total por ${producto.minimoMayorista2 || 6} unidades`}>
                <Input name="precioMayorista2" type="number" min="0" step="0.01"
                  placeholder="Ej: 5400"
                  value={producto.precioMayorista2 ?? ""} onChange={handleChange}
                  onWheel={e => e.currentTarget.blur()} />
              </Field>

              <Field label={<><span className="price-tag price-tag--brand">x12</span> Mínimo x12</>}
                hint="Cantidad mínima (ej: 12)">
                <Input name="minimoMayorista3" type="number" min="1" step="1"
                  placeholder="12"
                  value={producto.minimoMayorista3 ?? ""} onChange={handleChange}
                  disabled={isVendedor} />
              </Field>

              <Field label={<><span className="price-tag price-tag--brand">x12$</span> Precio total x12</>}
                hint={`Total por ${producto.minimoMayorista3 || 12} unidades`}>
                <Input name="precioMayorista3" type="number" min="0" step="0.01"
                  placeholder="Ej: 9600"
                  value={producto.precioMayorista3 ?? ""} onChange={handleChange}
                  onWheel={e => e.currentTarget.blur()} />
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
                disabled={isVendedor} />
            </Field>

            <Field label="Unidades por caja" hint="El contador suma de a múltiplos. Vacío = unidad.">
              <Input name="unidadesPorCaja" type="number" min="1" step="1"
                placeholder="Ej: 8 (bases), 3 (labiales)"
                value={producto.unidadesPorCaja ?? ""} onChange={handleChange}
                onWheel={(e) => e.currentTarget.blur()} />
            </Field>
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
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} tono{n > 1 ? "s" : ""}</option>)}
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
          </div>

          <Field label="Descripción" required>
            <Textarea name="descripcion" value={producto.descripcion} onChange={handleChange} required />
          </Field>

          <div className="pf-row">
            <Field label="Categoría" required>
              <Select name="categoria" value={producto.categoria} onChange={handleChange} required>
                <option value="">Seleccionar categoría</option>
                {categoriasDB.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>{cat.nombre}</option>
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

            <Button variant="secondary" onClick={addBulk} type="button">
              <PlusIcon size={15} /> Agregar combinaciones
            </Button>
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
                    <Input
                      type="number" min="0" step="1"
                      value={v.stock ?? 0}
                      onChange={e => setVar(i, "stock", Number(e.target.value) || 0)}
                      style={{ width: 84, textAlign: "center" }}
                    />
                    <button type="button" className="pf-var-del" onClick={() => delVar(i)} aria-label="Eliminar variante">
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
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
                      <img src={url} alt={`Imagen ${i + 1}`} />
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
            <label className="ui-check">
              <input type="checkbox" name="destacado"
                checked={!!producto.destacado}
                onChange={(e) => setProducto({ ...producto, destacado: e.target.checked })} />
              Producto destacado
            </label>

            <label className="ui-check">
              <input type="checkbox" name="isNuevoIngreso"
                checked={isNuevoIngreso} onChange={handleChange} />
              Mostrar en <b className="pf-ni">Nuevos ingresos</b>
            </label>

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
    </form>
  );
}
