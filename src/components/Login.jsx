import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import { Button, Field, Input, ThemeToggle } from "./ui";
import { LockIcon, UsersIcon, EyeIcon, EyeOffIcon } from "./ui/icons";
import "./Login.css";

export default function Login() {
  const [form, setForm] = useState({ usuario: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const niceName = (raw) => {
    const first = String(raw || "").trim().split(/[@._\s]/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : "¡Bienvenida!";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      await login(form.usuario, form.password);
      toast.success(`¡Bienvenida, ${niceName(form.usuario)}!`);
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err) {
      setMsg(err?.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <ThemeToggle className="login-theme-toggle" />

      {/* Panel izquierdo de marca */}
      <div className="login-left" aria-hidden="true">
        <div className="login-left-inner">
          <div className="login-left-glow" />
          <img
            src={new URL("../assets/logo-aesthetic.png", import.meta.url).href}
            alt=""
            className="login-left-logo"
          />
          <div className="login-deco-text">
            <span>Panel de</span>
            <span>Administración</span>
          </div>
          <div className="login-deco-dots">
            {Array.from({ length: 20 }).map((_, i) => (
              <span key={i} className="login-dot" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho (form) */}
      <div className="login-right">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <div className="login-card-head">
            <div className="login-badge" aria-hidden="true">
              <img
                src={new URL("../assets/logo-aesthetic.png", import.meta.url).href}
                alt=""
              />
            </div>
            <h1 className="login-title">Aesthetic</h1>
            <p className="login-subtitle">Iniciá sesión para continuar</p>
          </div>

          {msg && (
            <div className="ui-banner ui-banner--danger" role="alert">
              {msg}
            </div>
          )}

          <Field label="Usuario" htmlFor="login-usuario">
            <Input
              id="login-usuario"
              type="text"
              name="usuario"
              placeholder="Tu usuario"
              autoComplete="username"
              icon={<UsersIcon size={16} />}
              value={form.usuario}
              onChange={(e) => setForm({ ...form, usuario: e.target.value })}
              required
              autoFocus
            />
          </Field>

          <Field label="Contraseña" htmlFor="login-password">
            <div className="login-pwd-wrap">
              <Input
                id="login-password"
                type={showPwd ? "text" : "password"}
                name="password"
                placeholder="Tu contraseña"
                autoComplete="current-password"
                icon={<LockIcon size={16} />}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="login-pwd-toggle"
                onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPwd ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
          </Field>

          <Button type="submit" size="lg" loading={loading} className="login-submit">
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>

          <p className="login-foot">Aesthetic · Accesorios y Makeup</p>
        </form>
      </div>
    </div>
  );
}
