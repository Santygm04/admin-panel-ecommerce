import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { Link, useLocation } from "react-router-dom";
import ProductList from "./ProductList";
import ProductForm from "./ProductForm";
import StatsPage from "./StatsPage";
import CategoryManager from "./CategoryManager";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Modal, Select } from "./ui";
import {
  CheckCircleIcon, EditIcon, EyeIcon, EyeOffIcon, InfoIcon, LockIcon, PlusIcon, TrashIcon, UsersIcon,
} from "./ui/icons";
import "./DashBoard.css";
import { API_URL } from "../utils/api";

const DEFAULT_USER_PERMISSIONS = {
  verEstadisticas: false,
  verOrdenes: true,
  editarCategorias: false,
  crearProductos: true,
  editarStockSolo: true,
};

const USER_PERMISSION_DEFINITIONS = [
  { key: "verEstadisticas", label: "Ver estadísticas", description: "Consulta ventas, ingresos y métricas del panel." },
  { key: "verOrdenes", label: "Ver órdenes", description: "Visualiza y gestiona el seguimiento de pedidos." },
  { key: "editarCategorias", label: "Editar categorías", description: "Crea, renombra y organiza categorías del catálogo." },
  { key: "crearProductos", label: "Crear productos", description: "Crea productos y edita la información del catálogo." },
  { key: "editarStockSolo", label: "Solo editar stock", description: "Actualiza existencias sin modificar el resto del producto." },
];

const USER_ROLE_DEFINITIONS = [
  { value: "vendedor", label: "Vendedor/a", description: "Opera el catálogo y las órdenes según los permisos elegidos." },
  { value: "admin", label: "Administradora", description: "Acceso completo a usuarios, configuración y todas las secciones." },
];

const emptyUserForm = () => ({
  username: "",
  password: "",
  name: "",
  role: "vendedor",
  active: true,
  permissions: { ...DEFAULT_USER_PERMISSIONS },
});

