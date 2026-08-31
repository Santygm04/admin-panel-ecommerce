import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { Link, useLocation } from "react-router-dom";
import ProductList from "./ProductList";
import ProductForm from "./ProductForm";
import StatsPage from "./StatsPage";
import CategoryManager from "./CategoryManager";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Select } from "./ui";
import {
  PlusIcon, LockIcon, UsersIcon,
} from "./ui/icons";
import "./DashBoard.css";
import { API_URL } from "../utils/api";

/* ══════════════════════════════════════════
   DASHBOARD PRINCIPAL
══════════════════════════════════════════ */
export default function DashBoard() {
  const { user } = useAuth();
  const [vista, setVista] = useState("stock");
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    setVista(tab || "stock");
  }, [location.search]);

  const is = (perm) => user?.role === "admin" || Boolean(user?.permissions?.[perm]);

  return (
    <div className="dash">
      <main className="dash-content">
        {vista === "stock" && <ProductList />}
        {vista === "crear" && <ProductForm onCreated={() => setVista("stock")} />}
        {vista === "categorias" && (is("editarCategorias") ? <CategoryManager /> : <SolicitarPermisoSection permiso="editarCategorias" />)}
        {vista === "estadisticas" && (is("verEstadisticas") ? <StatsPage role={user?.role} /> : <SolicitarPermisoSection permiso="verEstadisticas" />)}
        {vista === "cuenta" && <CuentaSection />}
        {vista === "usuarios" && <UsuariosSection />}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════
   CUENTA — Cambiar contraseña
══════════════════════════════════════════ */
function CuentaSection() {
  const { changePassword, user } = useAuth();
  const [form, setForm] = useState({ actual: "", nueva: "", repetir: "" });
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });
    if (form.nueva.length < 8)
      return setMsg({ text: "La nueva contraseña debe tener mínimo 8 caracteres.", ok: false });
    if (form.nueva !== form.repetir)
      return setMsg({ text: "Las contraseñas no coinciden.", ok: false });
    setLoading(true);
    try {
      await changePassword(form.actual, form.nueva);
      setMsg({ text: "Contraseña actualizada correctamente.", ok: true });
      setForm({ actual: "", nueva: "", repetir: "" });
    } catch (err) {
      setMsg({ text: err?.message || "Error al cambiar contraseña.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-narrow">
      <h2 className="st-title">Mi cuenta</h2>
      {user && (
        <p className="section-meta">
          Usuario: <strong>{user.username}</strong> · Rol: <strong>{user.role}</strong>
        </p>
      )}

      <Card pad>
        <CardTitle>Cambiar contraseña</CardTitle>
        <form onSubmit={submit} className="section-form">
          {msg.text && (
            <div className={`ui-banner ${msg.ok ? "ui-banner--success" : "ui-banner--danger"}`} role="status">
              {msg.text}
            </div>
          )}
          <Field label="Contraseña actual">
            <Input
              type="password"
              autoComplete="current-password"
              value={form.actual}
              onChange={(e) => setForm({ ...form, actual: e.target.value })}
              required
            />
          </Field>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.nueva}
              onChange={(e) => setForm({ ...form, nueva: e.target.value })}
              required
            />
          </Field>
          <Field label="Repetir nueva contraseña">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.repetir}
              onChange={(e) => setForm({ ...form, repetir: e.target.value })}
              required
            />
          </Field>
          <Button type="submit" loading={loading}>
            {loading ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════
   USUARIOS — Gestión de vendedores
══════════════════════════════════════════ */
function UsuariosSection() {
  const { getUsers, createUser, updateUser, deleteUser, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    username: "", password: "", name: "", role: "vendedor",
    permissions: {
      verEstadisticas: false, verOrdenes: true,
      editarCategorias: false, crearProductos: true, editarStockSolo: true,
    },
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setUsers(await getUsers()); } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const resetForm = () => {
    setForm({
      username: "", password: "", name: "", role: "vendedor",
      permissions: {
        verEstadisticas: false, verOrdenes: true,
        editarCategorias: false, crearProductos: true, editarStockSolo: true,
      },
    });
    setEditTarget(null);
    setShowForm(false);
  };

  const startEdit = (u) => {
    setEditTarget(u);
    setForm({
      username: u.username, password: "", name: u.name || "", role: u.role,
      permissions: { ...u.permissions },
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (editTarget) {
        const payload = { name: form.name, role: form.role, permissions: form.permissions };
        if (form.password) payload.password = form.password;
        await updateUser(editTarget._id, payload);
      } else {
        await createUser(form);
      }
      await load();
      resetForm();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteUser(confirmData._id);
      await load();
      setConfirmData(null);
    } catch (err) {
      setMsg(err.message);
      setConfirmData(null);
    } finally {
      setDeleting(false);
    }
  };

  const togglePerm = (key) =>
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));

  const PERMS = [
    { key: "verEstadisticas", label: "Ver estadísticas" },
    { key: "verOrdenes", label: "Ver órdenes" },
    { key: "editarCategorias", label: "Editar categorías" },
    { key: "crearProductos", label: "Crear productos" },
    { key: "editarStockSolo", label: "Solo editar stock" },
  ];

  return (
    <div className="section-narrow">
      <div className="section-head">
        <h2 className="st-title">Gestión de usuarios</h2>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <PlusIcon size={15} /> Nuevo usuario
        </Button>
      </div>

      {msg && <div className="ui-banner ui-banner--danger" role="alert">{msg}</div>}

      {showForm && (
        <Card pad className="users-form-card">
          <CardTitle>{editTarget ? `Editar: ${editTarget.username}` : "Nuevo usuario"}</CardTitle>
          <form onSubmit={handleSubmit} className="section-form">
            {!editTarget && (
              <Field label="Usuario" hint="Ej: vendedora1">
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </Field>
            )}
            <Field label="Nombre visible">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={editTarget ? "Nueva contraseña" : "Contraseña"}
              hint={editTarget ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                {...(!editTarget && { required: true })}
              />
            </Field>
            <Field label="Rol">
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>

            <Field label="Permisos">
              <div className="users-perms">
                {PERMS.map(({ key, label }) => (
                  <label key={key} className="ui-check">
                    <input
                      type="checkbox"
                      checked={!!form.permissions[key]}
                      onChange={() => togglePerm(key)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>

            <div className="ui-row">
              <Button type="submit" loading={saving}>
                {saving ? "Guardando…" : editTarget ? "Guardar cambios" : "Crear usuario"}
              </Button>
              <Button variant="secondary" onClick={resetForm}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="users-skeleton">
          <div className="ui-skeleton ui-skeleton--block" />
          <div className="ui-skeleton ui-skeleton--block" />
          <div className="ui-skeleton ui-skeleton--block" />
        </div>
      ) : (
        <div className="users-list">
          {users.map((u) => (
            <Card key={u._id} pad className="users-item">
              <div className="users-item-meta">
                <div className="ui-row">
                  <strong className="users-item-name">{u.name || u.username}</strong>
                  {u._id === me?._id && <Badge tone="brand">Vos</Badge>}
                </div>
                <p className="users-item-sub">
                  @{u.username} · {u.role} ·{" "}
                  <Badge tone={u.active ? "success" : "neutral"} outline>
                    {u.active ? "activo" : "inactivo"}
                  </Badge>
                </p>
              </div>
              <div className="ui-row users-item-actions">
                <Button variant="secondary" size="sm" onClick={() => startEdit(u)}>Editar</Button>
                {u._id !== me?._id && (
                  <Button variant="danger-ghost" size="sm" onClick={() => setConfirmData(u)}>
                    Eliminar
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {!users.length && (
            <EmptyState
              icon={<UsersIcon size={24} />}
              title="No hay usuarios"
              description="Creá el primer vendedor con el botón «Nuevo usuario»."
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmData)}
        title="Eliminar usuario"
        message={`¿Eliminar usuario "${confirmData?.username}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmData(null)}
        loading={deleting}
      />
    </div>
  );
}

/* ══════════════════════════════════════════
   SOLICITAR PERMISO — para vendedores sin acceso
══════════════════════════════════════════ */
function SolicitarPermisoSection({ permiso }) {
  const { user, token } = useAuth();
  const [estado, setEstado] = useState("idle");
  const [msg, setMsg] = useState("");

  const LABELS = {
    editarCategorias: "Editar categorías",
    crearProductos: "Crear productos",
    verEstadisticas: "Ver estadísticas",
    verOrdenes: "Ver órdenes",
    editarStockSolo: "Editar stock",
  };

  const enviarSolicitud = async () => {
    setEstado("loading");
    setMsg("");
    try {
      const res = await fetch(`${API_URL}/api/auth/request-permission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permiso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error al enviar solicitud");
      setEstado("ok");
      setMsg("Solicitud enviada. La administradora recibirá un email para aprobarte.");
    } catch (err) {
      setEstado("err");
      setMsg(err.message);
    }
  };

  return (
    <div className="section-narrow">
      <EmptyState
        icon={<LockIcon size={24} />}
        title={`Sin acceso a "${LABELS[permiso] || permiso}"`}
        description="No tenés permiso para esta sección. Podés enviarle una solicitud a la administradora para que te lo habilite."
        action={
          estado === "ok" ? (
            <div className="ui-banner ui-banner--success">{msg}</div>
          ) : (
            <Button onClick={enviarSolicitud} loading={estado === "loading"}>
              {estado === "loading" ? "Enviando…" : "Solicitar permiso"}
            </Button>
          )
        }
      />
      {msg && estado !== "ok" && <div className="ui-banner ui-banner--danger">{msg}</div>}
    </div>
  );
}
