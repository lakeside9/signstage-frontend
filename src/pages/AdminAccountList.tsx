import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { isPlatformSuper } from '../utils/permissions';
import type { PageResponse, PlatformAdminUserSummary, PlatformRole } from '../types';

const PAGE_SIZE = 20;

const ROLE_OPTIONS: Array<{ value: PlatformRole | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PLATFORM_SUPPORT', label: 'PLATFORM_SUPPORT' },
  { value: 'PLATFORM_OPS', label: 'PLATFORM_OPS' },
  { value: 'PLATFORM_SUPER', label: 'PLATFORM_SUPER' },
];

const ROLE_BADGE_CLASS: Record<PlatformRole, string> = {
  PLATFORM_SUPPORT: 'bg-gray-100 text-gray-600 border-gray-200',
  PLATFORM_OPS: 'bg-blue-50 text-blue-700 border-blue-200',
  PLATFORM_SUPER: 'bg-purple-50 text-purple-700 border-purple-200',
};

interface SearchParams {
  loginId: string;
  name: string;
  email: string;
  platformRole: PlatformRole | 'ALL';
}

const EMPTY_SEARCH: SearchParams = { loginId: '', name: '', email: '', platformRole: 'ALL' };

/**
 * 플랫폼 관리자 계정(platform_role 보유 User) 목록. 생성/권한 해제는 PLATFORM_SUPER만
 * 가능하다(signstage-docs business/user-organization-design.md 7.2절). 조회는 전체 등급.
 *
 * 화면 구성은 signstage-docs frontend/list-screen-convention.md의 "검색 영역 → 목록 →
 * 페이지네비게이션" 3단 구조를 따른다(SearchBar/ListContainer 공통 컴포넌트 사용).
 */
export const AdminAccountList: FC = () => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminUserSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, PlatformRole>>({});

  const currentAdminId = useAuthStore((state) => state.platformAdmin?.id);
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManageAccounts = isPlatformSuper(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchAccounts = async (search: SearchParams, pageNumber: number) => {
    const query = new URLSearchParams();
    if (search.loginId) query.set('loginId', search.loginId);
    if (search.name) query.set('name', search.name);
    if (search.email) query.set('email', search.email);
    if (search.platformRole !== 'ALL') query.set('platformRole', search.platformRole);
    query.set('page', String(pageNumber));
    query.set('size', String(PAGE_SIZE));

    const response = await api.get(`/platform-admin/accounts?${query.toString()}`);
    return response.data as PageResponse<PlatformAdminUserSummary>;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAccounts(searchParams, page);
        if (!cancelled) {
          setPageData(data);
          setRoleDrafts((prev) => ({
            ...prev,
            ...Object.fromEntries(
              data.content
                .filter((account) => account.platformRole)
                .map((account) => [account.id, account.platformRole as PlatformRole])
            ),
          }));
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
  }, [searchParams, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setSearchParams(formValues);
  };

  const handleReset = () => {
    setIsLoading(true);
    setFormValues(EMPTY_SEARCH);
    setPage(0);
    setSearchParams(EMPTY_SEARCH);
  };

  const handlePageChange = (nextPage: number) => {
    setIsLoading(true);
    setPage(nextPage);
  };

  const handleUpdateRole = async (userId: number) => {
    const nextRole = roleDrafts[userId];
    setProcessingId(userId);
    try {
      await api.put(`/platform-admin/accounts/${userId}/role`, { platformRole: nextRole });
      showSnackbar('등급을 변경했습니다.', 'success');
      setPageData(await fetchAccounts(searchParams, page));
    } catch (err) {
      const message = err instanceof Error ? err.message : '등급 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (userId: number) => {
    setProcessingId(userId);
    try {
      await api.put(`/platform-admin/accounts/${userId}/revoke`);
      showSnackbar('플랫폼 관리자 권한을 해제했습니다.', 'success');
      setPageData(await fetchAccounts(searchParams, page));
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
            to="/admin/accounts/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <UserPlus size={16} />
            관리자 추가
          </Link>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="아이디" className="w-40">
          <input
            type="text"
            value={formValues.loginId}
            onChange={(e) => setFormValues((prev) => ({ ...prev, loginId: e.target.value }))}
            placeholder="아이디"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </SearchField>

        <SearchField label="이름" className="w-32">
          <input
            type="text"
            value={formValues.name}
            onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="이름"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </SearchField>

        <SearchField label="이메일" className="w-48">
          <input
            type="text"
            value={formValues.email}
            onChange={(e) => setFormValues((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="이메일"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </SearchField>

        <SearchField label="등급">
          <select
            value={formValues.platformRole}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, platformRole: e.target.value as PlatformRole | 'ALL' }))
            }
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={accounts.length === 0}
        emptyMessage="해당 조건의 관리자 계정이 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: handlePageChange,
              }
            : undefined
        }
      >
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
                    {canManageAccounts && !isSelf && account.platformRole ? (
                      <select
                        value={roleDrafts[account.id] ?? account.platformRole}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({ ...prev, [account.id]: e.target.value as PlatformRole }))
                        }
                        disabled={processingId === account.id}
                        className="px-2 py-1 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                      >
                        {ROLE_OPTIONS.filter((option) => option.value !== 'ALL').map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      account.platformRole && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE_CLASS[account.platformRole]}`}
                        >
                          <ShieldCheck size={12} />
                          {account.platformRole}
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!canManageAccounts ? (
                      <p className="text-right text-xs text-gray-400">조회 전용 계정</p>
                    ) : isSelf ? (
                      <p className="text-right text-xs text-gray-400">본인 계정은 변경할 수 없음</p>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {roleDrafts[account.id] && roleDrafts[account.id] !== account.platformRole && (
                          <button
                            onClick={() => handleUpdateRole(account.id)}
                            disabled={processingId === account.id}
                            className="px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                          >
                            등급 저장
                          </button>
                        )}
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
      </ListContainer>
    </div>
  );
};
