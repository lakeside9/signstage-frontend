import type { FC } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 삭제처럼 되돌릴 수 없는 조작을 확정하기 전에 한 번 더 묻는 공용 팝업(Modal 기반). */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = '삭제 확정',
  isSubmitting = false,
  onConfirm,
  onCancel,
}) => (
  <Modal open={open} onClose={onCancel} title={title} widthClassName="max-w-sm">
    <p className="text-sm text-gray-700">{message}</p>
    <div className="mt-4 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
      >
        <X size={12} />
        취소
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        {isSubmitting ? '삭제 중...' : confirmLabel}
      </button>
    </div>
  </Modal>
);
