import { create } from 'zustand';

export type SnackbarVariant = 'success' | 'error' | 'info';

export interface SnackbarItem {
  id: number;
  message: string;
  variant: SnackbarVariant;
  durationMs?: number | null;
}

interface SnackbarState {
  items: SnackbarItem[];
  showSnackbar: (message: string, variant?: SnackbarVariant, durationMs?: number | null) => void;
  dismissSnackbar: (id: number) => void;
}

export const useSnackbarStore = create<SnackbarState>((set) => ({
  items: [],
  showSnackbar: (message, variant = 'info', durationMs) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set((state) => ({
      items: [...state.items, { id, message, variant, durationMs }],
    }));
  },
  dismissSnackbar: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },
}));
