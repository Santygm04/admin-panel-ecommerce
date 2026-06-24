import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import "./CategoryManager.css";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API = API_BASE ? `${API_BASE}/api` : "/api";
const authHeader = () => {
  const t = localStorage.getItem("aesthetic:token") || "";
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export default function CategoryManager() {
  const [cats, setCats]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ nombre: "", slug: "", subcategorias: "", orden: 0 });
  const [editing, setEditing] = useState(null);

  const fetchCats = async () => {
    try {
      const { data } = await axios.get(`${API}/categories`);
      setCats(data.categories || []);
    } catch {
      toast.error("No se pudieron cargar las categorías");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCats(); }, []);

  const resetForm = () => {
    setForm({ nombre: "", slug: "", subcategorias: "", orden: 0 });
    setEditing(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre.trim(),
      slug:   form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      subcategorias: form.subcategorias.split(",").map(s => s.trim()).filter(Boolean),
      orden: Number(form.orden) || 0,
    };
    try {
      if (editing) {
        await axios.put(`${API}/categories/${editing}`, payload, {
          headers: authHeader(),
        });
        toast.success("Categoría actualizada");
      } else {
        await axios.post(`${API}/categories`, payload, {
          headers: authHeader(),
        });
        toast.success("Categoría creada");
      }
      resetForm();
      fetchCats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error al guardar");
    }
  };

  const handleEdit = (cat) => {
    setEditing(cat._id);
    setForm({
      nombre: cat.nombre,
      slug: cat.slug,
      subcategorias: (cat.subcategorias || []).join(", "),
      orden: cat.orden ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta categoría?")) return;
    try {
      await axios.delete(`${API}/categories/${id}`, {
        headers: authHeader(),
      });
      toast.success("Eliminada");
      fetchCats();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="cm-wrap">
      <h2 className="cm-title">
        {editing ? "✏️ Editar categoría" : "🗂️ Nueva categoría"}
      </h2>
      <p className="cm-subtitle">
        Las categorías se guardan en la base de datos y se usan dinámicamente en el sitio.
      </p>

      {/* ── FORMULARIO ── */}
      <form className="cm-form" onSubmit={handleSave}>
        <div className="cm-form-grid">
          <div className="cm-field">
            <label className="cm-label">Nombre</label>
            <input
              className="cm-input"
              value={form.nombre}
              required
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Lencería"
            />
          </div>
          <div className="cm-field">
            <label className="cm-label">Slug <span>(URL amigable)</span></label>
            <input
              className="cm-input"
              value={form.slug}
              required
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="Ej: lenceria"
            />
          </div>
        </div>

        <div className="cm-field cm-input-full">
          <label className="cm-label">
            Subcategorías <span>(separadas por coma)</span>
          </label>
          <input
            className="cm-input"
            value={form.subcategorias}
            onChange={e => setForm(f => ({ ...f, subcategorias: e.target.value }))}
            placeholder="Ej: conjuntos, tops, vedetinas"
          />
        </div>

        <div className="cm-orden-row">
          <label className="cm-label">Orden</label>
          <input
            className="cm-input-sm"
            type="number"
            value={form.orden}
            min={0}
            onChange={e => setForm(f => ({ ...f, orden: e.target.value }))}
          />
          <span style={{ fontSize: "0.78rem", color: "#aaa" }}>
            Menor número → aparece primero
          </span>
        </div>

        <div className="cm-form-actions">
          <button type="submit" className="cm-btn-primary">
            {editing ? "Guardar cambios" : "Crear categoría"}
          </button>
          {editing && (
            <button type="button" className="cm-btn-cancel" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* ── LISTA ── */}
      <h3 className="cm-list-title">Categorías existentes</h3>

      {loading ? (
        <p className="cm-loading">Cargando…</p>
      ) : cats.length === 0 ? (
        <p className="cm-empty">No hay categorías todavía. Creá la primera arriba.</p>
      ) : (
        <div className="cm-list">
          {cats.map(cat => (
            <div key={cat._id} className="cm-card">
              <div className="cm-card-body">
                <div>
                  <span className="cm-card-name">{cat.nombre}</span>
                  <span className="cm-card-slug">/{cat.slug}</span>
                  {cat.orden != null && (
                    <span className="cm-card-orden">orden {cat.orden}</span>
                  )}
                </div>
                {cat.subcategorias?.length > 0 && (
                  <div className="cm-subcats">
                    {cat.subcategorias.map(s => (
                      <span key={s} className="cm-subcat-chip">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="cm-card-actions">
                <button className="cm-btn-edit" onClick={() => handleEdit(cat)}>
                  Editar
                </button>
                <button className="cm-btn-delete" onClick={() => handleDelete(cat._id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}