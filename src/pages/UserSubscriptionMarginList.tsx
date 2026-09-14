import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationSummary } from '../types';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  SUSPENDED: '정지',
  TRIAL: '체험',
};

/**
 * "구독·마진 관리" 최상위 메뉴(2026-09-14, 사용자 요청) — "구독"(`OrganizationSubscriptionSection`)과
 * "재판매 마진"(`OrganizationMarginPolicySection`) 두 섹션을 `UserOrganizationDetail.tsx`(회사정보관리
 * 조직 상세)에서 분리해 독립 화면으로 뺐다. 관리자 콘솔의 "행사 건별 재량 할인"/"파트너별 할인
 * 오버라이드"를 조직 상세에서 분리했던 선례(signstage-docs
 * business/discount-management-screen-separation-review.md)와 같은 이유 — 조직 상세 화면 맨
 * 아래 묻혀 있어 두 기능의 존재 자체를 놓치기 쉬웠다. `UserOrganizationList.tsx`(회사정보관리
 * 목록)와 똑같은 목록→상세 구조를 그대로 복제했다 — 한 사람이 속한 조직 수가 적다는 같은
 * 전제(페이지네이션 없음, `GET /organizations`)도 동일하다.
 *
 * <p>이름은 "구독"과 "재판매 마진"을 한 화면에 묶으면서도 기존 관례(가운데점으로 두 개념
 * 결합, "회원·파트너 관리"/"과금·카탈로그 관리"/"구매·할인 관리")를 따랐다 — signstage-docs
 * business/platform-admin-partner-ux-confusion-review.md 검토에서 나온 "정산"은 예전에 "고객
 * 정산"이 "고객 견적"과 헷갈려 폐기된 용어라 후보에서 뺐다.
 *
 * <p>속한 조직이 정확히 1개면 목록을 보여주지 않고 그 조직 상세로 바로 넘어간다(2026-09-14,
 * 사용자 요청) — `UserOrganizationList.tsx`와 같은 이유·같은 구현이다(그 파일 주석 참고).
 * 두 화면은 같은 목록→상세 구조를 복제한 쌍이라 한쪽만 고치면 동작이 어긋난다.
 */
export const UserSubscriptionMarginList: FC = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    let redirecting = false;

    (async () => {
      try {
        const response = await api.get('/organizations');
        if (!cancelled) {
          const data = response.data as OrganizationSummary[];
          if (data.length === 1) {
            redirecting = true;
            navigate(`/subscription-margin/${data[0].id}`, { replace: true });
            return;
          }
          setOrganizations(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '조직 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled && !redirecting) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">구독·마진 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          내가 속한 조직 목록입니다. 조직을 누르면 구독·재판매 마진 설정으로 이동합니다.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : organizations.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">아직 속한 조직이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Link
                  to={`/subscription-margin/${organization.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <Building2 size={16} className="text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-950 truncate">{organization.name}</p>
                    <p className="text-xs text-gray-500">{organization.code}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {STATUS_LABEL[organization.status] ?? organization.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
