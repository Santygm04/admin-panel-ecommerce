// ErpView.jsx — Vista del ERP Aesthetic (Santiago) desde el panel.
// Consume el proxy del backend Aesthetic (/api/integration/aesthetic/*).
// - Resumen / Productos / Ventas / Stats: solo lectura.
// - Productos: EDITABLES (nombre, precio, costo, stock, activo) + archivar.
// - Ventas: detalle completo de cada venta online.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Tabs } from './ui';
import { useTheme } from '../theme/ThemeContext';
import {
  StoreIcon, SearchIcon, AlertIcon, CoinsIcon, ShoppingBagIcon, TargetIcon, BoxesIcon,
  EditIcon, TrashIcon, EyeIcon, TruckIcon, CheckCircleIcon,
} from './ui/icons';
import ConfirmDialog from './ConfirmDialog';
import './ErpView.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const money = (n) =>
  Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const moneyShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
};

const STATUS = {
  completada: { lbl: 'Completada', tone: 'success' },
  pendiente: { lbl: 'Pendiente', tone: 'warning' },
  cancelada: { lbl: 'Cancelada', tone: 'danger' },
  devuelta_parcial: { lbl: 'Dev. parcial', tone: 'info' },
  devuelta_total: { lbl: 'Dev. total', tone: 'neutral' },
};

function useChartPalette() {
  useTheme();
  const css = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  return {
    brand: css('--adm-brand', '#ff5aa8'),
    gold: css('--adm-gold', '#e8c56a'),
    grid: css('--adm-border', '#332b49'),
    tick: css('--adm-muted', '#a89fbb'),
  };
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="erp-tip">
      <span className="erp-tip-label">{label}</span>
      {payload.map((p) => (
        <span key={p.dataKey} className="erp-tip-row">
          <i style={{ background: p.color || p.fill }} />
          {p.name}: <b>{money(p.value)}</b>
        </span>
      ))}
    </div>
  );
}

