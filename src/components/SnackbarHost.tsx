import { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useSnackbarStore, type SnackbarItem } from '../store/useSnackbarStore';

const variantClassName: Record<SnackbarItem['variant'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-gray-200 bg-white text-gray-800',
};

const iconByVariant: Record<SnackbarItem['variant'], ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-600" />,
  error: <XCircle size={18} className="text-red-600" />,
  info: <Info size={18} className="text-gray-500" />,
};

const SnackbarMessage: FC<{ item: SnackbarItem; onDismiss: (id: number) => void }> = ({ item, onDismiss }) => {
  useEffect(() => {
    if (item.durationMs === null) {
      return;
    }
    const timeoutId = window.setTimeout(() => onDismiss(item.id), item.durationMs ?? 3500);
    return () => window.clearTimeout(timeoutId);
  }, [item.durationMs, item.id, onDismiss]);

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${variantClassName[item.variant]}`}>
      <div className="pt-0.5">{iconByVariant[item.variant]}</div>
      <div className="min-w-0 flex-1 text-sm font-medium leading-5">{item.message}</div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="rounded-md p-0.5 text-current opacity-60 hover:opacity-100"
        aria-label="알림 닫기"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const SnackbarHost: FC = () => {
  const items = useSnackbarStore((state) => state.items);
  const dismissSnackbar = useSnackbarStore((state) => state.dismissSnackbar);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex w-[calc(100vw-40px)] max-w-sm flex-col gap-2">
      {items.map((item) => (
        <SnackbarMessage key={item.id} item={item} onDismiss={dismissSnackbar} />
      ))}
    </div>
  );
};
