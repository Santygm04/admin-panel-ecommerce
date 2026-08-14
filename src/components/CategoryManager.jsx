import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { Badge, Button, Card, EmptyState, Field, Input, Skeleton } from "./ui";
import { FolderIcon, PlusIcon, EditIcon, TrashIcon } from "./ui/icons";
import ConfirmDialog from "./ConfirmDialog";
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
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [counts, setCounts] = useState({});

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

  useEffect(() => {
    let active = true;
    axios.get(`${API}/productos`, { params: { limit: 500 }, headers: authHeader() })
      .then(({ data }) => {
        if (!active) return;
        const items = Array.isArray(data) ? data : data.items || [];
        const map = {};
        for (const p of items) {
          if (p.categoria) map[p.categoria] = (map[p.categoria] || 0) + 1;
        }
        setCounts(map);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const totalProductos = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts]
  );

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

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/categories/${confirmId}`, {
        headers: authHeader(),
      });
      toast.success("Categoría eliminada");
      fetchCats();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  };

  return (
    <div className="cm-wrap">
      <div className="cm-head">
        <div>
          <h2 className="ui-page-title">{editing ? "Editar categoría" : "Categorías"}</h2>
          <p className="cm-subtitle">
            Las categorías se guardan en la base de datos y se usan dinámicamente en el sitio.
          </p>
        </div>
        <Badge tone="neutral">{totalProductos} productos en total</Badge>
      </div>

      <Card pad className="cm-form-card">
        <form className="cm-form" onSubmit={handleSave} noValidate>
          <div className="cm-form-grid">
            <Field label="Nombre" required>
              <Input
                value={form.nombre}
                required
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Lencería"
              />
            </Field>
            <Field label="Slug" hint="URL amigable" required>
              <Input
                value={form.slug}
                required
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="Ej: lenceria"
              />
            </Field>
          </div>

          <Field label="Subcategorías" hint="Separadas por coma">
            <Input
              value={form.subcategorias}
              onChange={e => setForm(f => ({ ...f, subcategorias: e.target.value }))}
              placeholder="Ej: conjuntos, tops, vedetinas"
            />
          </Field>

          <Field label="Orden" hint="Menor número → aparece primero">
            <Input
              type="number"
              value={form.orden}
              min={0}
              onChange={e => setForm(f => ({ ...f, orden: e.target.value }))}
              style={{ maxWidth: 140 }}
            />
          </Field>

          <div className="ui-row">
            <Button type="submit">
              {editing ? "Guardar cambios" : <><PlusIcon size={15} /> Crear categoría</>}
            </Button>
            {editing && (
              <Button variant="secondary" onClick={resetForm}>Cancelar</Button>
            )}
          </div>
        </form>
      </Card>

      <h3 className="cm-list-title">Categorías existentes</h3>

      {loading ? (
        <div className="ui-stack">
          <Skeleton variant="block" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      ) : cats.length === 0 ? (
        <EmptyState
          icon={<FolderIcon size={24} />}
          title="No hay categorías todavía"
          description="Creá la primera con el formulario de arriba."
        />
      ) : (
        <div className="cm-list">
          {cats.map(cat => (
            <Card key={cat._id} className="cm-card" pad>
              <div className="cm-card-body">
                <div className="cm-card-head">
                  <span className="cm-card-name">{cat.nombre}</span>
                  <span className="cm-card-slug">/{cat.slug}</span>
                  {cat.orden != null && <span className="cm-card-orden">orden {cat.orden}</span>}
                  {counts[cat.slug] > 0 && (
                    <Badge tone="brand">{counts[cat.slug]} producto{counts[cat.slug] !== 1 ? "s" : ""}</Badge>
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
              <div className="ui-row cm-card-actions">
                <Button size="sm" variant="secondary" onClick={() => handleEdit(cat)}>
                  <EditIcon size={14} /> Editar
                </Button>
                <Button size="sm" variant="danger-ghost" onClick={() => setConfirmId(cat._id)}>
                  <TrashIcon size={14} /> Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Eliminar categoría"
        message="¿Eliminar esta categoría? Los productos que la usan quedarán sin categoría."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
        loading={deleting}
      />
    </div>
  );
}
