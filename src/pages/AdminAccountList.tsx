import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { isPlatformSuper } from '../utils/permissions';
import type { PageResponse, PlatformAdminUserSummary, PlatformRole } from '../types';

const PAGE_SIZE = 20;

const ROLE_BADGE_CLASS: Record<PlatformRole, string> = {
  PLATFORM_SUPPORT: 'bg-gray-100 text-gray-600 border-gray-200',
  PLATFORM_OPS: 'bg-blue-50 text-blue-700 border-blue-200',
  PLATFORM_SUPER: 'bg-purple-50 text-purple-700 border-purple-200',
};

/**
 * 플랫폼 관리자 계정(platform_role 보유 User) 목록. 생성/권한 해제는 PLATFORM_SUPER만
 * 가능하다(signstage-docs business/user-organization-design.md 7.2절). 조회는 전체 등급.
 */
export const AdminAccountList: FC = () => {
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminUserSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const currentAdminId = useAuthStore((state) => state.platformAdmin?.id);
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManageAccounts = isPlatformSuper(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchAccounts = async (pageNumber: number) => {
    const response = await api.get(`/platform-admin/accounts?page=${pageNumber}&size=${PAGE_SIZE}`);
    return response.data as PageResponse<PlatformAdminUserSummary>;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAccounts(page);
        if (!cancelled) {
          setPageData(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '관리자 계정 목록을 불러오지 못했습니다.';
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
  }, [page]);

  const handlePageChange = (nextPage: number) => {
    setIsLoading(true);
    setPage(nextPage);
  };

  const handleRevoke = async (userId: number) => {
    setProcessingId(userId);
    try {
      await api.put(`/platform-admin/accounts/${userId}/revoke`);
      showSnackbar('플랫폼 관리자 권한을 해제했습니다.', 'success');
      setPageData(await fetchAccounts(page));
    } catch (err) {
      const message = err instanceof Error ? err.message : '권한 해제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const accounts = pageData?.content ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950">플랫폼 관리자 계정</h1>
          <p className="mt-1 text-sm text-gray-500">
            platform_role을 가진 계정 목록입니다. 생성/권한 해제는 PLATFORM_SUPER만 가능합니다.
          </p>
        </div>
        {canManageAccounts && (
          <Link
            to="/accounts/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <UserPlus size={16} />
            관리자 추가
          </Link>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">플랫폼 관리자 계정이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">아이디</th>
                <th className="text-left px-4 py-3 font-medium">이름</th>
                <th className="text-left px-4 py-3 font-medium">이메일</th>
                <th className="text-left px-4 py-3 font-medium">등급</th>
                <th className="text-right px-4 py-3 font-medium">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((account) => {
                const isSelf = account.id === currentAdminId;
                return (
                  <tr key={account.id}>
                    <td className="px-4 py-3 text-gray-950 font-medium">
                      {account.loginId}
                      {isSelf && <span className="ml-1.5 text-xs text-gray-400 font-normal">(나)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{account.name}</td>
                    <td className="px-4 py-3 text-gray-500">{account.email}</td>
                    <td className="px-4 py-3">
                      {account.platformRole && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE_CLASS[account.platformRole]}`}
                        >
                          <ShieldCheck size={12} />
                          {account.platformRole}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!canManageAccounts ? (
                        <p className="text-right text-xs text-gray-400">조회 전용 계정</p>
                      ) : isSelf ? (
                        <p className="text-right text-xs text-gray-400">본인 계정은 해제할 수 없음</p>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRevoke(account.id)}
                            disabled={processingId === account.id}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                          >
                            <ShieldOff size={12} />
                            권한 해제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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
