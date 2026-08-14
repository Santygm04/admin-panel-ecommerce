import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ReceiptText, Package, Upload, FolderOpen,
  BarChart3, LockKeyhole, Users, Store,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { Badge, ThemeToggle } from './ui';
import { PackageIcon, LogoutIcon, XIcon, MenuIcon } from './ui/icons';
import './Layout.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const adminSecret = useMemo(() => sessionStorage.getItem('ADMIN_SECRET') || '', []);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!adminSecret) return;
    let abort = false;
    const fetchCount = async () => {
      try {
        const url = new URL(`${API_URL}/api/payments/orders`);
        url.searchParams.set('status', 'pending');
        const res = await fetch(url, { headers: { 'x-admin-secret': adminSecret } });
        const data = await res.json();
        if (!res.ok) throw new Error();
        if (!abort) setPendingCount((data.orders || []).length);
      } catch {
        if (!abort) setPendingCount(0);
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 10000);
    return () => {
      abort = true;
      clearInterval(id);
    };
  }, [adminSecret]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const can = (perm) => user?.role === 'admin' || Boolean(user?.permissions?.[perm]);

  const nav = [
    { to: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={18} />, show: true },
    { to: '/orders', label: 'Órdenes', icon: <ReceiptText size={18} />, show: can('verOrdenes'), badge: pendingCount },
    { to: '/listar', label: 'Productos', icon: <Package size={18} />, show: can('verOrdenes') },
    { to: '/crear', label: 'Subir producto', icon: <Upload size={18} />, show: can('crearProductos') },
    { to: '/dashboard?tab=categorias', label: 'Categorías', icon: <FolderOpen size={18} />, show: can('editarCategorias') },
    { to: '/dashboard?tab=estadisticas', label: 'Estadísticas', icon: <BarChart3 size={18} />, show: can('verEstadisticas') },
    { to: '/dashboard?tab=cuenta', label: 'Mi cuenta', icon: <LockKeyhole size={18} />, show: true },
    { to: '/dashboard?tab=usuarios', label: 'Usuarios', icon: <Users size={18} />, show: user?.role === 'admin' },
    { to: '/erp', label: 'ERP Aesthetic', icon: <Store size={18} />, show: true },
  ].filter((n) => n.show);

  const currentFull = `${location.pathname}${location.search}`;

  const navEl = (
    <nav className="layout-nav" aria-label="Navegación principal">
      {nav.map((item) => {
        const isActive = item.to.includes('?')
          ? currentFull === item.to
          : item.to === '/dashboard'
            ? location.pathname === '/dashboard' && !location.search
            : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`layout-nav-item ${isActive ? 'is-active' : ''}`.trim()}
            onClick={() => setMenuOpen(false)}
          >
            <span className="layout-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="layout-nav-label">{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <Badge tone="danger" className="layout-nav-badge">{item.badge}</Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const initials = (user?.name || user?.username || 'A').trim().slice(0, 2).toUpperCase();

  return (
    <div className="layout">
      <aside className={`layout-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="layout-brand">
          <span className="layout-brand-badge">
            <img src={new URL('../assets/logo-aesthetic.png', import.meta.url).href} alt="" />
          </span>
          <div className="layout-brand-text">
            <strong>Aesthetic</strong>
            <small>Panel de Administración</small>
          </div>
          <button
            type="button"
            className="layout-menu-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <XIcon size={18} />
          </button>
        </div>
        {navEl}
        <div className="layout-sidebar-foot">
          <div className="layout-user">
            <span className="layout-user-avatar">{initials}</span>
            <div className="layout-user-meta">
              <strong>{user?.name || user?.username || '—'}</strong>
              <small>@{user?.username} · {user?.role === 'admin' ? 'Administradora' : 'Vendedor/a'}</small>
            </div>
          </div>
          <button type="button" className="layout-logout" onClick={handleLogout}>
            <LogoutIcon size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="layout-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      <div className="layout-main">
        <header className="layout-topbar">
          <button
            type="button"
            className="layout-menu-open"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <MenuIcon size={20} />
          </button>
          <div className="layout-topbar-title">
            <PackageIcon size={18} />
            <span>Aesthetic · Administración</span>
          </div>
          <div className="ui-spacer" />
          <div className="layout-view-switch" role="tablist" aria-label="Selector de vista">
            <button
              type="button"
              className={`layout-view-btn ${location.pathname !== '/erp' ? 'is-active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard size={14} /> Tienda Online
            </button>
            <button
              type="button"
              className={`layout-view-btn ${location.pathname === '/erp' ? 'is-active' : ''}`}
              onClick={() => navigate('/erp')}
            >
              <Store size={14} /> ERP Aesthetic
            </button>
          </div>
          <ThemeToggle />
        </header>
        <main className="layout-content">{children}</main>
      </div>
    </div>
  );
}
