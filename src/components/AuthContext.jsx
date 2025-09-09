// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const LS_KEY = "aesthetic:token";
const LS_USER = "aesthetic:user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_USER) || "null"); } catch { return null; }
  });

  const isAuthenticated = !!token;

  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "No se pudo iniciar sesión");
    localStorage.setItem(LS_KEY, data.token);
    localStorage.setItem(LS_USER, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_USER);
    setToken("");
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!token) throw new Error("No autenticado");
    const res = await fetch(`${API_URL}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "No se pudo cambiar la contraseña");
    return true;
  };

  const updateProfile = async ({ username, name }) => {
    if (!token) throw new Error("No autenticado");
    const res = await fetch(`${API_URL}/api/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "No se pudo actualizar el perfil");

    // si viene un token nuevo, reemplazarlo
    if (data.token) {
      localStorage.setItem(LS_KEY, data.token);
      setToken(data.token);
    }
    if (data.user) {
      localStorage.setItem(LS_USER, JSON.stringify(data.user));
      setUser(data.user);
    }
    return data.user;
  };

  // opcional: ping /me para validar token cuando cambia
  useEffect(() => {
    let ignore = false;
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!ignore && d?.user) setUser((u) => ({ ...u, ...d.user }));
      } catch {
        if (!ignore) logout();
      }
    })();
    return () => { ignore = true; };
  }, [token]);

  const value = useMemo(
    () => ({ token, user, isAuthenticated, login, logout, changePassword, updateProfile }),
    [token, user, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
