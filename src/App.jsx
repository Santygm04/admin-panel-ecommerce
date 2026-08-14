import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "./components/AuthContext";
import ProtectedRoute from "./components/ProtectRoute";
import Layout from "./components/Layout";

import ProductForm from "./components/ProductForm";
import ProductList from "./components/ProductList";
import ProductEdit from "./components/ProductEdit";
import DashBoard from "./components/DashBoard";
import Login from "./components/Login";
import AdminOrders from "./components/AdminOrders";
import ErpView from "./components/ErpView";
import { ToastContainer } from "react-toastify";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <Route path="/listar" element={<ProductList />} />
            <Route path="/editar/:id" element={<ProductEdit />} />
            <Route path="/orders" element={<AdminOrders />} />
            <Route path="/erp" element={<ErpView />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          pauseOnHover
          theme="dark"
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
