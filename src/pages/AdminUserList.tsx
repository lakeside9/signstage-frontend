import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lock, UserPlus } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type { PageResponse, PlatformAdminUserSummary, UserStatus } from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: UserStatus | 'ALL'; label: string }> = [
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

interface SearchParams {
  loginId: string;
  name: string;
  email: string;
  status: UserStatus | 'ALL';
}

const INITIAL_SEARCH: SearchParams = { loginId: '', name: '', email: '', status: 'PENDING' };
const EMPTY_SEARCH: SearchParams = { loginId: '', name: '', email: '', status: 'ALL' };

/**
 * 플랫폼 관리자의 회원 목록/승인 화면. PLATFORM_OPS 이상만 상태 변경(승인/거절)이 실제로 성공한다
 * (PLATFORM_SUPPORT는 조회만 가능 — 백엔드가 403으로 막는다). 본인 계정은 상태를 바꿀 수 없다
 * (백엔드가 PLATFORM_ADMIN_CANNOT_TARGET_SELF로 막고, 이 화면은 그 전에 버튼 자체를 숨긴다).
 *
 * 화면 구성은 signstage-docs frontend/list-screen-convention.md의 "검색 영역 → 목록 →
 * 페이지네비게이션" 3단 구조를 따른다(SearchBar/ListContainer 공통 컴포넌트 사용).
 * signstage-docs backend/signup-approval-implementation-plan.md 4장,
 * business/platform-admin-member-management.md 참고.
 */
export const AdminUserList: FC = () => {
  // 입력 중인 값(폼)과 실제 조회에 쓰인 값(적용된 검색 조건)을 분리한다 —
  // 텍스트 입력마다 매번 API를 호출하지 않고 "검색" 버튼을 눌렀을 때만 반영한다.
  const [formValues, setFormValues] = useState<SearchParams>(INITIAL_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(INITIAL_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminUserSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const currentAdminId = useAuthStore((state) => state.platformAdmin?.id);
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  // setState를 직접 호출하지 않는 순수 조회 함수로 분리한다. 이펙트 본문에서
  // 이름 있는 함수를 호출하는 대신 아래처럼 인라인 IIFE로 setState를 호출해야
  // "이펙트 안에서 곧바로 setState 호출"로 감지되지 않는다(react-hooks/set-state-in-effect).
  const fetchUsers = async (search: SearchParams, pageNumber: number) => {
    const query = new URLSearchParams();
    if (search.loginId) query.set('loginId', search.loginId);
    if (search.name) query.set('name', search.name);
    if (search.email) query.set('email', search.email);
    if (search.status !== 'ALL') query.set('status', search.status);
    query.set('page', String(pageNumber));
    query.set('size', String(PAGE_SIZE));

    const response = await api.get(`/platform-admin/users?${query.toString()}`);
    return response.data as PageResponse<PlatformAdminUserSummary>;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchUsers(searchParams, page);
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

  const handleChangeStatus = async (userId: number, status: 'ACTIVE' | 'DISABLED') => {
    setProcessingId(userId);
    try {
      await api.put(`/platform-admin/users/${userId}/status`, { status });
      showSnackbar(status === 'ACTIVE' ? '승인 처리되었습니다.' : '거절/비활성화 처리되었습니다.', 'success');
      setPageData(await fetchUsers(searchParams, page));
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
        {canManage && (
          <Link
            to="/admin/users/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <UserPlus size={16} />
            회원 추가
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

        <SearchField label="상태">
          <select
            value={formValues.status}
            onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value as UserStatus | 'ALL' }))}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={users.length === 0}
        emptyMessage="해당 조건의 회원이 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const isSelf = user.id === currentAdminId;
              return (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/admin/users/${user.id}`} className="text-gray-950 hover:underline">
                      {user.loginId}
                    </Link>
                    {isSelf && <span className="ml-1.5 text-xs text-gray-400 font-normal">(나)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[user.status]}`}
                    >
                      {user.status}
                    </span>
                    {user.locked && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-red-600" title="로그인 잠김">
                        <Lock size={12} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <p className="text-right text-xs text-gray-400">본인 계정은 변경할 수 없음</p>
                    ) : !canManage ? (
                      <p className="text-right text-xs text-gray-400">조회 전용 계정</p>
                    ) : (
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
