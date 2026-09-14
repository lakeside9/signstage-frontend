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
 * 일반 사용자의 "회사정보관리"(구 "조직 관리") 화면 — 사이드바 "설정" 하위 메뉴(2026-08-30).
 * `GET /api/organizations`로 내가 속한 조직 목록을 보여준다. 조직 행을 누르면
 * 상세/설정(`UserOrganizationDetail`, `/organizations/:id`)으로 이동해 조직 정보를
 * 확인/수정(OWNER만)할 수 있다. 페이지네이션이 없다 — 백엔드도 `List<>`를 그대로 반환한다
 * (한 사람이 속한 조직 수가 적을 걸 전제로 한 설계, backend/organization-feature-implementation.md
 * 참고). 그래서 frontend/list-screen-convention.md의 검색/페이지네비게이션 구조는 적용하지 않았다.
 *
 * 조직 생성 요청 제출/이력을 다루는 "회사등록요청"(구 "조직 요청", `UserOrganizationRequests`,
 * `/organization-requests`) 화면은 당분간 사이드바에서 숨겨져 있다 — 지금은 플랫폼 관리자가
 * 직접 파트너(조직)를 등록한다(2026-08-30 결정). 그래서 조직이 없는 사용자에게도 그 메뉴 대신
 * 관리자에게 문의하라고 안내한다.
 *
 * <p>속한 조직이 정확히 1개면 목록을 보여주지 않고 그 조직 상세로 바로 넘어간다(2026-09-14,
 * 사용자 요청) — "한 사람이 속한 조직 수가 적다"는 전제(위 설계 주석)가 실제로는 거의 항상
 * "정확히 1개"라 목록 화면이 클릭 한 번을 더 시키는 불필요한 중간 단계가 되는 경우가
 * 많았다. `replace: true`로 이동해 `/organizations`가 히스토리에 안 남게 한다 — 상세
 * 화면에서 브라우저 뒤로가기를 눌러도 이 목록으로 안 튕기고 그 이전 화면으로 곧장 간다.
 * 상세 화면의 "회사정보관리로" 링크를 눌렀을 때는 이 목록을 다시 거쳐 제자리로 돌아오는
 * 셈이지만(목록 렌더링 없이 바로 리다이렉트되어 체감상 거의 눈에 띄지 않는다), 그 정도
 * 트레이드오프는 감수하기로 했다 — 조직이 1개뿐인지 상세 화면이 미리 알 방법이 없어
 * 링크 자체를 조건부로 숨기려면 API 호출이 하나 더 필요해진다. `UserSubscriptionMarginList.tsx`
 * ("구독·마진 관리")도 같은 이유로 같은 패턴을 쓴다 — 두 화면은 원래도 같은 목록→상세
 * 구조를 복제한 쌍이라 한쪽만 고치면 동작이 어긋난다(signstage-docs
 * business/subscription-margin-screen-separation-review.md 참고).
 */
export const UserOrganizationList: FC = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    // 리다이렉트 분기에서는 finally에서 setIsLoading(false)를 하지 않는다 — 안 그러면
    // organizations가 빈 배열인 채로 로딩 상태만 풀려, navigate()가 실제 라우트를 바꾸기
    // 직전 한 프레임 동안 "아직 속한 조직이 없습니다" 빈 상태 문구가 잠깐 보일 수 있다.
    let redirecting = false;

    (async () => {
      try {
        const response = await api.get('/organizations');
        if (!cancelled) {
          const data = response.data as OrganizationSummary[];
          if (data.length === 1) {
            redirecting = true;
            navigate(`/organizations/${data[0].id}`, { replace: true });
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
        <h1 className="text-xl font-bold text-gray-950">회사정보관리</h1>
        <p className="mt-1 text-sm text-gray-500">내가 속한 조직 목록입니다. 조직을 누르면 상세/설정으로 이동합니다.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : organizations.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            아직 속한 조직이 없습니다. 플랫폼 관리자에게 회사 등록을 요청하거나, 소속될 조직의
            관리자에게 초대를 요청해주세요.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Link
                  to={`/organizations/${organization.id}`}
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
