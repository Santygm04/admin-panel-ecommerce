import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthContext";
import ProtectedRoute from "./components/ProtectRoute";
import Layout from "./components/Layout";

import ProductForm from "./components/ProductForm";
import ProductEdit from "./components/ProductEdit";
import DashBoard from "./components/DashBoard";
import Login from "./components/Login";
import AdminOrders from "./components/AdminOrders";
import ErpView from "./components/ErpView";
import Promotions from "./components/Promotions";
import AuditPage from "./components/AuditPage";

// Splash de sesión: se muestra mientras se valida el token guardado
function SessionSplash() {
  return (
    <div className="session-splash" role="status" aria-label="Cargando sesión">
      <div className="session-splash-logo">
        <img src={new URL("./assets/logo-aesthetic.png", import.meta.url).href} alt="" />
      </div>
      <div className="session-splash-spinner" />
      <p>Cargando tu sesión…</p>
    </div>
  );
}

function AppRoutes() {
  const { bootstrapping, user } = useAuth();
  if (bootstrapping) return <SessionSplash />;
  const can = (permission) => user?.role === "admin" || user?.permissions?.[permission] === true;
  return (
    <Routes>
      {/* Entrada */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* Privadas con layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout>
              <Outlet />
            </Layout>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashBoard />} />
         <Route path="/crear" element={can("crearProductos") ? <ProductForm /> : <Navigate to="/dashboard" replace />} />
        {/* "Productos" se gestiona desde el Panel (tab stock): redirigimos */}
        <Route path="/listar" element={<Navigate to="/dashboard?tab=stock" replace />} />
         <Route path="/editar/:id" element={can("crearProductos") || can("editarStockSolo") ? <ProductEdit /> : <Navigate to="/dashboard" replace />} />
         <Route path="/orders" element={can("verOrdenes") ? <AdminOrders /> : <Navigate to="/dashboard" replace />} />
         <Route path="/erp" element={user?.role === "admin" ? <ErpView /> : <Navigate to="/dashboard" replace />} />
         <Route path="/promociones" element={user?.role === "admin" ? <Promotions /> : <Navigate to="/dashboard" replace />} />
         <Route path="/auditoria" element={user?.role === "admin" ? <AuditPage /> : <Navigate to="/dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
