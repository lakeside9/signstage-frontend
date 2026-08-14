import type { FC } from 'react';
import { useAuthStore } from '../store/useAuthStore';

/**
 * 아직 채워지지 않은 대시보드. 로그인 이후 진입 지점만 확보한다.
 */
export const Dashboard: FC = () => {
  const platformAdmin = useAuthStore((state) => state.platformAdmin);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-950">대시보드</h1>
      <p className="mt-2 text-sm text-gray-500">
        {platformAdmin?.name ?? '관리자'}님, 환영합니다. 준비 중인 화면입니다.
      </p>
    </div>
  );
};