export default function ErpView() {
  const [tab, setTab] = useState('resumen');
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState([]);
  const [products, setProducts] = useState({ items: [], total: 0, page: 1 });
  const [orders, setOrders] = useState({ items: [], total: 0, page: 1 });
  const [stats, setStats] = useState([]);
  const [search, setSearch] = useState('');

  // Edición / eliminación de productos
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Detalle de venta
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const token = localStorage.getItem('aesthetic:token') || '';

  const api = useCallback(async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Error');
    return data;
  }, [token]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const u = await api('/api/integration/aesthetic/units');
        setUnits(u.units || []);
      } catch (e) {
        setError('No se pudo conectar con el ERP. ¿Está la integración habilitada?');
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  const loadTab = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      if (tab === 'resumen') {
        const d = await api(`/api/integration/aesthetic/summary${unitId ? `?unitId=${unitId}` : ''}`);
        setSummary(d.units || []);
      } else if (tab === 'productos') {
        const d = await api(
          `/api/integration/aesthetic/products?page=${products.page}&limit=20&search=${encodeURIComponent(search)}${unitId ? `&unitId=${unitId}` : ''}`
        );
        setProducts((p) => ({ ...p, items: d.items || [], total: d.total || 0 }));
      } else if (tab === 'ventas') {
        const d = await api(
          `/api/integration/aesthetic/orders?page=${orders.page}&limit=20${unitId ? `&unitId=${unitId}` : ''}`
        );
        setOrders((o) => ({ ...o, items: d.items || [], total: d.total || 0 }));
      } else if (tab === 'stats') {
        const d = await api(`/api/integration/aesthetic/stats?days=30${unitId ? `&unitId=${unitId}` : ''}`);
        setStats(d.units || []);
      }
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los datos del ERP');
    }
  }, [tab, unitId, products.page, orders.page, search, api, token]);

  useEffect(() => {
    if (units.length || loading === false) loadTab();
    // eslint-disable-next-line
  }, [loadTab, loading]);

  const refresh = () => loadTab();

  // ── Edición de producto ──
  const openEdit = (p) => {
    setEditingProduct(p);
    setEditForm({
      name: p.name || '',
      price: p.price ?? 0,
      costPrice: p.cost ?? 0,
      stock: p.stock ?? 0,
      active: p.active !== false,
    });
  };

  const saveEdit = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      await api(`/api/integration/aesthetic/products/${editingProduct.id}`, {
        method: 'PUT',
        body: {
          name: editForm.name,
          price: Number(editForm.price) || 0,
          costPrice: Number(editForm.costPrice) || 0,
          stock: Number(editForm.stock) || 0,
          active: !!editForm.active,
        },
      });
      setEditingProduct(null);
      toast.success('Producto actualizado en el ERP');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'No se pudo guardar el producto');
    } finally {
      setSavingProduct(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await api(`/api/integration/aesthetic/products/${deletingProduct.id}`, { method: 'DELETE' });
      setDeletingProduct(null);
      toast.success('Producto archivado en el ERP');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'No se pudo eliminar el producto');
    } finally {
      setDeleting(false);
    }
  };

  // ── Detalle de venta ──
  const openOrder = async (id) => {
    setDetailLoading(true);
    setOrderDetail({ id });
    try {
      const d = await api(`/api/integration/aesthetic/orders/${id}`);
      setOrderDetail(d.order || null);
    } catch (e) {
      setOrderDetail(null);
      toast.error(e?.message || 'No se pudo cargar la venta');
    } finally {
      setDetailLoading(false);
    }
  };

  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));

  return (
    <div className="erp-view">
      <div className="erp-head">
        <div className="ui-row">
          <StoreIcon size={22} />
          <h2 className="ui-page-title">ERP Aesthetic</h2>
        </div>
        <p className="erp-sub">Datos de Santiago. Productos editables; ventas y stats en consulta.</p>
      </div>

      <div className="erp-toolbar">
        <Tabs
          variant="pill"
          active={tab}
          onChange={setTab}
          items={[
            { key: 'resumen', label: 'Resumen' },
            { key: 'productos', label: 'Productos' },
            { key: 'ventas', label: 'Ventas' },
            { key: 'stats', label: 'Stats' },
          ]}
        />
        <div className="ui-spacer" />
        <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas las unidades Aesthetic</option>
          {unitOptions.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={refresh}>Actualizar</Button>
      </div>

      {error && (
        <div className="ui-banner ui-banner--danger" role="alert">
          {error}
          <Button size="sm" variant="danger-ghost" onClick={refresh}>Reintentar</Button>
        </div>
      )}

      {tab === 'resumen' && <SummaryTab summary={summary} loading={loading} />}
      {tab === 'productos' && (
        <ProductsTab
          products={products}
          search={search}
          setSearch={setSearch}
          onPage={(p) => setProducts((s) => ({ ...s, page: p }))}
          onEdit={openEdit}
          onDelete={(p) => setDeletingProduct(p)}
        />
      )}
      {tab === 'ventas' && (
        <OrdersTab orders={orders} onPage={(p) => setOrders((s) => ({ ...s, page: p }))} onOpen={openOrder} />
      )}
      {tab === 'stats' && <StatsTab stats={stats} />}

      {/* ── Modal editar producto ── */}
      <Modal
        open={!!editingProduct}
        title={editingProduct ? `Editar ${editingProduct.name}` : 'Editar producto'}
        subtitle="Los cambios se aplican en el ERP de Santiago"
        onClose={() => setEditingProduct(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingProduct(null)}>Cancelar</Button>
            <Button variant="primary" onClick={saveEdit} loading={savingProduct}>Guardar cambios</Button>
          </>
        }
      >
        <div className="erp-edit-form">
          <Field label="Nombre" required>
            <Input value={editForm.name || ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <div className="ui-grid ui-grid--2">
            <Field label="Precio" required>
              <Input type="number" min="0" value={editForm.price ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} />
            </Field>
            <Field label="Costo">
              <Input type="number" min="0" value={editForm.costPrice ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, costPrice: e.target.value }))} />
            </Field>
          </div>
          <Field label="Stock" hint="Solo aplica a productos sin variantes (las variantes se gestionan en el ERP)">
            <Input type="number" min="0" value={editForm.stock ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))} />
          </Field>
          <label className="ui-check-row">
            <input
              type="checkbox"
              checked={!!editForm.active}
              onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span>Producto activo (visible en el ERP)</span>
          </label>
        </div>
      </Modal>

      {/* ── Confirmar archivar ── */}
      <ConfirmDialog
        open={!!deletingProduct}
        title="Eliminar producto del ERP"
        message={`¿Eliminás "${deletingProduct?.name}" del ERP de Santiago? Queda archivado (se puede reactivar desde el ERP).`}
        confirmText="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingProduct(null)}
        loading={deleting}
      />

      {/* ── Modal detalle de venta ── */}
      <Modal
        open={!!orderDetail}
        title={`Venta #${orderDetail?.orderNumber ?? '—'}`}
        subtitle={orderDetail ? new Date(orderDetail.createdAt).toLocaleString('es-AR') : ''}
        wide
        onClose={() => setOrderDetail(null)}
        footer={<Button variant="secondary" onClick={() => setOrderDetail(null)}>Cerrar</Button>}
      >
        {detailLoading ? (
          <div className="ui-skeleton ui-skeleton--block" style={{ height: 180 }} />
        ) : orderDetail ? (
          <div className="erp-order-detail">
            <div className="ui-grid ui-grid--2">
              <div className="erp-detail-box">
                <span className="erp-detail-label">Cliente</span>
                <strong>{orderDetail.customer?.name || orderDetail.customerName}</strong>
                {orderDetail.customer?.phone && <span>📞 {orderDetail.customer.phone}</span>}
                {orderDetail.customer?.email && <span>✉️ {orderDetail.customer.email}</span>}
                {orderDetail.customer?.dni && <span>🪪 DNI {orderDetail.customer.dni}</span>}
              </div>
              <div className="erp-detail-box">
                <span className="erp-detail-label">Pago</span>
                <strong style={{ textTransform: 'capitalize' }}>{orderDetail.paymentMethod}</strong>
                <span>Total: <b>{money(orderDetail.total)}</b></span>
                {(orderDetail.payments || []).map((p, i) => (
                  <span key={i}>{p.method}: {money(p.amount)}</span>
                ))}
              </div>
            </div>

            {orderDetail.shipping && (orderDetail.shipping.method || orderDetail.shipping.address) && (
              <div className="erp-detail-box">
                <span className="erp-detail-label"><TruckIcon size={14} /> Envío</span>
                {orderDetail.shipping.method && <span>Método: <b>{orderDetail.shipping.method}</b></span>}
                {orderDetail.shipping.company && <span>Transporte: {orderDetail.shipping.company}</span>}
                {orderDetail.shipping.trackingNumber && <span>Tracking: <b>{orderDetail.shipping.trackingNumber}</b></span>}
                {orderDetail.shipping.address && (
                  <span>
                    Dirección: {[
                      orderDetail.shipping.address.calle,
                      orderDetail.shipping.address.numero,
                      orderDetail.shipping.address.piso,
                      orderDetail.shipping.address.ciudad,
                      orderDetail.shipping.address.provincia,
                      orderDetail.shipping.address.cp,
                    ].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
            )}

            <div className="ui-table-wrap" style={{ marginTop: 12 }}>
              <table className="ui-table">
                <thead>
                  <tr><th>Producto</th><th>SKU</th><th>Cant.</th><th>Precio</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr>
                </thead>
                <tbody>
                  {(orderDetail.items || []).map((it, i) => (
                    <tr key={i}>
                      <td>{it.productName}{it.variantDetail ? ` (${it.variantDetail})` : ''}</td>
                      <td className="erp-mono">{it.productSku || '—'}</td>
                      <td>{it.quantity}</td>
                      <td>{money(it.unitPrice)}</td>
                      <td style={{ textAlign: 'right' }}>{money(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {orderDetail.notes && (
              <p className="erp-detail-notes">📝 {orderDetail.notes}</p>
            )}
          </div>
        ) : (
          <EmptyState icon={<StoreIcon size={24} />} title="Venta no encontrada" description="No se pudo cargar el detalle." />
        )}
      </Modal>
    </div>
  );
}

function SummaryTab({ summary, loading }) {
  if (loading) {
    return (
      <div className="ui-grid ui-grid--3">
        <div className="ui-skeleton ui-skeleton--block" />
        <div className="ui-skeleton ui-skeleton--block" />
        <div className="ui-skeleton ui-skeleton--block" />
      </div>
    );
  }
  if (!summary.length) {
    return (
      <EmptyState
        icon={<StoreIcon size={24} />}
        title="Sin datos del ERP"
        description="No hay unidades Aesthetic activas o el ERP no respondió."
      />
    );
  }

  return (
    <div className="erp-summary">
      {summary.map((s) => (
        <Card key={s.unit.id} pad className="erp-unit-card">
          <div className="erp-unit-head">
            <h3>{s.unit.name}</h3>
            <Badge tone="brand">ERP</Badge>
          </div>
          <div className="ui-grid ui-grid--2 erp-kpis">
            <Kpi icon={<CoinsIcon size={18} />} tone="brand" label="Ventas hoy" value={moneyShort(s.salesToday)} sub={money(s.salesToday)} />
            <Kpi icon={<ShoppingBagIcon size={18} />} tone="info" label="Órdenes hoy" value={String(s.ordersToday)} sub="completadas + pendientes" />
            <Kpi icon={<TargetIcon size={18} />} tone="gold" label="Ticket promedio" value={moneyShort(s.avgTicket)} sub="hoy" />
            <Kpi icon={<AlertIcon size={18} />} tone="danger" label="Stock crítico" value={String(s.criticalStock)} sub="≤ 5 unidades" />
          </div>
          {s.criticalProducts?.length > 0 && (
            <div className="erp-critical">
              <span className="erp-critical-title">Productos con stock crítico</span>
              {s.criticalProducts.map((p) => (
                <span key={p.sku || p.name} className="erp-critical-chip">
                  {p.name}: <b>{p.stock}</b>
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Kpi({ icon, tone, label, value, sub }) {
  return (
    <div className={`erp-kpi erp-kpi--${tone}`}>
      <span className="erp-kpi-icon">{icon}</span>
      <div>
        <span className="erp-kpi-label">{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function ProductsTab({ products, search, setSearch, onPage, onEdit, onDelete }) {
  const pages = Math.max(1, Math.ceil(products.total / 20));
  return (
    <div className="erp-tab">
      <Input
        type="search"
        placeholder="Buscar producto en el ERP…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<SearchIcon size={16} />}
        style={{ maxWidth: 360 }}
      />
      {!products.items.length ? (
        <EmptyState icon={<BoxesIcon size={24} />} title="Sin productos" description="No se encontraron productos con los filtros actuales." />
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table" role="table" aria-label="Productos del ERP">
            <thead>
              <tr>
                <th>Producto</th><th>SKU</th><th>Unidad</th><th>Precio</th><th>Stock</th><th>Tienda</th><th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.items.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="erp-mono">{p.sku || '—'}</td>
                  <td>{p.unitName}</td>
                  <td>{money(p.price)}</td>
                  <td>
                    {p.stock <= (p.minStock || 5) ? (
                      <Badge tone={p.stock === 0 ? 'danger' : 'warning'} dot>{p.stock}</Badge>
                    ) : (
                      <Badge tone="success" outline>{p.stock}</Badge>
                    )}
                  </td>
                  <td>{p.onlineSynced ? <Badge tone="brand">Tienda</Badge> : '—'}</td>
                  <td>
                    <div className="ui-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <Button size="sm" variant="secondary" onClick={() => onEdit(p)} title="Editar">
                        <EditIcon size={14} /> Editar
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => onDelete(p)} title="Eliminar">
                        <TrashIcon size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="ui-row erp-pager">
          <Button size="sm" variant="secondary" disabled={products.page <= 1} onClick={() => onPage(products.page - 1)}>
            Anterior
          </Button>
          <Badge tone="neutral">Página {products.page} de {pages}</Badge>
          <Button size="sm" variant="secondary" disabled={products.page >= pages} onClick={() => onPage(products.page + 1)}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ orders, onPage, onOpen }) {
  const pages = Math.max(1, Math.ceil(orders.total / 20));
  if (!orders.items.length) {
    return <EmptyState icon={<ShoppingBagIcon size={24} />} title="Sin ventas" description="No hay ventas registradas en el rango actual." />;
  }
  return (
    <div className="erp-tab">
      <div className="ui-table-wrap">
        <table className="ui-table" role="table" aria-label="Ventas del ERP">
          <thead>
            <tr>
              <th>#</th><th>Fecha</th><th>Cliente</th><th>Método</th><th>Ítems</th><th>Estado</th><th style={{ textAlign: 'right' }}>Total</th><th>Origen</th><th style={{ textAlign: 'right' }}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {orders.items.map((o) => {
              const st = STATUS[o.status] || { lbl: o.status, tone: 'neutral' };
              return (
                <tr key={o.id}>
                  <td>{o.orderNumber}</td>
                  <td>{new Date(o.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{o.customerName}</td>
                  <td style={{ textTransform: 'capitalize' }}>{o.paymentMethod}</td>
                  <td>{o.itemCount}</td>
                  <td><Badge tone={st.tone} dot>{st.lbl}</Badge></td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(o.total)}</td>
                  <td>{o.origen === 'ecommerce' ? <Badge tone="brand">Online</Badge> : <Badge tone="neutral" outline>Local</Badge>}</td>
                  <td>
                    <div className="ui-row" style={{ justifyContent: 'flex-end' }}>
                      <Button size="sm" variant="ghost" onClick={() => onOpen(o.id)} title="Ver detalle">
                        <EyeIcon size={14} /> Ver
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="ui-row erp-pager">
          <Button size="sm" variant="secondary" disabled={orders.page <= 1} onClick={() => onPage(orders.page - 1)}>Anterior</Button>
          <Badge tone="neutral">Página {orders.page} de {pages}</Badge>
          <Button size="sm" variant="secondary" disabled={orders.page >= pages} onClick={() => onPage(orders.page + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}

function StatsTab({ stats }) {
  const colors = useChartPalette();
  if (!stats.length) {
    return <EmptyState icon={<StoreIcon size={24} />} title="Sin estadísticas" description="No hay series para mostrar todavía." />;
  }

  return (
    <div className="erp-tab">
      <div className="ui-grid ui-grid--2">
        {stats.map((s, idx) => {
          const rows = (s.series || []).map((r) => ({
            name: r.date.slice(8, 10) + '/' + r.date.slice(5, 7),
            Ventas: r.total,
          }));
          const color = idx % 2 === 0 ? colors.brand : colors.gold;
          return (
            <Card key={s.unit.id} pad className="erp-chart-card">
              <div className="erp-chart-head">
                <h3>{s.unit.name}</h3>
                <Badge tone="neutral">últimos 30 días</Badge>
              </div>
              <div className="erp-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={colors.grid} strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: colors.tick, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis tick={{ fill: colors.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={moneyShort} width={52} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="Ventas" fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {s.topProducts?.length > 0 && (
                <div className="erp-top">
                  <span className="erp-top-title">Top productos</span>
                  {s.topProducts.map((t) => (
                    <div key={t.name} className="erp-top-row">
                      <span>{t.name}</span>
                      <span><b>{t.qty}</b> u. · {money(t.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
