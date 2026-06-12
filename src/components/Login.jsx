import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import "./Login.css";

export default function Login() {
  const [form, setForm]     = useState({ usuario: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");
  const [toast, setToast]     = useState("");

  const { login } = useAuth();
  const navigate  = useNavigate();

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
      setToast(`¡Bienvenida, ${niceName(form.usuario)}!`);
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      setMsg(err?.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── Panel izquierdo decorativo ── */}
      <div className="login-left" aria-hidden="true">
        <div className="login-left-inner">
          <div className="login-left-glow" />
          <img
  src={new URL("../assets/logo-aesthetic.png", import.meta.url).href}
  alt="Aesthetic"
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

      {/* ── Panel derecho (form) ── */}
      <div className="login-right">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>

          {/* Logo SVG inline */}
          <div className="login-logo">
            <svg viewBox="0 0 220 70" xmlns="http://www.w3.org/2000/svg" aria-label="Aesthetic">
              <text x="10" y="52"
                fontFamily="'Brush Script MT', 'Segoe Script', cursive"
                fontSize="52" fill="#ff2ea6" letterSpacing="-1">
                Aesthetic
              </text>
              <text x="14" y="66"
                fontFamily="'Segoe UI', system-ui, sans-serif"
                fontSize="11" fill="#e11a8a" letterSpacing="3">
                ACCESORIOS Y MAKEUP
              </text>
            </svg>
          </div>

          <p className="login-subtitle">Iniciá sesión para continuar</p>

          {msg && <div className="login-banner error" role="alert">{msg}</div>}

          {/* Usuario */}
          <div className="field">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <input
              className="input-field"
              type="text"
              name="usuario"
              placeholder="Usuario"
              autoComplete="username"
              value={form.usuario}
              onChange={(e) => setForm({ ...form, usuario: e.target.value })}
              required
            />
          </div>

          {/* Contraseña */}
          <div className="field">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              className="input-field"
              type={showPwd ? "text" : "password"}
              name="password"
              placeholder="Contraseña"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPwd(s => !s)}
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPwd
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Ingresando…" : "INGRESAR"}
          </button>

        </form>
      </div>

      {toast && (
        <div className="toast-overlay" role="dialog" aria-modal="true">
          <div className="toast-modal"><h3>{toast}</h3></div>
        </div>
      )}
    </div>
  );
}