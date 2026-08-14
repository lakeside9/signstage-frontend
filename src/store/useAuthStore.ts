import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlatformAdminInfo } from '../types';

interface AuthState {
  token: string | null;
  platformAdmin: PlatformAdminInfo | null;
  isLoggedIn: boolean;

  login: (token: string, platformAdmin: PlatformAdminInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      platformAdmin: null,
      isLoggedIn: false,

      login: (token, platformAdmin) => {
        set({ token, platformAdmin, isLoggedIn: true });
      },

      logout: () => {
        set({ token: null, platformAdmin: null, isLoggedIn: false });
      },
    }),
    {
      name: 'signstage.auth',
    }
  )
);
