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

export const ProtectedRoute: FC<{ children: ReactNode }> = ({ children }) => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const token = useAuthStore((state) => state.token);
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

  return <>{children}</>;
};
