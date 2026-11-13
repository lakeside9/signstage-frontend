import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlatformAdminInfo } from '../types';

interface AuthState {
  token: string | null;
  platformAdmin: PlatformAdminInfo | null;
  isLoggedIn: boolean;
  /**
   * 데모 조직 소속 VIEWER(데모 체험 계정)인가 — signstage-docs
   * business/demo-account-exhibition-signer-preview-review.md 4.1/4.2절. true면
   * platformAdmin도 null이다(플랫폼 관리자는 데모 체험 계정이 될 수 없다). `/demo`
   * (DemoView) 전용 라우팅 분기에 쓴다.
   */
  isDemoViewer: boolean;
  /**
   * 사용자가 직접 로그아웃했는가 — 보호 화면에 있다가 로그아웃하면 로그인 화면 대신 메인(`/`)으로 보낸다
   * (`ProtectedRoute`). 화면 이동이 transition이라 로그아웃 상태가 먼저 그려져 보호 라우트가 `/login`으로 보내던
   * 문제를 막는다(2026-11-13). 새로고침하면 의미가 없어 저장하지 않는다.
   */
  signedOutByUser: boolean;

  /**
   * platformAdmin이 null이면 일반 사용자(조직 소속 여부와 무관) 로그인이다 —
   * signstage-docs business/user-organization-design.md 5.1절 (a) 3단계 흐름 참고.
   */
  login: (token: string, platformAdmin: PlatformAdminInfo | null, isDemoViewer?: boolean) => void;
  /** byUser: 헤더의 로그아웃 버튼처럼 사용자가 직접 로그아웃할 때 true — 세션 만료 로그아웃은 로그인 화면으로 간다. */
  logout: (options?: { byUser?: boolean }) => void;
  /** 내 정보 수정 화면에서 이름을 바꾸면 헤더 표시도 같이 갱신한다. */
  updatePlatformAdminName: (name: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      platformAdmin: null,
      isLoggedIn: false,
      isDemoViewer: false,
      signedOutByUser: false,

      login: (token, platformAdmin, isDemoViewer = false) => {
        set({ token, platformAdmin, isLoggedIn: true, isDemoViewer, signedOutByUser: false });
      },

      logout: (options) => {
        set({ token: null, platformAdmin: null, isLoggedIn: false, isDemoViewer: false, signedOutByUser: options?.byUser ?? false });
      },

      updatePlatformAdminName: (name) => {
        set((state) => (state.platformAdmin ? { platformAdmin: { ...state.platformAdmin, name } } : state));
      },
    }),
    {
      name: 'signstage.auth',
      partialize: ({ token, platformAdmin, isLoggedIn, isDemoViewer }) => ({ token, platformAdmin, isLoggedIn, isDemoViewer }),
    }
  )
);
