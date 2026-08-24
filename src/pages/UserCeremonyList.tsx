import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileSignature, Plus } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { BillingPlanSummary, CeremonyStatus, CeremonySummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: CeremonyStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '플랜 확정 대기' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'COMPLETED', label: '완료' },
];

const STATUS_BADGE_CLASS: Record<CeremonyStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABEL: Record<CeremonyStatus, string> = {
  DRAFT: '플랜 확정 대기',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
};

interface SearchParams {
  title: string;
  status: CeremonyStatus | 'ALL';
}

const EMPTY_SEARCH: SearchParams = { title: '', status: 'ALL' };

/**
 * 행사(Ceremony) 목록(`/ceremonies/:organizationId`). signstage-docs
 * frontend/list-screen-convention.md의 "검색 영역 → 목록 → 페이지네비게이션" 3단 구조를
 * 따른다(`AdminOrganizationList.tsx`와 같은 패턴) — 검색은 행사명(부분 일치)/행사 상태(정확
 * 일치)로 한다.
 *
 * OWNER/ADMIN은 조직의 전체 행사를, OPERATOR는 배정된 행사만 본다(백엔드가 이미 필터링해서
 * 돌려준다 — 프런트는 받은 목록을 그대로 보여주기만 한다).
 */
export const UserCeremonyList: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();

  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<CeremonySummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const query = new URLSearchParams();
        if (searchParams.title) query.set('title', searchParams.title);
        if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));

        const [ceremoniesRes, plansRes] = await Promise.all([
          api.get(`/organizations/${organizationId}/ceremonies?${query.toString()}`),
          api.get('/billing-plans'),
        ]);
        if (!cancelled) {
          setPageData(ceremoniesRes.data as PageResponse<CeremonySummary>);
          setPlans(plansRes.data as BillingPlanSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '행사 목록을 불러오지 못했습니다.';
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
  }, [organizationId, searchParams, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    // 새 객체로 복사해서 넣는다 — formValues가 searchParams와 참조가 같으면(예: 아무 것도
    // 안 건드리고 바로 "검색"을 누르거나, 검색 조건을 안 바꾸고 다시 누르는 경우) React가
    // 같은 참조는 상태 변경으로 안 치고 넘어가 아래 useEffect가 다시 안 돌고, 방금 켠
    // isLoading만 true로 영원히 남는다(2026-08-25 발견 — 검색 화면 공통 버그).
    setSearchParams({ ...formValues });
  };

  const handleReset = () => {
    setIsLoading(true);
    setFormValues(EMPTY_SEARCH);
    setPage(0);
    setSearchParams({ ...EMPTY_SEARCH });
  };

  const handlePageChange = (nextPage: number) => {
    setIsLoading(true);
    setPage(nextPage);
  };

  const planName = (billingPlanId: number) => plans.find((plan) => plan.id === billingPlanId)?.name ?? `#${billingPlanId}`;

  const ceremonies = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950">행사 관리</h1>
          <p className="mt-1 text-sm text-gray-500">행사 마스터(Ceremony) 목록입니다. 하나의 행사 아래 여러 하위 행사(TEST/MAIN)를 둘 수 있습니다.</p>
        </div>
        <Link
          to={`/ceremonies/${organizationId}/new`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          새 행사
        </Link>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="행사명" className="w-56">
          <input
            type="text"
            value={formValues.title}
            onChange={(e) => setFormValues((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="행사 이름"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </SearchField>

        <SearchField label="행사 상태">
          <select
            value={formValues.status}
            onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value as CeremonyStatus | 'ALL' }))}
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
        isEmpty={ceremonies.length === 0}
        emptyMessage="해당 조건의 행사가 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">행사명</th>
              <th className="text-left px-4 py-3 font-medium">행사 상태</th>
              <th className="text-left px-4 py-3 font-medium">행사 주관 기관</th>
              <th className="text-left px-4 py-3 font-medium">행사 주관 부서</th>
              <th className="text-left px-4 py-3 font-medium">담당자명</th>
              <th className="text-right px-4 py-3 font-medium">생성일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ceremonies.map((ceremony) => (
              <tr key={ceremony.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link
                    to={`/ceremonies/${organizationId}/${ceremony.id}`}
                    className="flex items-center gap-1.5 text-gray-950 hover:underline"
                  >
                    <FileSignature size={14} className="text-gray-400 shrink-0" />
                    {ceremony.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-400">플랜: {planName(ceremony.billingPlanId)}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[ceremony.status]}`}
                  >
                    {STATUS_LABEL[ceremony.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{ceremony.organizingInstitution || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{ceremony.organizingDepartment || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{ceremony.contactName || '-'}</td>
                <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                  {new Date(ceremony.createdAt).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
