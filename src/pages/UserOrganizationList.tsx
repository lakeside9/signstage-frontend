import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
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
 */
export const UserOrganizationList: FC = () => {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/organizations');
        if (!cancelled) {
          setOrganizations(response.data as OrganizationSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '조직 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
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
