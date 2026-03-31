export default function ConfirmDialog({
  open,
  title       = "Confirmar",
  message     = "¿Seguro?",
  confirmText = "Aceptar",
  cancelText  = "Cancelar",
  onConfirm,
  onCancel,
  loading     = false,
}) {
  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 bg-black/25 grid place-items-center z-[3000] animate-[cdFadeIn_.18s_ease-out] px-4"
      onClick={loading ? undefined : onCancel}
    >
      {/* Modal */}
      <div
        className="w-full max-w-[520px] bg-white border border-[#f3c9e2] rounded-2xl shadow-[0_20px_60px_rgba(214,51,132,0.18)] p-4 animate-[cdPopIn_.18s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[#d63384] font-black text-base mt-0 mb-1">{title}</h3>
        <p className="text-[#444] text-sm mb-4 mt-0">{message}</p>

        <div className="flex justify-end gap-2 flex-wrap">
          <button
            className="border-0 rounded-xl px-4 py-2 font-black text-sm bg-[#f7f7f7] text-[#333] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onCancel}
            disabled={loading}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className="border-0 rounded-xl px-4 py-2 font-black text-sm bg-red-600 text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? "Eliminando…" : confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cdFadeIn { from{opacity:0}              to{opacity:1}           }
        @keyframes cdPopIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}