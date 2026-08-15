import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Key, Loader2, LogOut, Plus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationSummary } from '../types';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  SUSPENDED: '정지',
  TRIAL: '체험',
};

/**
 * 일반 사용자가 로그인 후 도착하는 화면. 예전에는 조직이 있든 없든 항상 조직 생성
 * 화면(`/org/new`)으로 곧장 보냈지만, 그러면 이미 조직이 있는 사용자도 매번 생성 화면부터
 * 거쳐야 했다 — 로그인 후 진입 지점을 여기로 분리했다.
 *
 * 조직 생성 방법 자체(초대 vs 셀프서비스, 이 화면에서의 노출 방식 등)는 다시 정리할
 * 예정이라 지금은 "내 조직 목록 + 조직 만들기 링크"만 두는 최소 구현이다.
 * signstage-docs frontend/screen-composition-plan.md 5장, 11장 "조직 생성 흐름 재정리" 참고.
 */
export const OrgDashboard: FC = () => {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useAuthStore((state) => state.logout);
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
    <div className="min-h-screen bg-gray-50 p-4 text-gray-950">
      <div className="max-w-lg mx-auto pt-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-gray-950 p-1.5 rounded-lg text-white">
              <Key size={20} />
            </div>
            <span className="text-lg font-bold text-gray-950">SignStage</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-950 transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-bold text-gray-950">내 조직</h1>
            <Link
              to="/org/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus size={14} />
              조직 만들기
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : organizations.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              아직 속한 조직이 없습니다. 위 "조직 만들기"로 새 조직을 만들거나, 소속될 조직의 관리자에게
              초대를 요청해주세요.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {organizations.map((organization) => (
                <li key={organization.id} className="flex items-center gap-3 py-3">
                  <Building2 size={16} className="text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-950 truncate">{organization.name}</p>
                    <p className="text-xs text-gray-500">{organization.code}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {STATUS_LABEL[organization.status] ?? organization.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
