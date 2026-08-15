import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PageResponse, PlatformAdminAction, PlatformAdminAuditLogEntry } from '../types';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<PlatformAdminAction, string> = {
  UPDATE_USER_STATUS: '회원 상태 변경',
  UNLOCK_USER: '계정 잠금 해제',
  FORCE_PASSWORD_RESET: '강제 비밀번호 재설정',
  CREATE_USER: '회원 생성',
  CREATE_ACCOUNT: '관리자 계정 생성',
  REVOKE_ACCOUNT: '관리자 권한 해제',
  UPDATE_ORGANIZATION_STATUS: '조직 상태 변경',
};

const ACTION_OPTIONS: Array<{ value: PlatformAdminAction | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  ...(Object.keys(ACTION_LABELS) as PlatformAdminAction[]).map((value) => ({
    value,
    label: ACTION_LABELS[value],
  })),
];

/**
 * 플랫폼 관리자 제어 행위 감사 로그. 조회 전용이며 PLATFORM_SUPPORT 이상 전체가 볼 수 있다
 * (signstage-docs business/user-organization-design.md 7.4절).
 */
export const AdminAuditLogList: FC = () => {
  const [actionFilter, setActionFilter] = useState<PlatformAdminAction | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminAuditLogEntry> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const query = new URLSearchParams();
        if (actionFilter !== 'ALL') query.set('action', actionFilter);
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));

        const response = await api.get(`/platform-admin/audit-logs?${query.toString()}`);
        if (!cancelled) {
          setPageData(response.data as PageResponse<PlatformAdminAuditLogEntry>);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '감사 로그를 불러오지 못했습니다.';
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
  }, [actionFilter, page]);

  const handleSelectAction = (value: PlatformAdminAction | 'ALL') => {
    setIsLoading(true);
    setActionFilter(value);
    setPage(0);
  };

  const handlePageChange = (nextPage: number) => {
    setIsLoading(true);
    setPage(nextPage);
  };

  const entries = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">감사 로그</h1>
        <p className="mt-1 text-sm text-gray-500">
          플랫폼 관리자가 회원/조직에 대해 수행한 제어 행위 기록입니다. 조회 전용입니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {ACTION_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelectAction(option.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              actionFilter === option.value
                ? 'bg-gray-950 text-white border-gray-950'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">해당 조건의 감사 로그가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">시각</th>
                <th className="text-left px-4 py-3 font-medium">관리자</th>
                <th className="text-left px-4 py-3 font-medium">행위</th>
                <th className="text-left px-4 py-3 font-medium">대상</th>
                <th className="text-left px-4 py-3 font-medium">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-gray-950 font-medium">
                    {entry.adminLoginId ?? `#${entry.adminUserId}`}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{ACTION_LABELS[entry.action]}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {entry.targetUserId ? (
                      <Link to={`/users/${entry.targetUserId}`} className="text-gray-950 hover:underline">
                        회원: {entry.targetLoginId ?? `#${entry.targetUserId}`}
                      </Link>
                    ) : entry.organizationId ? (
                      <Link to={`/organizations/${entry.organizationId}`} className="text-gray-950 hover:underline">
                        조직: {entry.organizationName ?? `#${entry.organizationId}`}
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{entry.detail ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pageData && (
          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            hasNext={pageData.hasNext}
            totalElements={pageData.totalElements}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
};
