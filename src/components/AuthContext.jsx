// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "../utils/api";

const AuthContext = createContext();
const LS_KEY = "aesthetic:token";
const LS_USER = "aesthetic:user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(LS_KEY) || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(LS_USER) || "null"); } catch { return null; }
  });

  // Loader de sesión: true mientras se valida el token guardado al arrancar
  const [bootstrapping, setBootstrapping] = useState(() => !!sessionStorage.getItem(LS_KEY));

  // ADMIN_SECRET eliminado del frontend — se usa solo JWT

  const isAuthenticated = !!token;

  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "No se pudo iniciar sesión");
   sessionStorage.setItem(LS_KEY, data.token);
 sessionStorage.setItem(LS_USER, JSON.stringify(data.user));
setToken(data.token);
setUser(data.user);
return data.user;
  };

  const logout = () => {
    if (token) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }
    sessionStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(LS_USER);
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
    if (data.token) {
      sessionStorage.setItem(LS_KEY, data.token);
      setToken(data.token);
    }
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
      sessionStorage.setItem(LS_KEY, data.token);
      setToken(data.token);
    }
    if (data.user) {
      sessionStorage.setItem(LS_USER, JSON.stringify(data.user));
      setUser(data.user);
    }
    return data.user;
  };

  // opcional: ping /me para validar token cuando cambia
  useEffect(() => {
    let ignore = false;
    if (!token) {
      setBootstrapping(false);
      return;
    }
    setBootstrapping(true);
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
      } finally {
        if (!ignore) setBootstrapping(false);
      }
    })();
    return () => { ignore = true; };
  }, [token]);

  const API_URL_CTX = API_URL;

  const getUsers = async () => {
    const res = await fetch(`${API_URL_CTX}/api/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al listar usuarios");
    return data.users;
  };

  const createUser = async (payload) => {
    const res = await fetch(`${API_URL_CTX}/api/auth/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al crear usuario");
    return data.user;
  };

  const updateUser = async (id, payload) => {
    const res = await fetch(`${API_URL_CTX}/api/auth/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al actualizar usuario");
    if (data.token) {
      sessionStorage.setItem(LS_KEY, data.token);
      setToken(data.token);
    }
    return data.user;
  };

  const deleteUser = async (id) => {
    const res = await fetch(`${API_URL_CTX}/api/auth/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al eliminar usuario");
    return true;
  };

  const getAuditLogs = async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, value);
    });
    const res = await fetch(`${API_URL_CTX}/api/audit?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al cargar la auditoría");
    return data;
  };

  const value = useMemo(
    () => ({ token, user, isAuthenticated, bootstrapping, login, logout, changePassword, updateProfile, getUsers, createUser, updateUser, deleteUser, getAuditLogs }),
    [token, user, isAuthenticated, bootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
