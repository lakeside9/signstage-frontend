import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PageResponse, PlatformAdminUserSummary, UserStatus } from '../types';

const PAGE_SIZE = 20;

const STATUS_FILTERS: Array<{ value: UserStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING', label: '승인 대기' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'DISABLED', label: '비활성' },
  { value: 'WITHDRAWN', label: '탈퇴' },
];

const STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISABLED: 'bg-gray-100 text-gray-600 border-gray-200',
  WITHDRAWN: 'bg-red-50 text-red-700 border-red-200',
};

/**
 * 플랫폼 관리자의 회원 목록/승인 화면. PLATFORM_OPS 이상만 상태 변경(승인/거절)이 실제로 성공한다
 * (PLATFORM_SUPPORT는 조회만 가능 — 백엔드가 403으로 막는다).
 * signstage-docs backend/signup-approval-implementation-plan.md 4장,
 * business/platform-admin-member-management.md 참고.
 */
export const AdminUserList: FC = () => {
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('PENDING');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminUserSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  // setState를 직접 호출하지 않는 순수 조회 함수로 분리한다. 이펙트 본문에서
  // 이름 있는 함수를 호출하는 대신 아래처럼 인라인 IIFE로 setState를 호출해야
  // "이펙트 안에서 곧바로 setState 호출"로 감지되지 않는다(react-hooks/set-state-in-effect).
  const fetchUsers = async (status: UserStatus | 'ALL', pageNumber: number) => {
    const query = status === 'ALL' ? '' : `status=${status}&`;
    const response = await api.get(`/platform-admin/users?${query}page=${pageNumber}&size=${PAGE_SIZE}`);
    return response.data as PageResponse<PlatformAdminUserSummary>;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchUsers(statusFilter, page);
        if (!cancelled) {
          setPageData(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '회원 목록을 불러오지 못했습니다.';
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
  }, [statusFilter, page]);

  const handleSelectFilter = (value: UserStatus | 'ALL') => {
    setIsLoading(true);
    setStatusFilter(value);
    setPage(0);
  };

  const handlePageChange = (nextPage: number) => {
    setIsLoading(true);
    setPage(nextPage);
  };

  const handleChangeStatus = async (userId: number, status: 'ACTIVE' | 'DISABLED') => {
    setProcessingId(userId);
    try {
      await api.put(`/platform-admin/users/${userId}/status`, { status });
      showSnackbar(status === 'ACTIVE' ? '승인 처리되었습니다.' : '거절/비활성화 처리되었습니다.', 'success');
      setPageData(await fetchUsers(statusFilter, page));
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const users = pageData?.content ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950">회원 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            가입 승인 대기 목록을 확인하고 승인/거절할 수 있습니다. 상태 변경은 PLATFORM_OPS 이상만 가능합니다.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleSelectFilter(filter.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === filter.value
                ? 'bg-gray-950 text-white border-gray-950'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">해당 조건의 회원이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">아이디</th>
                <th className="text-left px-4 py-3 font-medium">이름</th>
                <th className="text-left px-4 py-3 font-medium">이메일</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-right px-4 py-3 font-medium">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-gray-950 font-medium">{user.loginId}</td>
                  <td className="px-4 py-3 text-gray-700">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[user.status]}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {user.status !== 'ACTIVE' && (
                        <button
                          onClick={() => handleChangeStatus(user.id, 'ACTIVE')}
                          disabled={processingId === user.id}
                          className="px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                        >
                          승인/활성화
                        </button>
                      )}
                      {user.status !== 'DISABLED' && (
                        <button
                          onClick={() => handleChangeStatus(user.id, 'DISABLED')}
                          disabled={processingId === user.id}
                          className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                        >
                          거절/비활성화
                        </button>
                      )}
                    </div>
                  </td>
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
