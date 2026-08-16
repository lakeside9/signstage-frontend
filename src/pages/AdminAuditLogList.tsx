import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
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
  CREATE_ORGANIZATION: '조직 등록',
  FORCE_ADD_MEMBER: '멤버 강제 추가',
  FORCE_UPDATE_MEMBER_ROLE: '멤버 역할 강제 변경',
  FORCE_REMOVE_MEMBER: '멤버 강제 제거',
  FORCE_WITHDRAW_USER: '회원 강제 탈퇴',
  UPDATE_ACCOUNT_ROLE: '관리자 등급 변경',
  REJECT_ORGANIZATION_REQUEST: '조직 생성 요청 반려',
};

const ACTION_OPTIONS: Array<{ value: PlatformAdminAction | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  ...(Object.keys(ACTION_LABELS) as PlatformAdminAction[]).map((value) => ({
    value,
    label: ACTION_LABELS[value],
  })),
];

interface SearchParams {
  action: PlatformAdminAction | 'ALL';
}

const EMPTY_SEARCH: SearchParams = { action: 'ALL' };

/**
 * 플랫폼 관리자 제어 행위 감사 로그. 조회 전용이며 PLATFORM_SUPPORT 이상 전체가 볼 수 있다
 * (signstage-docs business/user-organization-design.md 7.4절).
 *
 * 화면 구성은 signstage-docs frontend/list-screen-convention.md의 "검색 영역 → 목록 →
 * 페이지네비게이션" 3단 구조를 따른다(SearchBar/ListContainer 공통 컴포넌트 사용) — 검색
 * 조건이 action 하나뿐이어도 다른 목록 화면과 같은 패턴을 유지한다.
 */
export const AdminAuditLogList: FC = () => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminAuditLogEntry> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const query = new URLSearchParams();
        if (searchParams.action !== 'ALL') query.set('action', searchParams.action);
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

  const entries = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">감사 로그</h1>
        <p className="mt-1 text-sm text-gray-500">
          플랫폼 관리자가 회원/조직에 대해 수행한 제어 행위 기록입니다. 조회 전용입니다.
        </p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="행위">
          <select
            value={formValues.action}
            onChange={(e) => setFormValues({ action: e.target.value as PlatformAdminAction | 'ALL' })}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={entries.length === 0}
        emptyMessage="해당 조건의 감사 로그가 없습니다."
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
      </ListContainer>
    </div>
  );
};