function userInitials(user) {
  const value = user?.name || user?.username || "U";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function userPermissionCount(user) {
  return USER_PERMISSION_DEFINITIONS.filter(({ key }) => Boolean(user?.permissions?.[key])).length;
}

function userRoleLabel(role) {
  return USER_ROLE_DEFINITIONS.find((item) => item.value === role)?.label || role || "Usuario";
}

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
        {vista === "crear" && (is("crearProductos") ? <ProductForm onCreated={() => setVista("stock")} /> : <SolicitarPermisoSection permiso="crearProductos" />)}
        {vista === "categorias" && (is("editarCategorias") ? <CategoryManager /> : <SolicitarPermisoSection permiso="editarCategorias" />)}
        {vista === "estadisticas" && (is("verEstadisticas") ? <StatsPage role={user?.role} /> : <SolicitarPermisoSection permiso="verEstadisticas" />)}
        {vista === "cuenta" && <CuentaSection />}
        {vista === "usuarios" && (user?.role === "admin" ? <UsuariosSection /> : <EmptyState icon={<LockIcon size={24} />} title="Sección restringida" description="Solo una administradora puede gestionar usuarios y permisos." />)}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════
   CUENTA — Cambiar contraseña
══════════════════════════════════════════ */
function CuentaSection() {
  const { changePassword, updateProfile, user } = useAuth();
  const [profile, setProfile] = useState({ username: "", name: "" });
  const [profileMsg, setProfileMsg] = useState({ text: "", ok: false });
  const [profileLoading, setProfileLoading] = useState(false);
  const [form, setForm] = useState({ actual: "", nueva: "", repetir: "" });
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProfile({ username: user?.username || "", name: user?.name || "" });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: "", ok: false });
    setProfileLoading(true);
    try {
      await updateProfile(profile);
      setProfileMsg({ text: "Datos de perfil actualizados.", ok: true });
    } catch (err) {
      setProfileMsg({ text: err?.message || "No se pudo actualizar el perfil.", ok: false });
    } finally {
      setProfileLoading(false);
    }
  };

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
        <CardTitle>Datos del perfil</CardTitle>
        <form onSubmit={saveProfile} className="section-form">
          {profileMsg.text && (
            <div className={`ui-banner ${profileMsg.ok ? "ui-banner--success" : "ui-banner--danger"}`} role="status">
              {profileMsg.text}
            </div>
          )}
          <Field label="Usuario" hint="Se usa para iniciar sesión">
            <Input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} required minLength={3} />
          </Field>
          <Field label="Nombre visible">
            <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <Button type="submit" loading={profileLoading}>{profileLoading ? "Guardando…" : "Guardar perfil"}</Button>
        </form>
      </Card>

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
           <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo">
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
  const [form, setForm] = useState(emptyUserForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setUsers(await getUsers()); } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const resetForm = () => {
    setForm(emptyUserForm());
    setShowPassword(false);
    setEditTarget(null);
    setShowForm(false);
  };

  const startEdit = (u) => {
    setEditTarget(u);
    setForm({
      username: u.username, password: "", name: u.name || "", role: u.role,
      active: u.active !== false,
      permissions: { ...DEFAULT_USER_PERMISSIONS, ...(u.permissions || {}) },
    });
    setShowPassword(false);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (editTarget) {
        const payload = { name: form.name, role: form.role, active: form.active, permissions: form.permissions };
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

  const activeUsers = users.filter((u) => u.active !== false).length;
  const vendors = users.filter((u) => u.role === "vendedor").length;
  const selectedPermissions = USER_PERMISSION_DEFINITIONS.filter(({ key }) => Boolean(form.permissions[key]));

  return (
    <div className="section-narrow users-section">
      <div className="section-head">
        <div className="users-section-intro">
          <p className="users-kicker"><UsersIcon size={15} /> Equipo del panel</p>
          <h2 className="st-title">Gestión de usuarios</h2>
          <p className="section-meta">Creá accesos, asigná responsabilidades y controlá quién puede operar cada parte del panel.</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <PlusIcon size={15} /> Nuevo usuario
        </Button>
      </div>

      {msg && <div className="ui-banner ui-banner--danger" role="alert">{msg}</div>}

      <div className="users-overview" aria-label="Resumen del equipo">
        <div className="users-overview-card">
          <span>Total de usuarios</span>
          <strong>{users.length}</strong>
          <small>Accesos registrados</small>
        </div>
        <div className="users-overview-card">
          <span>Cuentas activas</span>
          <strong>{activeUsers}</strong>
          <small>Con acceso al panel</small>
        </div>
        <div className="users-overview-card">
          <span>Vendedores</span>
          <strong>{vendors}</strong>
          <small>Con permisos configurables</small>
        </div>
      </div>

      <Modal
        open={showForm}
        wide
        title={editTarget ? "Editar usuario" : "Crear nuevo usuario"}
        subtitle={editTarget ? `Actualizá el acceso de @${editTarget.username}` : "Configurá la identidad, el rol y los permisos antes de habilitar el acceso."}
        onClose={saving ? undefined : resetForm}
        footer={(
          <>
            <Button variant="secondary" onClick={resetForm} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="user-form" loading={saving}>
              {saving ? "Guardando…" : editTarget ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </>
        )}
      >
        <form id="user-form" onSubmit={handleSubmit} className="users-form">
          <div className="users-form-intro">
            <div className="users-form-intro-icon"><UsersIcon size={21} /></div>
            <div>
              <strong>{editTarget ? "Revisá los cambios de acceso" : "Un acceso claro desde el primer día"}</strong>
              <p>El usuario solo verá y podrá operar las secciones que correspondan a su rol y permisos.</p>
            </div>
          </div>

          <div className="users-form-columns">
            <section className="users-form-section">
              <div className="users-form-section-head">
                <span className="users-form-step">01</span>
                <div>
                  <h3>Identidad y acceso</h3>
                  <p>Datos que usará para ingresar al panel.</p>
                </div>
              </div>
              {!editTarget ? (
                <Field htmlFor="user-username" label="Usuario de acceso" hint="3 a 64 caracteres: letras minúsculas, números, punto, guion o guion bajo" required>
                  <Input
                    id="user-username"
                    value={form.username}
                    autoComplete="username"
                    placeholder="ej. maria.garcia"
                    pattern="[a-z0-9._-]{3,64}"
                    title="Usá letras minúsculas, números, puntos, guiones o guiones bajos"
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                    required
                  />
                </Field>
              ) : (
                <div className="users-readonly-field">
                  <span>Usuario de acceso</span>
                  <strong>@{form.username}</strong>
                  <small>El identificador de inicio de sesión no se puede cambiar.</small>
                </div>
              )}
              <Field htmlFor="user-name" label="Nombre visible" hint="Cómo aparecerá dentro del panel">
                <Input
                  id="user-name"
                  value={form.name}
                  autoComplete="name"
                  placeholder="ej. María García"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field
                htmlFor="user-password"
                label={editTarget ? "Nueva contraseña" : "Contraseña inicial"}
                hint={editTarget ? "Dejá vacío para conservar la contraseña actual" : "Mínimo 8 caracteres: mayúscula, minúscula, número y símbolo (!@#$%^&*)"}
                required={!editTarget}
              >
                <div className="users-password-input">
                  <Input
                    id="user-password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    autoComplete={editTarget ? "new-password" : "new-password"}
                    minLength={8}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}"
                    title="Usá al menos 8 caracteres con mayúscula, minúscula, número y símbolo"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    {...(!editTarget && { required: true })}
                  />
                  <button
                    type="button"
                    className="users-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
                  </button>
                </div>
              </Field>
            </section>

            <section className="users-form-section">
              <div className="users-form-section-head">
                <span className="users-form-step">02</span>
                <div>
                  <h3>Rol y estado</h3>
                  <p>Definí el alcance general de esta cuenta.</p>
                </div>
              </div>
              <fieldset className="users-role-options">
                <legend>Elegí un rol</legend>
                {USER_ROLE_DEFINITIONS.map(({ value, label, description }) => (
                  <label key={value} className={`users-role-option ${form.role === value ? "is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="user-role"
                      value={value}
                      checked={form.role === value}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    />
                    <span className="users-role-copy">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    {form.role === value && <CheckCircleIcon size={18} />}
                  </label>
                ))}
              </fieldset>

              {editTarget ? (
                <label className="users-status-toggle">
                  <input
                    type="checkbox"
                    checked={form.active}
                    disabled={editTarget._id === me?._id}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  <span>
                    <strong>{form.active ? "Cuenta activa" : "Cuenta bloqueada"}</strong>
                    <small>{editTarget._id === me?._id ? "No podés desactivar tu propia cuenta." : form.active ? "Puede iniciar sesión y usar sus permisos." : "No podrá iniciar sesión hasta reactivarla."}</small>
                  </span>
                  <Badge tone={form.active ? "success" : "neutral"} outline>{form.active ? "Activa" : "Inactiva"}</Badge>
                </label>
              ) : (
                <div className="users-status-note">
                  <CheckCircleIcon size={18} />
                  <span><strong>La cuenta se creará activa</strong><small>Podés bloquearla más adelante desde Editar.</small></span>
                </div>
              )}
            </section>
          </div>

          <section className="users-form-section users-permissions-section">
            <div className="users-form-section-head">
              <span className="users-form-step">03</span>
              <div>
                <h3>Permisos operativos</h3>
                <p>Seleccioná exactamente qué puede hacer esta persona.</p>
              </div>
            </div>
            {form.role === "admin" && (
              <div className="users-admin-note" role="status">
                <InfoIcon size={18} />
                <span><strong>Acceso total por rol</strong> Las administradoras pueden acceder a todas las secciones, aunque estos permisos no estén seleccionados.</span>
              </div>
            )}
            <div className="users-permission-grid">
              {USER_PERMISSION_DEFINITIONS.map(({ key, label, description }) => (
                <label key={key} className={`users-permission-option ${form.permissions[key] ? "is-selected" : ""} ${form.role === "admin" ? "is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={!!form.permissions[key]}
                    disabled={form.role === "admin"}
                    onChange={() => togglePerm(key)}
                  />
                  <span className="users-permission-copy">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <div className="users-access-summary">
            <div className="users-access-summary-icon"><CheckCircleIcon size={19} /></div>
            <div className="users-access-summary-copy">
              <div className="users-access-summary-head">
                <strong>Vista previa del acceso</strong>
                <Badge tone="brand">{form.role === "admin" ? "Acceso total" : `${selectedPermissions.length} permisos`}</Badge>
              </div>
              <p>{form.role === "admin" ? "Podrá administrar usuarios, catálogo, órdenes, estadísticas y configuración." : selectedPermissions.length ? "Podrá operar únicamente estas funciones:" : "No tendrá funciones operativas hasta que selecciones un permiso."}</p>
              {form.role !== "admin" && (
                <div className="users-access-chips">
                  {selectedPermissions.length ? selectedPermissions.map(({ key, label }) => <span key={key}>{label}</span>) : <span className="is-muted">Sin permisos seleccionados</span>}
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

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
              <div className="users-item-main">
                <div className="users-avatar" aria-hidden="true">{userInitials(u)}</div>
                <div className="users-item-meta">
                  <div className="ui-row">
                    <strong className="users-item-name">{u.name || u.username}</strong>
                    {u._id === me?._id && <Badge tone="brand">Vos</Badge>}
                  </div>
                  <p className="users-item-sub">
                    @{u.username} · {userRoleLabel(u.role)} · <Badge tone={u.active !== false ? "success" : "neutral"} outline dot>{u.active !== false ? "Activo" : "Inactivo"}</Badge>
                  </p>
                </div>
              </div>
              <div className="users-item-access">
                <strong>{u.role === "admin" ? "Acceso total" : `${userPermissionCount(u)} permisos activos`}</strong>
                <small>{u.role === "admin" ? "Todas las secciones" : "Según configuración"}</small>
              </div>
              <div className="ui-row users-item-actions">
                <Button variant="secondary" size="sm" onClick={() => startEdit(u)}><EditIcon size={14} /> Editar</Button>
                {u._id !== me?._id && (
                  <Button variant="danger-ghost" size="sm" onClick={() => setConfirmData(u)}>
                    <TrashIcon size={14} />
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
