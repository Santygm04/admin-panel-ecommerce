import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Login() {
  const [form,       setForm]       = useState({ usuario: "", password: "" });
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState("");
  const [toast,      setToast]      = useState("");
  const [showChange, setShowChange] = useState(false);
  const [cp,         setCp]         = useState({ usuario: "", actual: "", nueva: "" });
  const [cpMsg,      setCpMsg]      = useState("");
  const [cpLoading,  setCpLoading]  = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  const niceName = (raw) => {
    const base  = String(raw || "").trim();
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
      setToast(`¡Bienvenida, ${niceName(form.usuario)}!`);
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      setMsg(err?.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  const submitChangePass = async (e) => {
    e.preventDefault();
    setCpMsg("");
    if (!cp.actual || !cp.nueva)       { setCpMsg("Completá la contraseña actual y la nueva."); return; }
    if (cp.nueva.length < 6)           { setCpMsg("La nueva contraseña debe tener al menos 6 caracteres."); return; }
    setCpLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: cp.usuario || form.usuario, actual: cp.actual, nueva: cp.nueva }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "No se pudo cambiar la contraseña");
      setCpMsg("✅ Contraseña actualizada.");
      setCp({ usuario: "", actual: "", nueva: "" });
      setTimeout(() => setShowChange(false), 900);
    } catch (err) {
      setCpMsg("❌ " + (err?.message || "Error"));
    } finally {
      setCpLoading(false);
    }
  };

  /* ── Campo de input reutilizable ── */
  const Field = ({ icon, ...props }) => (
    <div className="flex items-center gap-2 bg-[#1f2029] rounded-xl px-3 py-2.5 border border-white/5 mt-2">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" className="w-4 h-4 fill-[#ffeba7] flex-shrink-0" aria-hidden="true">
        <path d={icon} />
      </svg>
      <input className="flex-1 bg-transparent border-none outline-none text-[#e4e4e4] font-bold text-sm placeholder-[#9aa0a6] focus:placeholder-transparent transition-all" {...props} />
    </div>
  );

  const ICON_USER = "M207.8 20.73c-93.45 18.32-168.7 93.66-187 187.1c-27.64 140.9 68.65 266.2 199.1 285.1c19.01 2.888 36.17-12.26 36.17-31.49l.0001-.6631c0-15.74-11.44-28.88-26.84-31.24c-84.35-12.98-149.2-86.13-149.2-174.2c0-102.9 88.61-185.5 193.4-175.4c91.54 8.869 158.6 91.25 158.6 183.2l0 16.16c0 22.09-17.94 40.05-40 40.05s-40.01-17.96-40.01-40.05v-120.1c0-8.847-7.161-16.02-16.01-16.02l-31.98 .0036c-7.299 0-13.2 4.992-15.12 11.68c-24.85-12.15-54.24-16.38-86.06-5.106c-38.75 13.73-68.12 48.91-73.72 89.64c-9.483 69.01 43.81 128 110.9 128c26.44 0 50.43-9.544 69.59-24.88c24 31.3 65.23 48.69 109.4 37.49C465.2 369.3 496 324.1 495.1 277.2V256.3C495.1 107.1 361.2-9.332 207.8 20.73zM239.1 304.3c-26.47 0-48-21.56-48-48.05s21.53-48.05 48-48.05s48 21.56 48 48.05S266.5 304.3 239.1 304.3z";
  const ICON_LOCK = "M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z";

  return (
    <div className="min-h-screen grid place-items-center bg-[#222] px-4" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>

      {/* ── Tarjeta ── */}
      <form
        className="w-full max-w-[320px] bg-[#2a2b38] rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.35)] p-7 text-center"
        onSubmit={handleSubmit}
      >
        <p className="text-[#f5f5f5] font-black text-2xl mb-4 m-0">Log In!</p>

        {msg && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-[#ffe9ea] text-[#b10000] border border-[#ffc8cc] text-sm font-black text-left">
            {msg}
          </div>
        )}

        <Field icon={ICON_USER} type="text"     name="usuario"  placeholder="Email o usuario"  autoComplete="username"         onChange={e => setForm({ ...form, usuario:  e.target.value })} required />
        <Field icon={ICON_LOCK} type="password" name="password" placeholder="Password"         autoComplete="current-password" onChange={e => setForm({ ...form, password: e.target.value })} required />

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-5 mb-2 py-3 rounded-xl font-black text-sm uppercase tracking-wide bg-[#ffeba7] text-[#2a2b38] shadow-[0_12px_32px_rgba(255,235,167,0.22)] transition-all duration-200 hover:bg-[#5e6681] hover:text-[#ffeba7] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer border-0"
        >
          {loading ? "Ingresando…" : "LOGIN"}
        </button>

        {/* Toggle cambiar contraseña */}
        <button
          type="button"
          onClick={() => { setShowChange(s => !s); setCpMsg(""); }}
          className="text-[#f5f5f5] text-xs underline font-black bg-transparent border-0 cursor-pointer hover:text-[#ffeba7] transition-colors mt-1"
        >
          {showChange ? "Ocultar" : "Forgot your password?"}
        </button>

        {/* Panel cambio de contraseña */}
        {showChange && (
          <form
            className="mt-3 bg-[#1f2029] border border-white/5 rounded-xl p-3 text-left"
            onSubmit={submitChangePass}
          >
            {cpMsg && (
              <div className="mb-2 px-2.5 py-2 rounded-lg bg-[#f0f9ff] text-[#075985] border border-[#bae6fd] text-xs font-bold">
                {cpMsg}
              </div>
            )}
            {[
              { placeholder: "Usuario (opcional)",    value: cp.usuario, key: "usuario", type: "text",     ac: "username"         },
              { placeholder: "Contraseña actual",     value: cp.actual,  key: "actual",  type: "password",  ac: "current-password" },
              { placeholder: "Nueva contraseña",      value: cp.nueva,   key: "nueva",   type: "password",  ac: "new-password"     },
            ].map(({ placeholder, value, key, type, ac }) => (
              <input key={key} className="w-full mt-2 px-3 py-2.5 rounded-xl bg-[#2a2b38] text-[#e4e4e4] text-sm border border-white/5 outline-none placeholder-[#9aa0a6]" type={type} placeholder={placeholder} value={value} onChange={e => setCp({ ...cp, [key]: e.target.value })} autoComplete={ac} />
            ))}
            <button
              type="submit"
              disabled={cpLoading}
              className="w-full mt-3 py-2.5 rounded-xl bg-[#5e6681] text-[#ffeba7] font-black text-sm cursor-pointer border-0 hover:bg-[#6b7391] transition-colors disabled:opacity-60"
            >
              {cpLoading ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </form>
        )}
      </form>

      {/* ── Toast de bienvenida ── */}
      {toast && (
        <div className="fixed inset-0 bg-black/55 grid place-items-center z-[3000] animate-[fadeIn_.15s_ease-out]" role="dialog" aria-modal="true">
          <div className="min-w-[260px] max-w-[88vw] bg-white text-[#0f7b42] border-2 border-[#b8f0d0] rounded-2xl px-6 py-5 text-center font-black shadow-[0_20px_60px_rgba(0,0,0,0.35)] animate-[popIn_.18s_ease-out]">
            <h3 className="m-0 text-lg">{toast}</h3>
          </div>
        </div>
      )}

      {/* Keyframes para las animaciones del toast */}
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { from{transform:scale(.92)} to{transform:scale(1)} }
      `}</style>
    </div>
  );
}