import type { FC } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { Button } from './Button';
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
      <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
        <X size={12} />
        취소
      </Button>
      <Button variant="danger" size="sm" onClick={onConfirm} disabled={isSubmitting}>
        {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        {isSubmitting ? '삭제 중...' : confirmLabel}
      </Button>
    </div>
  </Modal>
);
