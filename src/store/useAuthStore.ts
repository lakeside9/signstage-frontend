import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlatformAdminInfo } from '../types';

interface AuthState {
  token: string | null;
  platformAdmin: PlatformAdminInfo | null;
  isLoggedIn: boolean;

  login: (token: string, platformAdmin: PlatformAdminInfo) => void;
  logout: () => void;
  /** 내 정보 수정 화면에서 이름을 바꾸면 헤더 표시도 같이 갱신한다. */
  updatePlatformAdminName: (name: string) => void;
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

      updatePlatformAdminName: (name) => {
        set((state) => (state.platformAdmin ? { platformAdmin: { ...state.platformAdmin, name } } : state));
      },
    }),
    {
      name: 'signstage.auth',
    }
  )
);
