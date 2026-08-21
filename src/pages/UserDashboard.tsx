import type { FC } from 'react';

/**
 * 일반 사용자 로그인 후 진입 지점(`/`, `UserLayout` 하위). 관리자 콘솔의 `Dashboard.tsx`와
 * 마찬가지로 아직 채워지지 않은 placeholder다 — 내 조직 목록은 "조직 관리"
 * (`UserOrganizationList`, `/organizations`)로 옮겼다.
 */
export const UserDashboard: FC = () => (
  <div>
    <h1 className="text-xl font-bold text-gray-950">대시보드</h1>
    <p className="mt-2 text-sm text-gray-500">환영합니다. 준비 중인 화면입니다.</p>
  </div>
);
