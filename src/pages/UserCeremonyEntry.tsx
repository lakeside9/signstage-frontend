import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationSummary } from '../types';

/**
 * 사이드바 "행사 관리" 메뉴(`/org/ceremonies`)의 진입점. 행사 관리는 조직 스코프라
 * `organizationId`가 URL에 필요한데, 1인 1조직 제한상 `GET /api/organizations`가 사실상 항상
 * 1건만 돌려주므로 그 값을 받아 바로 `/org/ceremonies/:id`로 보낸다 — "조직 관리 → 상세 →
 * 행사 관리" 2-hop을 거치지 않게 하기 위한 얇은 리다이렉트 화면이다.
 *
 * `/org/organizations/:id`(조직 상세) 아래가 아니라 `/org/ceremonies/:id`라는 별도 최상위
 * 경로를 쓰는 이유: 사이드바 "조직 관리" 메뉴가 `/org/organizations` 접두어로 활성 표시를
 * 매칭하므로, 행사 화면을 그 아래 중첩시키면 행사 화면을 보는 동안 사이드바가 "조직 관리"를
 * 잘못 강조하게 된다.
 */
export const UserCeremonyEntry: FC = () => {
  const [organizationId, setOrganizationId] = useState<number | null | 'none'>(null);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/organizations');
        const organizations = response.data as OrganizationSummary[];
        if (!cancelled) {
          setOrganizationId(organizations.length > 0 ? organizations[0].id : 'none');
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '조직 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          setOrganizationId('none');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (organizationId === null) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (organizationId === 'none') {
    return (
      <p className="py-16 text-center text-sm text-gray-500">
        속한 조직이 없어 행사 관리를 이용할 수 없습니다. 사이드바의 "조직 요청"에서 조직 생성을 먼저
        요청해주세요.
      </p>
    );
  }

  return <Navigate to={`/org/ceremonies/${organizationId}`} replace />;
};
