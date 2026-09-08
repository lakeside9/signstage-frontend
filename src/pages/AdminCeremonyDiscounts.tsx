import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Percent } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/internationalization';
import type { CeremonyDiscountSummary, CeremonyStatus, DiscountType, PageResponse, PlatformAdminOrganizationSummary } from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: CeremonyStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '준비 중(플랜 미확정)' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'COMPLETED', label: '완료' },
];

const STATUS_LABEL: Record<CeremonyStatus, string> = {
  DRAFT: '준비 중',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

const STATUS_BADGE_CLASS: Record<CeremonyStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatCurrency(discountValue);

type DiscountFilter = 'DISCOUNTED' | 'ALL' | 'UNDISCOUNTED';

const DISCOUNT_FILTER_OPTIONS: Array<{ value: DiscountFilter; label: string }> = [
  { value: 'DISCOUNTED', label: '할인 있는 것만' },
  { value: 'ALL', label: '전체' },
  { value: 'UNDISCOUNTED', label: '할인 없는 것만' },
];

interface SearchParams {
  organizationId: number | '';
  status: CeremonyStatus | 'ALL';
  discountFilter: DiscountFilter;
}

const EMPTY_SEARCH: SearchParams = { organizationId: '', status: 'ALL', discountFilter: 'DISCOUNTED' };

const fetchCeremonyDiscounts = async (search: SearchParams, page: number): Promise<PageResponse<CeremonyDiscountSummary>> => {
  const query = new URLSearchParams();
  if (search.organizationId !== '') query.set('organizationId', String(search.organizationId));
  if (search.status !== 'ALL') query.set('status', search.status);
  if (search.discountFilter !== 'ALL') query.set('hasFinalDiscount', search.discountFilter === 'DISCOUNTED' ? 'true' : 'false');
  query.set('page', String(page));
  query.set('size', String(PAGE_SIZE));
  const response = await api.get(`/platform-admin/ceremonies?${query.toString()}`);
  return response.data as PageResponse<CeremonyDiscountSummary>;
};

/**
 * 행사 건별 재량 할인 조직 횡단 목록 — 조직 상세 화면에 묻혀 있던 `CeremonyFinalDiscountPanel`을
 * 분리했다(signstage-docs business/discount-management-screen-separation-review.md 결정
 * #5(2026-09-08)). 검색 영역은 `signstage-docs frontend/list-screen-convention.md`의
 * "검색 영역 → 목록 → 페이지네비게이션" 3단 구조를 따른다 — 조직/상태/할인 여부 모두 백엔드가
 * 이미 지원하는 쿼리 파라미터(`hasFinalDiscount`)를 그대로 쓴다(장식용 UI가 아니다). 기본
 * 필터는 "할인 있는 것만"이다(같은 문서 6장 결정 #1) — "전체"/"할인 없는 것만"으로 바꿀 수
 * 있다. 상세(값 조회/수정)는 각 행의 "상세" 링크로 별도 화면(`AdminCeremonyDiscountDetail`)에서
 * 한다.
 */
export const AdminCeremonyDiscounts: FC = () => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<CeremonyDiscountSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationSummary[]>([]);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/platform-admin/organizations?size=200');
        const data = (response.data as PageResponse<PlatformAdminOrganizationSummary>).content;
        if (!cancelled) setOrganizations(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '조직 목록을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await fetchCeremonyDiscounts(searchParams, page);
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '행사 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
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
    setSearchParams({ ...formValues });
  };

  const handleReset = () => {
    setIsLoading(true);
    setFormValues(EMPTY_SEARCH);
    setPage(0);
    setSearchParams({ ...EMPTY_SEARCH });
  };

  const ceremonies = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-1.5">
          <Percent size={18} />
          행사 건별 재량 할인
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          품목 할인과 별개로 특정 행사 건에만 추가로 매기는 할인입니다. 조직 전체를 가로질러 볼 수 있고, 값
          조회/수정은 "상세"에서 합니다.
        </p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="조직" className="w-56">
          <select
            value={formValues.organizationId}
            onChange={(e) => setFormValues((prev) => ({ ...prev, organizationId: e.target.value ? Number(e.target.value) : '' }))}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            <option value="">전체</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </SearchField>
        <SearchField label="상태">
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
        <SearchField label="할인 여부">
          <select
            value={formValues.discountFilter}
            onChange={(e) => setFormValues((prev) => ({ ...prev, discountFilter: e.target.value as DiscountFilter }))}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {DISCOUNT_FILTER_OPTIONS.map((option) => (
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
                onPageChange: setPage,
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">조직</th>
              <th className="text-left px-4 py-3 font-medium">행사</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-left px-4 py-3 font-medium">할인</th>
              <th className="text-right px-4 py-3 font-medium">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ceremonies.map((ceremony) => (
              <tr key={ceremony.id}>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/organizations/${ceremony.organizationId}`}
                    className="inline-flex items-center gap-1.5 text-gray-950 hover:underline"
                  >
                    <Building2 size={14} className="text-gray-400" />
                    {ceremony.organizationName}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium text-gray-950">{ceremony.title}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[ceremony.status]}`}
                  >
                    {STATUS_LABEL[ceremony.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{formatDiscount(ceremony.finalDiscountType, ceremony.finalDiscountValue)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/admin/ceremony-discounts/${ceremony.organizationId}/${ceremony.id}`}
                    className="text-xs text-gray-500 hover:text-gray-950 hover:underline"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
