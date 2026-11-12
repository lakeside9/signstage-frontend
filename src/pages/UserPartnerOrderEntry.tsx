import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationSummary } from '../types';

/**
 * 사이드바 "발주함" 메뉴(`/partner-orders`)의 진입점 — `UserCeremonyEntry`와 같은 이유로 내 조직
 * 하나를 찾아 `/partner-orders/:organizationId`로 보낸다.
 */
export const UserPartnerOrderEntry: FC = () => {
  const [organizationId, setOrganizationId] = useState<number | null | 'none'>(null);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/organizations');
        const organizations = response.data as OrganizationSummary[];
        if (!cancelled) setOrganizationId(organizations.length > 0 ? organizations[0].id : 'none');
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '조직 정보를 불러오지 못했습니다.', 'error');
          setOrganizationId('none');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSnackbar]);

  if (organizationId === null) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }
  if (organizationId === 'none') {
    return <p className="py-16 text-center text-sm text-gray-500">속한 조직이 없어 발주함을 이용할 수 없습니다.</p>;
  }
  return <Navigate to={`/partner-orders/${organizationId}`} replace />;
};
