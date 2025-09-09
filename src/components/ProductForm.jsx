// ProductForm.jsx
import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../../src/components/ProductForm.css";

const subcategoriasPorCategoria = {
  lenceria: ["conjuntos","tops-y-corpiños","vedetinas","colales","boxer","slip","niña","medias"],
  maquillaje: ["labiales", "sombras", "brochas", "sets"],
  skincare: ["serums", "limpiadores", "exfoliantes", "cremas"],
  bodycare: ["jabones", "cremas corporales", "aceites"],
  uñas: ["Soft-Gel", "Semi-Permanente", "Normal"],
  pestañas: ["insumos", "kits", "extensiones"],
  peluquería: ["peines", "cepillos", "accesorios"],
  bijouterie: ["aros", "collares", "pulseras", "anillos"],
  marroquineria: ["mochilas", "riñoneras", "bolsos"],
};

const SIZES  = ["XS","S","M","L","XL","XXL","XXXL","Único"];
const COLORS = ["negro","blanco","beige","nude","rojo","rosa","fucsia","azul","celeste","verde","lila","gris","marrón","multicolor"];

const label = (k) => k.charAt(0).toUpperCase() + k.slice(1);
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API = API_BASE ? `${API_BASE}/api` : "/api";

export default function ProductForm() {
  const [producto, setProducto] = useState({
    nombre: "",
    precio: "",
    descripcion: "",
    categoria: "",
    subcategoria: "",
    stock: "",
    destacado: false,
    tags: [],
    variants: [], // sólo talle/color
  });

  // Quick add (chips)
  const [selSizes, setSelSizes]   = useState([]);
  const [selColors, setSelColors] = useState([]);

  const [imagenFile, setImagenFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

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

    const nextVal = type === "number" ? (value === "" ? "" : Number(value)) : value;
    setProducto((prev) => ({ ...prev, [name]: nextVal }));

    if (name === "categoria") {
      setProducto((prev) => ({ ...prev, subcategoria: "" }));
    }
  };

  const subcategorias = subcategoriasPorCategoria[producto.categoria] || [];

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    setImagenFile(file || null);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  };

  const uploadImage = async () => {
    if (!imagenFile) return "";
    const formData = new FormData();
    formData.append("file", imagenFile);
    formData.append("upload_preset", "aesthetic");
    formData.append("folder", "productos");
    const res = await axios.post(
      "https://api.cloudinary.com/v1_1/dl2vebaou/image/upload",
      formData
    );
    return res.data.secure_url;
  };

  // Variantes UI (solo size/color)
  const addVariant = () => {
    setProducto((p) => ({
      ...p,
      variants: [...(p.variants || []), { size: "", color: "" }],
    }));
  };
  const updateVariant = (i, key, val) => {
    setProducto((p) => {
      const next = [...(p.variants || [])];
      next[i] = { ...next[i], [key]: val };
      return { ...p, variants: next };
    });
  };
  const removeVariant = (i) => {
    setProducto((p) => {
      const next = [...(p.variants || [])];
      next.splice(i, 1);
      return { ...p, variants: next };
    });
  };

  // Agregar varias combinaciones (talles × colores)
  const addBulk = () => {
    if (!selSizes.length) { toast.warn("Elegí al menos un talle"); return; }
    if (!selColors.length) { toast.warn("Elegí al menos un color"); return; }
    setProducto((p) => {
      const list = [...(p.variants || [])];
      selSizes.forEach((sz) => {
        selColors.forEach((col) => {
          const exists = list.some(v => v.size === sz && (v.color||"") === col);
          if (!exists) list.push({ size: sz, color: col });
        });
      });
      return { ...p, variants: list };
    });
  };

  const selectAllSizes = () => setSelSizes(SIZES);
  const clearSizes = () => setSelSizes([]);
  const clearColors = () => setSelColors([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const imagen = await uploadImage();

      const cleanVariants = (producto.variants || [])
        .filter(v => (v.size || v.color))
        .map(v => ({
          size:  String(v.size || "").trim(),
          color: String(v.color || "").trim(),
        }));

      const body = {
        ...producto,
        imagen,
        precio: Number(producto.precio) || 0,
        stock: Number(producto.stock) || 0,        // stock global
        categoria: (producto.categoria || "").toLowerCase(),
        subcategoria: (producto.subcategoria || "").toLowerCase(),
        variants: cleanVariants,                    // sólo size/color
      };

      await axios.post(`${API}/productos`, body);
      toast.success("Producto creado correctamente");

      // Reset
      setProducto({
        nombre: "",
        precio: "",
        descripcion: "",
        categoria: "",
        subcategoria: "",
        stock: "",
        destacado: false,
        tags: [],
        variants: [],
      });
      setSelSizes([]); setSelColors([]);
      setImagenFile(null);
      setPreviewUrl("");
    } catch (err) {
      console.error(err?.response?.data || err);
      toast.error(err?.response?.data?.message || "Error al crear producto");
    }
  };

  const isNuevoIngreso = (producto.tags || []).includes("nuevos-ingresos");

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <header className="pf-header">
        <div>
          <h2>Subir nuevo producto</h2>
          <p className="pf-sub">
            Cargá el nombre, precio, imagen y categoría.
            <span className="muted"> Las variantes son solo talle/color. El stock es global.</span>
          </p>
        </div>
      </header>

      <div className="pf-grid">
        {/* Columna izquierda */}
        <div className="pf-col">
          <div className="form-group">
            <label>Nombre</label>
            <input name="nombre" value={producto.nombre} onChange={handleChange} required />
          </div>

          <div className="pf-row">
            <div className="form-group">
              <label>Precio (base)</label>
              <input name="precio" type="number" inputMode="decimal" step="1"
                     value={producto.precio} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Stock</label>
              <input name="stock" type="number" min="0" step="1"
                     value={producto.stock} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea name="descripcion" value={producto.descripcion} onChange={handleChange} required />
          </div>

          <div className="pf-row">
            <div className="form-group">
              <label>Categoría</label>
              <select name="categoria" value={producto.categoria} onChange={handleChange} required>
                <option value="">Seleccionar categoría</option>
                {Object.keys(subcategoriasPorCategoria).map((cat) => (
                  <option key={cat} value={cat}>{label(cat)}</option>
                ))}
              </select>
            </div>

            {subcategorias.length > 0 && (
              <div className="form-group">
                <label>Subcategoría</label>
                <select name="subcategoria" value={producto.subcategoria} onChange={handleChange} required>
                  <option value="">Seleccionar subcategoría</option>
                  {subcategorias.map((sub) => (
                    <option key={sub} value={sub}>{sub.charAt(0).toUpperCase() + sub.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Variantes (solo talle/color) */}
          <div className="variants">
            <div className="variants-head">
              <div className="vhead-left">
                {/* <h3>Variantes (talle y color) — <span className="muted">opcional</span></h3> */}
                {/* <span className="stock-pill">Stock global: {Number(producto.stock || 0)}</span> */}
              </div>
              {/* <button type="button" className="btn-add-var" onClick={addVariant}>+ Agregar variante</button> */}
            </div>

            {/* Paso a paso claro */}
            <div className="qa">
              <div className="choice-group">
                <span className="choice-label">1) Elegí talles</span>
                <div className="choice-grid">
                  {SIZES.map((s) => (
                    <button type="button"
                            key={s}
                            className={`choice ${selSizes.includes(s) ? "active" : ""}`}
                            onClick={() => toggle(selSizes, setSelSizes, s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="qa-tools">
                  <button type="button" className="qa-link" onClick={selectAllSizes}>Todos</button>
                  <button type="button" className="qa-link" onClick={clearSizes}>Limpiar</button>
                </div>
              </div>

              <div className="choice-group">
                <span className="choice-label">2) Elegí colores</span>
                <div className="choice-grid">
                  {COLORS.map((c) => (
                    <button type="button"
                            key={c}
                            className={`choice ${selColors.includes(c) ? "active" : ""}`}
                            onClick={() => toggle(selColors, setSelColors, c)}>
                      {c}
                    </button>
                  ))}
                </div>
                <div className="qa-tools">
                  <button type="button" className="qa-link" onClick={clearColors}>Limpiar</button>
                </div>
              </div>

              <button type="button" className="qa-btn" onClick={addBulk}>
                + Agregar combinaciones
              </button>
              <small className="hint">
                Se crearán todas las combinaciones Talle × Color seleccionadas (sin duplicados).
              </small>
            </div>

            {(producto.variants || []).length === 0 ? (
              <p className="muted" style={{ marginTop: ".25rem" }}>No agregaste variantes.</p>
            ) : (
              <div className="var-table">
                <div className="var-row var-row--head">
                  <span>Talle</span>
                  <span>Color</span>
                  <span className="var-actions-col"></span>
                </div>

                {(producto.variants || []).map((v, i) => (
                  <div className="var-row" key={`${v.size}-${v.color}-${i}`}>
                    <div className="var-cell">
                      <select value={v.size || ""} onChange={(e)=>updateVariant(i, "size", e.target.value)}>
                        <option value="">Talle…</option>
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="var-cell">
                      <select value={v.color || ""} onChange={(e)=>updateVariant(i, "color", e.target.value)}>
                        <option value="">Color…</option>
                        {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="var-cell var-actions">
                      <button type="button" className="var-del" onClick={()=>removeVariant(i)} aria-label="Eliminar variante">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="pf-col pf-side">
          <div className="form-group">
            <label>Imagen</label>
            <label className="dropzone">
              <input type="file" accept="image/*" onChange={handleImageChange} />
              {previewUrl ? (
                <img src={previewUrl} alt="Vista previa" className="preview-image" />
              ) : (
                <div className="dz-empty">
                  <div className="dz-icon">📷</div>
                  <div>Arrastrá una imagen o <u>hacé click</u></div>
                  <small className="muted">JPG/PNG · Recomendado 700×700</small>
                </div>
              )}
            </label>
          </div>

          <div className="switches">
            <label className="switch">
              <input
                type="checkbox"
                name="destacado"
                checked={!!producto.destacado}
                onChange={(e)=>setProducto({ ...producto, destacado: e.target.checked })}
              />
              <span className="slider"></span>
              <span className="switch-label">Producto destacado</span>
            </label>

            <label className="switch">
              <input
                type="checkbox"
                name="isNuevoIngreso"
                checked={isNuevoIngreso}
                onChange={handleChange}
              />
              <span className="slider"></span>
              <span className="switch-label">Mostrar en <b className="ni">Nuevos ingresos</b></span>
            </label>
          </div>
        </div>
      </div>

      <div className="pf-actions">
        <button type="submit" className="btn-primary">Crear producto</button>
      </div>
    </form>
  );
}
