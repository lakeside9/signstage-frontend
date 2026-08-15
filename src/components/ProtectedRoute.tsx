import { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const decodeExpiry = (token: string): number | null => {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
      return null;
    }
    const payload = JSON.parse(atob(payloadBase64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * true면 platformAdmin 토큰(플랫폼 관리자 로그인)만 통과시킨다. 일반 사용자 토큰으로
   * 로그인한 채 관리자 화면 경로에 직접 접근하면 /org(일반 사용자 대시보드)로 돌려보낸다.
   * 화면군 A(관리자 콘솔)와 화면군 B(조직 사용자)가 같은 로그인 상태를 공유하는 구조라
   * (signstage-docs frontend/screen-composition-plan.md 2장), API는 이미 403으로 막지만
   * 관리자 화면 셸 자체가 일반 사용자에게 노출되지 않도록 여기서도 막는다.
   */
  requireAdmin?: boolean;
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const token = useAuthStore((state) => state.token);
  const platformAdmin = useAuthStore((state) => state.platformAdmin);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  useEffect(() => {
    if (!token) {
      return;
    }
    const expiresAt = decodeExpiry(token);
    if (expiresAt !== null && expiresAt < Date.now()) {
      logout();
    }
  }, [token, logout]);

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireAdmin && !platformAdmin) {
    return <Navigate to="/org" replace />;
  }

  return <>{children}</>;
};
