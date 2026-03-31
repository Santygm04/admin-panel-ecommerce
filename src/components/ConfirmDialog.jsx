import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  title = "Confirmar",
  message = "¿Seguro?",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;
  return (
    <div className="cd-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="cd-title">{title}</h3>
        <p className="cd-message">{message}</p>
        <div className="cd-actions">
          <button className="cd-btn cd-cancel" onClick={onCancel} disabled={loading} type="button">
            {cancelText}
          </button>
          <button className="cd-btn cd-confirm" onClick={onConfirm} disabled={loading} type="button">
            {loading ? "Eliminando…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
