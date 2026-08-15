import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Building2, Loader2, RotateCcw, Search } from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationStatus, PageResponse, PlatformAdminOrganizationSummary } from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: OrganizationStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'SUSPENDED', label: '정지' },
  { value: 'TRIAL', label: '체험' },
];

const STATUS_BADGE_CLASS: Record<OrganizationStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  TRIAL: 'bg-amber-50 text-amber-700 border-amber-200',
};

interface SearchParams {
  name: string;
  code: string;
  status: OrganizationStatus | 'ALL';
}

const EMPTY_SEARCH: SearchParams = { name: '', code: '', status: 'ALL' };

/**
 * 관리자 대시보드 = 전체 조직 목록/검색 화면. `GET /api/platform-admin/organizations`
 * (조회 전용 — 조직 상태 변경/멤버 강제 조정은 이번 범위 밖). `AdminUserList`와 같은
 * 검색/페이지네이션 패턴을 그대로 따른다.
 * signstage-docs frontend/screen-composition-plan.md 4장 참고.
 */
export const Dashboard: FC = () => {
  const platformAdmin = useAuthStore((state) => state.platformAdmin);

  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminOrganizationSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const query = new URLSearchParams();
        if (searchParams.name) query.set('name', searchParams.name);
        if (searchParams.code) query.set('code', searchParams.code);
        if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));

        const response = await api.get(`/platform-admin/organizations?${query.toString()}`);
        if (!cancelled) {
          setPageData(response.data as PageResponse<PlatformAdminOrganizationSummary>);
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

  const organizations = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">
          {platformAdmin?.name ?? '관리자'}님, 안녕하세요. 전체 조직 목록입니다.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">조직 이름</label>
          <input
            type="text"
            value={formValues.name}
            onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="조직 이름"
            className="w-48 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">조직 코드</label>
          <input
            type="text"
            value={formValues.code}
            onChange={(e) => setFormValues((prev) => ({ ...prev, code: e.target.value }))}
            placeholder="조직 코드"
            className="w-40 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
          <select
            value={formValues.status}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, status: e.target.value as OrganizationStatus | 'ALL' }))
            }
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Search size={14} />
            검색
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
          >
            <RotateCcw size={14} />
            초기화
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : organizations.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">해당 조건의 조직이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">조직 이름</th>
                <th className="text-left px-4 py-3 font-medium">코드</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-left px-4 py-3 font-medium">언어</th>
                <th className="text-right px-4 py-3 font-medium">활성 멤버</th>
                <th className="text-right px-4 py-3 font-medium">생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {organizations.map((organization) => (
                <tr key={organization.id}>
                  <td className="px-4 py-3 text-gray-950 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 size={14} className="text-gray-400" />
                      {organization.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{organization.code}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[organization.status]}`}
                    >
                      {organization.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{organization.defaultLocale}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{organization.activeMemberCount}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {new Date(organization.createdAt).toLocaleDateString('ko-KR')}
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
