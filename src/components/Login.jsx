import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import "../../src/components/Login.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Login() {
  const [form, setForm] = useState({ usuario: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState(""); // cartel de bienvenida (modal centrado)

  // Cambiar contraseña
  const [showChange, setShowChange] = useState(false);
  const [cp, setCp] = useState({ usuario: "", actual: "", nueva: "" });
  const [cpMsg, setCpMsg] = useState("");
  const [cpLoading, setCpLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const niceName = (raw) => {
    const base = String(raw || "").trim();
    if (!base) return "¡Bienvenid@!";
    const first = base.split(/[@._\s]/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      await login(form.usuario, form.password);

      // cartel de bienvenida modal (centrado)
      const name = niceName(form.usuario);
      setToast(`¡Bienvenida, ${name}!`);
      setTimeout(() => {
        navigate("/dashboard");
      }, 900);
    } catch (err) {
      setMsg(err?.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  // ===== Cambiar contraseña
  const submitChangePass = async (e) => {
    e.preventDefault();
    setCpMsg("");
    if (!cp.actual || !cp.nueva) {
      setCpMsg("Completá la contraseña actual y la nueva.");
      return;
    }
    if (cp.nueva.length < 6) {
      setCpMsg("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCpLoading(true);
    try {
      const body = {
        usuario: cp.usuario || form.usuario,
        actual: cp.actual,
        nueva: cp.nueva,
      };
      const r = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "No se pudo cambiar la contraseña");
      setCpMsg("✅ Contraseña actualizada correctamente.");
      setCp({ usuario: "", actual: "", nueva: "" });
      setTimeout(() => setShowChange(false), 900);
    } catch (err) {
      setCpMsg("❌ " + (err?.message || "Error al cambiar la contraseña"));
    } finally {
      setCpLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="title">Log In!</p>

        {msg && <div className="login-banner error">{msg}</div>}

        <div className="field">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" className="input-icon" aria-hidden="true">
            <path d="M207.8 20.73c-93.45 18.32-168.7 93.66-187 187.1c-27.64 140.9 68.65 266.2 199.1 285.1c19.01 2.888 36.17-12.26 36.17-31.49l.0001-.6631c0-15.74-11.44-28.88-26.84-31.24c-84.35-12.98-149.2-86.13-149.2-174.2c0-102.9 88.61-185.5 193.4-175.4c91.54 8.869 158.6 91.25 158.6 183.2l0 16.16c0 22.09-17.94 40.05-40 40.05s-40.01-17.96-40.01-40.05v-120.1c0-8.847-7.161-16.02-16.01-16.02l-31.98 .0036c-7.299 0-13.2 4.992-15.12 11.68c-24.85-12.15-54.24-16.38-86.06-5.106c-38.75 13.73-68.12 48.91-73.72 89.64c-9.483 69.01 43.81 128 110.9 128c26.44 0 50.43-9.544 69.59-24.88c24 31.3 65.23 48.69 109.4 37.49C465.2 369.3 496 324.1 495.1 277.2V256.3C495.1 107.1 361.2-9.332 207.8 20.73zM239.1 304.3c-26.47 0-48-21.56-48-48.05s21.53-48.05 48-48.05s48 21.56 48 48.05S266.5 304.3 239.1 304.3z"></path>
          </svg>
          <input
            className="input-field"
            type="text"
            name="usuario"
            placeholder="Email o usuario"
            autoComplete="username"
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" className="input-icon" aria-hidden="true">
            <path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path>
          </svg>
          <input
            className="input-field"
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Ingresando…" : "LOGIN"}
        </button>

        {/* <a className="btn-link" href="#" onClick={(e) => e.preventDefault()}>
          Forgot your password?
        </a> */}

        {/* Toggle cambiar contraseña */}
        <button
          type="button"
          className="btn-link link-strong"
          onClick={() => {
            setShowChange(s => !s);
            setCpMsg("");
          }}
        >
          {showChange ? "Ocultar cambiar contraseña" : " Forgot your password?"}
        </button>

        {showChange && (
          <form className="cp-card" onSubmit={submitChangePass}>
            {cpMsg && <div className="login-banner" style={{background:"#f0f9ff", color:"#075985", border:"1px solid #bae6fd"}}>{cpMsg}</div>}

            <input
              className="cp-input"
              placeholder="Usuario (opcional)"
              value={cp.usuario}
              onChange={(e)=> setCp({...cp, usuario: e.target.value})}
              autoComplete="username"
            />
            <input
              className="cp-input"
              placeholder="Contraseña actual"
              type="password"
              value={cp.actual}
              onChange={(e)=> setCp({...cp, actual: e.target.value})}
              autoComplete="current-password"
              required
            />
            <input
              className="cp-input"
              placeholder="Nueva contraseña"
              type="password"
              value={cp.nueva}
              onChange={(e)=> setCp({...cp, nueva: e.target.value})}
              autoComplete="new-password"
              required
            />
            <button className="btn btn-secondary" disabled={cpLoading}>
              {cpLoading ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </form>
        )}
      </form>

      {/* Cartel modal centrado */}
      {toast && (
        <div className="toast-overlay" role="dialog" aria-modal="true">
          <div className="toast-modal">
            <h3>{toast}</h3>
          </div>
        </div>
      )}
    </div>
  );
}
