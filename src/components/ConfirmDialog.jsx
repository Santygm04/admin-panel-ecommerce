import { Modal, Button } from "./ui";

export default function ConfirmDialog({
  open,
  title = "Confirmar",
  message = "¿Seguro?",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  loading = false,
  danger = true,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={loading ? undefined : onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading}
            loading={loading}
          >
            {loading ? "Procesando…" : confirmText}
          </Button>
        </>
      }
    >
      <p className="cd-message">{message}</p>
    </Modal>
  );
}
