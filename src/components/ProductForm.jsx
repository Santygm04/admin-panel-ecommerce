// ProductForm.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { PlusIcon, UploadIcon, XIcon } from "./ui/icons";
import "./ProductForm.css";
import { API_URL } from "../utils/api";
import { cloudinaryErrorMessage, uploadCloudinaryImage } from "../utils/cloudinary";

// Subcategorías con precio unitario "desde 2 unidades"
const SUBCAT_DESDE_2 = ["vedetinas", "colales", "boxer", "slip", "niña"];
// Subcategorías con precio x2 y x6
const SUBCAT_MEDIAS  = ["medias"];

// Devuelve el mínimo sugerido según subcategoría
const getMinimoSugerido = (subcat) => {
  if (SUBCAT_DESDE_2.includes(subcat)) return 2;
  if (SUBCAT_MEDIAS.includes(subcat))  return 2; // también tiene x6
  return null;
};

const SIZES  = ["XS","S","M","L","XL","XXL","XXXL","Único"];
const COLORS = ["negro","blanco","beige","nude","rojo","rosa","fucsia","azul","celeste","verde","lila","gris","marrón","multicolor"];

const label = (k) => k.charAt(0).toUpperCase() + k.slice(1);
const API = `${API_URL}/api`;

export default function ProductForm({ onCreated }) {
  const nav = useNavigate();
  const PRODUCTO_INICIAL = {
    nombre: "",
    codigoInterno: "",
    precio: "",
    precioEspecial: "",
    precioMayorista: "",
    descripcion: "",
    categoria: "",
    subcategoria: "",
    stock: "",
    destacado: false,
    tags: [],
    variants: [],
    unidadesPorCaja: "",
    cantidadTonos: "",
    minimoMayorista: "30000",
    minimoMayorista2: "",
    minimoMayorista3: "",
    precioMayorista2: "",
    precioMayorista3: "",
    modoTonos: "automatico",
    tonosDisponibles: [],
    syncToERP: false,
  };

  const [producto, setProducto] = useState(PRODUCTO_INICIAL);
  const [submitting, setSubmitting] = useState(false);

  const [selSizes, setSelSizes]   = useState([]);
  const [selColors, setSelColors] = useState([]);
  const [imagenFiles, setImagenFiles] = useState([]); // array de File
  const [previewUrls, setPreviewUrls] = useState([]); // array de URLs
  const toggle = (arr, setArr, val) =>
    setArr((list) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "isNuevoIngreso") {
      setProducto((prev) => {
        const set = new Set(prev.tags || []);
        if (checked) set.add("nuevos-ingresos");
        else set.delete("nuevos-ingresos");
        return { ...prev, tags: Array.from(set) };
      });
      return;
    }

    if (name === "categoria") {
      setProducto((prev) => ({
        ...prev,
        [name]: value,
        subcategoria: "",
        minimoMayorista: value === "lenceria" ? "" : (prev.minimoMayorista || "30000"),
      }));
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
  const subcategorias = categoriasDB.find(c => c.slug === producto.categoria)?.subcategorias || [];

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
      toast.warn("Elegí al menos un talle o un color"); return;
    }
    setProducto((p) => {
      const list = [...(p.variants || [])];
      if (selSizes.length && selColors.length) {
        // combinaciones talle × color
        selSizes.forEach((sz) => selColors.forEach((col) => {
          if (!list.some(v => v.size === sz && v.color === col))
            list.push({ size: sz, color: col, stock: 0 });
        }));
      } else if (selSizes.length) {
        // solo talles, sin color
        selSizes.forEach((sz) => {
          if (!list.some(v => v.size === sz && !v.color))
            list.push({ size: sz, color: "", stock: 0 });
        });
      } else {
        // solo colores, sin talle
        selColors.forEach((col) => {
          if (!list.some(v => !v.size && v.color === col))
            list.push({ size: "", color: col, stock: 0 });
        });
      }
      return { ...p, variants: list };
    });
  };

  const selectAllSizes = () => setSelSizes(SIZES);
  const clearSizes  = () => setSelSizes([]);
  const clearColors = () => setSelColors([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { urls: imagenes, failed, failures } = await uploadImages();
      const imageWarning = failed > 0
        ? `Producto creado, pero ${failed} imagen${failed === 1 ? " no pudo" : "es no pudieron"} subirse. ` +
          `${failures.map(({ name, message }) => `${name}: ${message}`).join(" | ")} ` +
          "El resto de los datos se guardó correctamente."
        : "";

      const cleanVariants = (producto.variants || [])
        .filter(v => v.size || v.color)
        .map(v => ({
          size:  String(v.size  || "").trim(),
          color: String(v.color || "").trim(),
          stock: Number(v.stock ?? 0),
        }));

      const body = {
        ...producto,
        imagenes,
        precio:          parseFloat(String(producto.precio).replace(",", ".")) || 0,
        precioEspecial:  producto.precioEspecial  !== "" ? parseFloat(String(producto.precioEspecial).replace(",", "."))  : null,
        precioMayorista: producto.precioMayorista !== "" ? parseFloat(String(producto.precioMayorista).replace(",", ".")) : null,
        stock:           Number(producto.stock) || 0,
        categoria:    (producto.categoria    || "").toLowerCase(),
        subcategoria: (producto.subcategoria || "").toLowerCase(),
        variants: cleanVariants,
        unidadesPorCaja: producto.unidadesPorCaja !== "" ? Number(producto.unidadesPorCaja) : null,
        minimoMayorista: producto.minimoMayorista !== "" ? Number(producto.minimoMayorista) : null,
        minimoMayorista2: producto.minimoMayorista2 !== "" ? Number(producto.minimoMayorista2) : null,
        precioMayorista2: producto.precioMayorista2 !== "" ? Number(producto.precioMayorista2) : null,
        minimoMayorista3: producto.minimoMayorista3 !== "" ? Number(producto.minimoMayorista3) : null,
        precioMayorista3: producto.precioMayorista3 !== "" ? Number(producto.precioMayorista3) : null,
        cantidadTonos:   producto.cantidadTonos   !== "" ? Number(producto.cantidadTonos)   : null,
        modoTonos:       producto.modoTonos || "automatico",
        tonosDisponibles: producto.tonosDisponibles || [],
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
      if (imageWarning) toast.warn(imageWarning, { autoClose: 9000 });
      else toast.success("Producto creado correctamente");
      nav("/dashboard?tab=stock", { replace: true });
    } catch (err) {
      console.error(err?.response?.data || err);
      toast.error(err?.response?.data?.message || "Error al crear producto");
    } finally {
      setSubmitting(false);
    }
  };

  const isNuevoIngreso = (producto.tags || []).includes("nuevos-ingresos");

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
          <Field label={<><span className="price-tag price-tag--neutral">U</span> Precio Unitario <span className="pf-req">*</span></>}
            hint="Sin mínimo de compra">
            <Input
              name="precio"
              type="text"
              inputMode="decimal"
              placeholder="Sin mínimo de compra"
              value={producto.precio}
              onChange={handleChange}
              required={producto.categoria !== "lenceria"}
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
                  value={producto.minimoMayorista ?? ""} onChange={handleChange} />
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
                  value={producto.minimoMayorista ?? ""} onChange={handleChange} />
              </Field>

              <Field label={<><span className="price-tag price-tag--info">x2$</span> Precio por unidad x2</>}
                hint={`Precio por unidad (total: $${Number(producto.precioMayorista || 0) * Number(producto.minimoMayorista || 2)})`}>
                <Input name="precioMayorista" type="number" min="0" step="0.01"
                  placeholder="Ej: 5400"
                  value={producto.precioMayorista ?? ""} onChange={handleChange}
                  onWheel={e => e.currentTarget.blur()} />
              </Field>

              <Field label={<><span className="price-tag price-tag--success">x6</span> Mínimo x6</>}
                hint="Cantidad mínima (ej: 6)">
                <Input name="minimoMayorista2" type="number" min="1" step="1"
                  placeholder="6"
                  value={producto.minimoMayorista2 ?? ""} onChange={handleChange} />
              </Field>

              <Field label={<><span className="price-tag price-tag--success">x6$</span> Precio por unidad x6</>}
                hint={`Precio por unidad (total: $${Number(producto.precioMayorista2 || 0) * Number(producto.minimoMayorista2 || 6)})`}>
                <Input name="precioMayorista2" type="number" min="0" step="0.01"
                  placeholder="Ej: 5400"
                  value={producto.precioMayorista2 ?? ""} onChange={handleChange}
                  onWheel={e => e.currentTarget.blur()} />
              </Field>

              <Field label={<><span className="price-tag price-tag--brand">x12</span> Mínimo x12</>}
                hint="Cantidad mínima (ej: 12)">
                <Input name="minimoMayorista3" type="number" min="1" step="1"
                  placeholder="12"
                  value={producto.minimoMayorista3 ?? ""} onChange={handleChange} />
              </Field>

              <Field label={<><span className="price-tag price-tag--brand">x12$</span> Precio por unidad x12</>}
                hint={`Precio por unidad (total: $${Number(producto.precioMayorista3 || 0) * Number(producto.minimoMayorista3 || 12)})`}>
                <Input name="precioMayorista3" type="number" min="0" step="0.01"
                  placeholder="Ej: 9600"
                  value={producto.precioMayorista3 ?? ""} onChange={handleChange}
                  onWheel={e => e.currentTarget.blur()} />
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

            <Field label="Unidades por caja" hint="El contador sumará de a este múltiplo. Vacío = unidad.">
              <Input name="unidadesPorCaja" type="number" min="1" step="1"
                placeholder="Ej: 8 (bases), 3 (labiales)"
                value={producto.unidadesPorCaja} onChange={handleChange} />
            </Field>
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
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} tono{n > 1 ? "s" : ""}</option>)}
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
                  <option key={cat.slug} value={cat.slug}>{cat.nombre}</option>
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

            <Button variant="secondary" onClick={addBulk} type="button">
              <PlusIcon size={15} /> Agregar combinaciones
            </Button>
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
                    <Input
                      type="number" min="0" step="1"
                      value={v.stock ?? 0}
                      onChange={e => updateVariant(i, "stock", Number(e.target.value) || 0)}
                      style={{ width: 84, textAlign: "center" }}
                    />
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
            <label className="ui-check">
              <input
                type="checkbox"
                name="destacado"
                checked={!!producto.destacado}
                onChange={e => setProducto({ ...producto, destacado: e.target.checked })}
              />
              Producto destacado
            </label>
            <label className="ui-check">
              <input
                type="checkbox"
                name="isNuevoIngreso"
                checked={isNuevoIngreso}
                onChange={handleChange}
              />
              Mostrar en <b className="pf-ni">Nuevos ingresos</b>
            </label>
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
    </form>
  );
}
