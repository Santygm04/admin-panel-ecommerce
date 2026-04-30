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
  peluquería: ["peines", "cepillos", "tratamientos", "coloración"],
  bijouterie: ["aros", "collares", "pulseras", "anillos"],
  marroquineria: ["mochilas", "riñoneras", "bolsos"],
  accesorios: ["pelo"],
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
    precioEspecial: "",
    precioMayorista: "",
    descripcion: "",
    categoria: "",
    subcategoria: "",
    stock: "",
    destacado: false,
    tags: [],
    variants: [],
    // ← CAMBIO #8
    unidadesPorCaja: "",
    cantidadTonos: "",
    minimoMayorista: "",
    modoTonos: "automatico",
    tonosDisponibles: [],
  });

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
      setProducto((prev) => ({ ...prev, [name]: value, subcategoria: "" }));
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
          list.push({ size: sz, color: col });
      }));
    } else if (selSizes.length) {
      // solo talles, sin color
      selSizes.forEach((sz) => {
        if (!list.some(v => v.size === sz && !v.color))
          list.push({ size: sz, color: "" });
      });
    } else {
      // solo colores, sin talle
      selColors.forEach((col) => {
        if (!list.some(v => !v.size && v.color === col))
          list.push({ size: "", color: col });
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
    try {
      const imagen = await uploadImage();

      const cleanVariants = (producto.variants || [])
        .filter(v => v.size || v.color)
        .map(v => ({ size: String(v.size || "").trim(), color: String(v.color || "").trim() }));

      const body = {
        ...producto,
        imagen,
        precio:          Number(producto.precio) || 0,
        precioEspecial:  producto.precioEspecial  !== "" ? Number(producto.precioEspecial)  : null,
        precioMayorista: producto.precioMayorista !== "" ? Number(producto.precioMayorista) : null,
        stock:           Number(producto.stock) || 0,
        categoria:    (producto.categoria    || "").toLowerCase(),
        subcategoria: (producto.subcategoria || "").toLowerCase(),
        variants: cleanVariants,
        // ← CAMBIO #8
        unidadesPorCaja: producto.unidadesPorCaja !== "" ? Number(producto.unidadesPorCaja) : null,
        minimoMayorista: producto.minimoMayorista !== "" ? Number(producto.minimoMayorista) : null,
        cantidadTonos:   producto.cantidadTonos   !== "" ? Number(producto.cantidadTonos)   : null,
        modoTonos:       producto.modoTonos || "automatico",
        tonosDisponibles: producto.tonosDisponibles || [],
      };

      await axios.post(`${API}/productos`, body);
      toast.success("Producto creado correctamente");

      setProducto({
        nombre: "", precio: "", precioEspecial: "", precioMayorista: "",
        descripcion: "", categoria: "", subcategoria: "",
        stock: "", destacado: false, tags: [], variants: [],
        // ← CAMBIO #8
        unidadesPorCaja: "", cantidadTonos: "", modoTonos: "automatico", tonosDisponibles: [], minimoMayorista: "",
      });
      setSelSizes([]); setSelColors([]);
      setImagenFile(null); setPreviewUrl("");
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
            Cargá el nombre, precios, imagen y categoría.
            <span className="muted"> Las variantes son solo talle/color. El stock es global.</span>
          </p>
        </div>
      </header>

      {/* ── Nombre — ancho completo ── */}
      <div className="form-group pf-full">
        <label>Nombre</label>
        <input name="nombre" value={producto.nombre} onChange={handleChange} required />
      </div>

      {/* ── BLOQUE DE 3 PRECIOS — ancho completo, FUERA del pf-grid ── */}
      <div className="pf-precio-block pf-full">
        <div className="pf-precio-header">
          <span className="pf-precio-title">Sistema de precios</span>
          <span className="pf-precio-hint">Dejá vacío si no aplica el nivel</span>
        </div>

        <div className="pf-precio-grid">
          {/* Precio Unitario */}
          <div className="form-group pf-precio-item">
            <label className="pf-precio-label">
              <span className="pf-precio-tag pf-precio-tag--u">U</span>
              Precio Unitario <span className="pf-precio-req">*</span>
            </label>
            <input
              name="precio"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              placeholder="Sin mínimo de compra"
              value={producto.precio}
              onChange={handleChange}
              required
            />
            <small className="hint">Sin mínimo de compra</small>
          </div>

          {/* Precio Especial */}
          <div className="form-group pf-precio-item">
            <label className="pf-precio-label">
              <span className="pf-precio-tag pf-precio-tag--e">E</span>
              Precio Especial
            </label>
            <input
              name="precioEspecial"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              placeholder="Ej: 1200"
              value={producto.precioEspecial}
              onChange={handleChange}
            />
            <small className="hint">Llevando 5+ productos</small>
          </div>

          {/* Precio Mayorista */}
          <div className="form-group pf-precio-item">
            <label className="pf-precio-label">
              <span className="pf-precio-tag pf-precio-tag--m">M</span>
              Precio Mayorista
            </label>
            <input
              name="precioMayorista"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              placeholder="Ej: 900"
              value={producto.precioMayorista}
              onChange={handleChange}
            />
            <small className="hint">Compra mínima $30.000</small>
          </div>

          {producto.categoria === "lenceria" && (
            <div className="form-group pf-precio-item">
              <label className="pf-precio-label">
                <span className="pf-precio-tag pf-precio-tag--m">6x</span>
                Mínimo mayorista
              </label>
              <input
                name="minimoMayorista"
                type="number"
                min="1"
                step="1"
                placeholder="Ej: 6"
                value={producto.minimoMayorista ?? ""}
                onChange={handleChange}
              />
              <small className="hint">Unidades mínimas para precio mayorista. Ej: 6 → 6, 12, 18...</small>
            </div>
          )}

        </div>
      </div>

      {/* ── Grid principal: izquierda + derecha ── */}
      <div className="pf-grid">

        {/* Columna izquierda */}
        <div className="pf-col">

          <div className="pf-row">
            <div className="form-group">
              <label>Stock</label>
              <input name="stock" type="number" min="0" step="1"
                value={producto.stock} onChange={handleChange} required />
            </div>

            {/* ── #8 VENTA POR CAJA ── */}
            <div className="form-group">
              <label>Unidades por caja <span className="muted">(opcional)</span></label>
              <input name="unidadesPorCaja" type="number" min="1" step="1"
                placeholder="Ej: 8 (bases), 3 (labiales)"
                value={producto.unidadesPorCaja} onChange={handleChange} />
              <small className="hint">El contador sumará de a este múltiplo. Vacío = unidad.</small>
            </div>
          </div>

          {/* ── #8 SELECTOR DE TONOS ── */}
          <div className="pf-precio-block pf-full" style={{ marginTop: 0 }}>
            <div className="pf-precio-header">
              <span className="pf-precio-title">Tonos del producto <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span></span>
              <span className="pf-precio-hint">Solo para productos con variantes de tono</span>
            </div>

            <div className="pf-tonos-grid">
              <div className="form-group pf-precio-item">
                <label className="pf-precio-label">Cantidad de tonos</label>
                <select name="cantidadTonos" value={producto.cantidadTonos}
                  onChange={e => {
                    const n = e.target.value === "" ? "" : Number(e.target.value);
                    const tonos = n ? Array.from({ length: n }, (_, i) => `Tono ${i + 1}`) : [];
                    setProducto(p => ({ ...p, cantidadTonos: n, tonosDisponibles: p.modoTonos === "automatico" ? tonos : p.tonosDisponibles.slice(0, n || 0) }));
                  }}>
                  <option value="">Sin tonos</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} tono{n > 1 ? "s" : ""}</option>)}
                </select>
                <small className="hint">La distribución siempre es pareja (ej: 8 uds. ÷ 4 tonos = 2 c/u)</small>
              </div>

              {producto.cantidadTonos && (
                <div className="form-group pf-precio-item">
                  <label className="pf-precio-label">Modo de tonos</label>
                  <select name="modoTonos" value={producto.modoTonos}
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
                  </select>
                </div>
              )}
            </div>

            {/* Nombres de tonos en modo manual */}
            {producto.cantidadTonos && producto.modoTonos === "manual" && (
              <div className="pf-tonos-nombres">
                {Array.from({ length: Number(producto.cantidadTonos) }, (_, i) => (
                  <div key={i} className="form-group pf-precio-item" style={{ minWidth: 120 }}>
                    <label className="pf-precio-label">Tono {i + 1}</label>
                    <input
                      placeholder={`Ej: Beige`}
                      value={producto.tonosDisponibles[i] || ""}
                      onChange={e => {
                        const arr = [...(producto.tonosDisponibles || [])];
                        arr[i] = e.target.value;
                        setProducto(p => ({ ...p, tonosDisponibles: arr }));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Preview de distribución */}
            {producto.cantidadTonos && producto.unidadesPorCaja && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: ".82rem", color: "#15803d", fontWeight: 600 }}>
                ✓ {producto.unidadesPorCaja} unidades ÷ {producto.cantidadTonos} tonos = {Math.floor(producto.unidadesPorCaja / producto.cantidadTonos)} por tono
                {producto.unidadesPorCaja % producto.cantidadTonos > 0 && ` (+${producto.unidadesPorCaja % producto.cantidadTonos} extra)`}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              name="descripcion"
              value={producto.descripcion}
              onChange={handleChange}
              required
            />
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
                    <option key={sub} value={sub}>
                      {sub.charAt(0).toUpperCase() + sub.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Variantes */}
          <div className="variants">
            <div className="qa">
              <div className="choice-group">
                <span className="choice-label">1) Elegí talles <span className="muted">(opcional)</span></span>
                <div className="choice-grid">
                  {SIZES.map((s) => (
                    <button
                      type="button" key={s}
                      className={`choice ${selSizes.includes(s) ? "active" : ""}`}
                      onClick={() => toggle(selSizes, setSelSizes, s)}
                    >
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
                <span className="choice-label">2) Elegí colores <span className="muted">(opcional)</span></span>
                <div className="choice-grid">
                  {COLORS.map((c) => (
                    <button
                      type="button" key={c}
                      className={`choice ${selColors.includes(c) ? "active" : ""}`}
                      onClick={() => toggle(selColors, setSelColors, c)}
                    >
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
                Se crearán todas las combinaciones Talle × Color (sin duplicados).
              </small>
            </div>

            {(producto.variants || []).length === 0 ? (
              <p className="muted" style={{ marginTop: ".25rem" }}>No agregaste variantes.</p>
            ) : (
              <div className="var-table">
                <div className="var-row var-row--head">
                  <span>Talle</span>
                  <span>Color</span>
                  <span className="var-actions-col" />
                </div>
                {(producto.variants || []).map((v, i) => (
                  <div className="var-row" key={`${v.size}-${v.color}-${i}`}>
                    <div className="var-cell">
                      <select value={v.size || ""} onChange={e => updateVariant(i, "size", e.target.value)}>
                        <option value="">Talle…</option>
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="var-cell">
                      <select value={v.color || ""} onChange={e => updateVariant(i, "color", e.target.value)}>
                        <option value="">Color…</option>
                        {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="var-cell var-actions">
                      <button
                        type="button"
                        className="var-del"
                        onClick={() => removeVariant(i)}
                        aria-label="Eliminar variante"
                      >
                        ✕
                      </button>
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
                  <small className="muted">JPG/PNG vertical · Recomendado 700×900 (4:5)</small>
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
                onChange={e => setProducto({ ...producto, destacado: e.target.checked })}
              />
              <span className="slider" />
              <span className="switch-label">Producto destacado</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                name="isNuevoIngreso"
                checked={isNuevoIngreso}
                onChange={handleChange}
              />
              <span className="slider" />
              <span className="switch-label">
                Mostrar en <b className="ni">Nuevos ingresos</b>
              </span>
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