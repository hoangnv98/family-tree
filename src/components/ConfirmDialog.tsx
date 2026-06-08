import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-brand border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-surface-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              danger ? 'bg-crimson/15 text-crimson' : 'bg-accent/15 text-accent'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h3 className="text-base font-semibold text-ink dark:text-white">{title}</h3>
        </div>
        <p className="mb-5 text-sm text-ink/60 dark:text-white/60">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-surface-300 dark:text-white/70 dark:hover:bg-white/10"
          >
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
              danger ? 'bg-crimson hover:bg-crimson/90' : 'bg-accent hover:bg-accent/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
