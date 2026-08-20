import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./components/AuthContext";
import ProtectedRoute from "./components/ProtectRoute";
import Layout from "./components/Layout";

import ProductForm from "./components/ProductForm";
import ProductEdit from "./components/ProductEdit";
import DashBoard from "./components/DashBoard";
import Login from "./components/Login";
import AdminOrders from "./components/AdminOrders";
import ErpView from "./components/ErpView";
import { ToastContainer } from "react-toastify";

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
  const { bootstrapping } = useAuth();
  if (bootstrapping) return <SessionSplash />;
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
        <Route path="/crear" element={<ProductForm />} />
        {/* "Productos" se gestiona desde el Panel (tab stock): redirigimos */}
        <Route path="/listar" element={<Navigate to="/dashboard?tab=stock" replace />} />
        <Route path="/editar/:id" element={<ProductEdit />} />
        <Route path="/orders" element={<AdminOrders />} />
        <Route path="/erp" element={<ErpView />} />
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
        <ToastContainer
          position="top-right"
          autoClose={8000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick={false}
          pauseOnFocusLoss
          pauseOnHover
          theme="dark"
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
