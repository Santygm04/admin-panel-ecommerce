import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { SunIcon, MoonIcon, XIcon } from './icons';

/* ── Spinner ── */
export function Spinner({ size, className = '', ...props }) {
  const cls = ['ui-spinner', size ? `ui-spinner--${size}` : '', className].filter(Boolean).join(' ');
  return <span className={cls} role="status" aria-label="Cargando" {...props} />;
}

/* ── Button ── */
export function Button({
  variant = 'primary',
  size,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const cls = ['ui-btn', `ui-btn--${variant}`, size ? `ui-btn--${size}` : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={props.type || 'button'} className={cls} disabled={disabled || loading} {...props}>
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

/* ── Field / Input / Textarea / Select ── */
export function Field({ label, error, hint, required, htmlFor, children, className = '' }) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      {label && (
        <label className="ui-label" htmlFor={htmlFor}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="ui-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ui-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({ error, icon, prefix, className = '', id, ...props }) {
  const wrapCls = ['ui-input-wrap', error ? 'ui-input--error' : ''].filter(Boolean).join(' ');
  const hasWrap = Boolean(icon || prefix);
  const input = (
    <input
      id={id}
      className={`ui-input ${prefix ? 'ui-input--with-prefix' : ''} ${error ? 'ui-input--error' : ''} ${className}`.trim()}
      {...props}
    />
  );
  if (!hasWrap) return input;
  return (
    <div className={wrapCls}>
      {prefix && <span className="ui-input-prefix">{prefix}</span>}
      {input}
      {icon && <span className="ui-input-icon">{icon}</span>}
    </div>
  );
}

export function Textarea({ error, className = '', ...props }) {
  return (
    <textarea className={`ui-textarea ${error ? 'ui-textarea--error' : ''} ${className}`.trim()} {...props} />
  );
}

export function Select({ error, className = '', children, ...props }) {
  return (
    <select className={`ui-select ${error ? 'ui-select--error' : ''} ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

/* ── Card ── */
export function Card({ flat = false, pad = false, className = '', children, ...props }) {
  const cls = ['ui-card', flat ? 'ui-card--flat' : '', pad ? 'ui-card-pad' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`ui-card-title ${className}`.trim()}>{children}</h3>;
}

export function CardSub({ children, className = '' }) {
  return <p className={`ui-card-sub ${className}`.trim()}>{children}</p>;
}

/* ── Badge ── */
export function Badge({ tone = 'neutral', outline = false, dot = false, className = '', children }) {
  const cls = [
    'ui-badge',
    `ui-badge--${tone}`,
    outline ? 'ui-badge--outline' : '',
    dot ? 'ui-badge--dot' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <span className={cls}>{children}</span>;
}

/* ── Table ── */
export function Table({ children, label, className = '' }) {
  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className="ui-table" role="table" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function Td({ children, className = '', ...props }) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}

export function Th({ children, className = '', ...props }) {
  return (
    <th scope="col" className={className} {...props}>
      {children}
    </th>
  );
}

/* ── Skeleton ── */
export function Skeleton({ variant = 'text', width, className = '', style }) {
  return (
    <div
      className={`ui-skeleton ui-skeleton--${variant} ${className}`.trim()}
      style={{ width, ...style }}
      aria-hidden="true"
    />
  );
}

/* ── EmptyState ── */
export function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`ui-empty ${className}`.trim()}>
      {icon && <div className="ui-empty-icon">{icon}</div>}
      {title && <h3 className="ui-empty-title">{title}</h3>}
      {description && <p className="ui-empty-desc">{description}</p>}
      {action}
    </div>
  );
}

/* ── Tabs ── */
export function Tabs({ items = [], active, onChange, variant = 'pill', className = '' }) {
  const variantCls = variant === 'line' ? 'ui-tabs--line' : '';
  return (
    <div className={`ui-tabs ${variantCls} ${className}`.trim()} role="tablist">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ui-tab ${variant === 'pill' ? 'ui-tab--pill' : ''} ${isActive ? 'ui-tab--active' : ''}`.trim()}
            onClick={() => onChange(item.key)}
          >
            {item.icon && <span className="ui-tab-icon">{item.icon}</span>}
            {item.label}
            {typeof item.badge === 'number' && item.badge > 0 && (
              <Badge tone="danger">{item.badge}</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Modal ── */
export function Modal({ open, title, subtitle, onClose, footer, children, wide = false }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    const focusEl = ref.current?.querySelector('button, input, select, textarea, [tabindex]');
    focusEl?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className={`ui-modal ${wide ? 'ui-modal--wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        ref={ref}
      >
        <div className="ui-modal-header">
          <div>
            <h2 className="ui-modal-title">{title}</h2>
            {subtitle && <p className="ui-modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="ui-modal-x" onClick={onClose} aria-label="Cerrar">
            <XIcon size={16} />
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ── ThemeToggle ── */
export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';
  return (
    <button
      type="button"
      className={`ui-theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
