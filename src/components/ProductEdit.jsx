// EditProduct.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "../../src/components/ProductForm.css";

const subcategoriasPorCategoria = {
  lenceria: ["conjuntos","tops-y-corpiños","vedetinas","colales","boxer","slip","niña","medias"],
  maquillaje: ["labiales", "sombras", "brochas", "sets"],
  skincare: ["serums", "limpiadores", "exfoliantes", "cremas"],
  bodycare: ["jabones", "cremas corporales", "aceites"],
  uñas: ["Soft-Gel", "Semi-Permanente", "Normal", "soft-gel"],
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

export default function EditProduct() {
  const { id }   = useParams();
  const nav      = useNavigate();

  const [loading, setLoading]     = useState(true);
  const [producto, setProducto]   = useState(null);
  const [imagenFile, setImagenFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // variantes SOLO talle/color
  const [variantes, setVariantes] = useState([]);

  // quick add – chips
  const [selSizes, setSelSizes]   = useState([]);
  const [selColors, setSelColors] = useState([]);

  const toggle = (arr, setArr, val) =>
    setArr((list) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]));

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/productos/${id}`, { params: { admin: true } });
        const p = data || {};
        setProducto({
          nombre: p.nombre || "",
          precio: p.precio === 0 || p.precio ? String(p.precio) : "",
          descripcion: p.descripcion || "",
          categoria: p.categoria || "",
          subcategoria: p.subcategoria || "",
          stock: p.stock === 0 || p.stock ? String(p.stock) : "",
          destacado: !!p.destacado,
          imagen: p.imagen || "",
          tags: Array.isArray(p.tags) ? p.tags : [],
          createdAt: p.createdAt,
        });

        const rawVars = Array.isArray(p.variantes) ? p.variantes
                      : Array.isArray(p.variants)  ? p.variants
                      : [];
        setVariantes(
          rawVars.map(v => ({
            talle: String(v.talle ?? v.size ?? "").trim(),
            color: String(v.color ?? "").trim(),
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

  const subcategorias = useMemo(
    () => subcategoriasPorCategoria[producto?.categoria] || [],
    [producto?.categoria]
  );

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

    const nextVal = type === "checkbox" ? checked : value;
    setProducto(prev => {
      const base = { ...prev, [name]: nextVal };
      if (name === "categoria") base.subcategoria = "";
      return base;
    });
  };

  const addVar = () => setVariantes(v => [...v, { talle: "", color: "" }]);
  const delVar = (i) => setVariantes(v => v.filter((_, idx) => idx !== i));
  const setVar = (i, key, val) => setVariantes(v => v.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  const addBulk = () => {
    if (!selSizes.length) { toast.warn("Elegí al menos un talle"); return; }
    if (!selColors.length) { toast.warn("Elegí al menos un color"); return; }
    setVariantes((list) => {
      const next = [...list];
      selSizes.forEach(sz => {
        selColors.forEach(col => {
          const exists = next.some(v => (v.talle === sz) && (v.color||"") === col);
          if (!exists) next.push({ talle: sz, color: col });
        });
      });
      return next;
    });
  };

  const selectAllSizes = () => setSelSizes(SIZES);
  const clearSizes = () => setSelSizes([]);
  const clearColors = () => setSelColors([]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    setImagenFile(file || null);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  };

  const uploadImageIfNeeded = async () => {
    if (!imagenFile) return null;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imagenUrl = producto.imagen || "";
      const up = await uploadImageIfNeeded();
      if (up) imagenUrl = up;

      const safeInt = (s) => {
        const n = parseInt(String(s).replace(/\D+/g, ""), 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
      };

      const clean = variantes
        .map(v => ({
          size:  String(v.talle || "").trim(),
          color: String(v.color || "").trim(),
        }))
        .filter(v => v.size || v.color);

      const body = {
        nombre: producto.nombre,
        precio: safeInt(producto.precio),
        descripcion: producto.descripcion,
        categoria: (producto.categoria || "").toLowerCase(),
        subcategoria: (producto.subcategoria || "").toLowerCase(),
        stock: safeInt(producto.stock),        // stock global
        destacado: !!producto.destacado,
        tags: producto.tags || [],
        imagen: imagenUrl,
        variants: clean,                        // sólo talle/color
      };

      await axios.put(`${API}/productos/${id}`, body);
      toast.success("Producto actualizado");
      nav(-1);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Error al actualizar");
    }
  };

  if (loading || !producto) {
    return (
      <div className="product-form">
        <h2>Editando producto</h2>
        <p>Cargando…</p>
      </div>
    );
  }

  const isNuevoIngreso = (producto.tags || []).includes("nuevos-ingresos");

  return (
    <form className="product-form" onSubmit={handleSubmit} autoComplete="off">
      <header className="pf-header">
        <div>
          <h2>Editar producto</h2>
          <p className="pf-sub">
            <span className="muted">ID:</span> {id}
            {producto.createdAt && (
              <> · <span className="muted">Creado:</span> {new Date(producto.createdAt).toLocaleDateString()}</>
            )}
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
              <label>Precio</label>
              <input name="precio" type="number" inputMode="numeric" step="1"
                     value={producto.precio} onChange={handleChange} onWheel={(e)=>e.currentTarget.blur()} required />
            </div>

            <div className="form-group">
              <label>Stock</label>
              <input name="stock" type="number" inputMode="numeric" min="0" step="1"
                     value={producto.stock} onChange={handleChange} onWheel={(e)=>e.currentTarget.blur()} />
              <small className="hint">El stock se maneja por este campo. Las variantes son solo talle/color.</small>
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

          {/* VARIANTES (solo talle/color) */}
          <div className="variants">
            <div className="variants-head">
              <div className="vhead-left">
                {/* <h3>Variantes (talle y color) — <span className="muted">opcional</span></h3>
                <span className="stock-pill">Stock global: {Number(producto.stock || 0)}</span> */}
              </div>
              {/* <button className="btn-add-var" type="button" onClick={addVar}>+ Agregar variante</button> */}
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
                  <button type="button" className="qa-link" onClick={()=>setSelSizes(SIZES)}>Todos</button>
                  <button type="button" className="qa-link" onClick={()=>setSelSizes([])}>Limpiar</button>
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
                  <button type="button" className="qa-link" onClick={()=>setSelColors([])}>Limpiar</button>
                </div>
              </div>

              <button type="button" className="qa-btn" onClick={addBulk}>
                + Agregar combinaciones
              </button>
              <small className="hint">
                Se crearán todas las combinaciones Talle × Color seleccionadas (sin duplicados).
              </small>
            </div>

            {variantes.length === 0 ? (
              <p className="muted" style={{ marginTop: ".25rem" }}>No agregaste variantes.</p>
            ) : (
              <div className="var-table">
                <div className="var-row var-row--head">
                  <span>Talle</span>
                  <span>Color</span>
                  <span className="var-actions-col"></span>
                </div>

                {variantes.map((v, i) => (
                  <div className="var-row" key={`${v.talle}-${v.color}-${i}`}>
                    <div className="var-cell">
                      <select value={v.talle || ""} onChange={(e)=>setVar(i, "talle", e.target.value)}>
                        <option value="">Talle…</option>
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="var-cell">
                      <select value={v.color || ""} onChange={(e)=>setVar(i, "color", e.target.value)}>
                        <option value="">Color…</option>
                        {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="var-cell var-actions">
                      <button type="button" className="var-del" onClick={()=>delVar(i)} aria-label="Eliminar variante">✕</button>
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
              {(previewUrl || producto.imagen) ? (
                <img src={previewUrl || producto.imagen} alt="Vista previa" className="preview-image" />
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
              <input type="checkbox" name="destacado"
                     checked={!!producto.destacado}
                     onChange={(e)=>setProducto({ ...producto, destacado: e.target.checked })}/>
              <span className="slider"></span>
              <span className="switch-label">Producto destacado</span>
            </label>

            <label className="switch">
              <input type="checkbox" name="isNuevoIngreso"
                     checked={isNuevoIngreso} onChange={handleChange}/>
              <span className="slider"></span>
              <span className="switch-label">Mostrar en <b className="ni">Nuevos ingresos</b></span>
            </label>
          </div>
        </div>
      </div>

      <div className="pf-actions">
        <button type="button" className="btn-primary" style={{ background: "#bbb", marginRight: 8 }} onClick={()=>nav(-1)}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary">Guardar cambios</button>
      </div>
    </form>
  );
}
