import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { PeriodStatusBadge } from './billingCatalog/components';
import {
  CATALOG_PAGE_SIZE,
  MANAGEABLE_OPTIONAL_FEATURE_CODES,
  OPTIONAL_FEATURE_CATEGORY_LABEL,
  OPTIONAL_FEATURE_CODE_LABEL,
  formatDiscount,
  formatPrice,
  formatSupplyPrice,
} from './billingCatalog/constants';
import type { OptionalFeatureCode, OptionalFeatureSummary } from '../types';

const CODE_OPTIONS: Array<{ value: OptionalFeatureCode | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  ...MANAGEABLE_OPTIONAL_FEATURE_CODES.map((code) => ({ value: code, label: OPTIONAL_FEATURE_CODE_LABEL[code] ?? code })),
];

/** 선택옵션 목록 — AdminBillingPlanList.tsx와 같은 구조(검색 → 목록 → 페이지네비게이션, 클라이언트
 * 사이드 검색/페이지네이션). 관리 대상 코드(MANAGEABLE_OPTIONAL_FEATURE_CODES)만 보여준다 —
 * 통합/폐지된 레거시 코드(SIGNER_FIELD_ZOOM 등)는 기존 인라인 섹션과 동일하게 관리 화면에서 뺀다. */
export const AdminOptionalFeatureList: FC = () => {
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [codeDraft, setCodeDraft] = useState<OptionalFeatureCode | 'ALL'>('ALL');
  const [nameQuery, setNameQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState<OptionalFeatureCode | 'ALL'>('ALL');
  const [page, setPage] = useState(0);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/optional-features');
        const manageable = (response.data as OptionalFeatureSummary[]).filter((f) =>
          MANAGEABLE_OPTIONAL_FEATURE_CODES.includes(f.code),
        );
        if (!cancelled) setFeatures(manageable);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '선택옵션 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(0);
    setNameQuery(nameDraft.trim());
    setCodeQuery(codeDraft);
  };

  const handleReset = () => {
    setPage(0);
    setNameDraft('');
    setCodeDraft('ALL');
    setNameQuery('');
    setCodeQuery('ALL');
  };

  const filtered = features.filter(
    (f) =>
      (!nameQuery || f.name.toLowerCase().includes(nameQuery.toLowerCase())) && (codeQuery === 'ALL' || f.code === codeQuery),
  );
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / CATALOG_PAGE_SIZE));
  const pageItems = filtered.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Sparkles size={20} className="text-gray-400" />
            선택옵션
          </h1>
          <p className="mt-1 text-sm text-gray-500">행사 선택옵션 카탈로그입니다. 등록/수정은 PLATFORM_OPS 이상만 할 수 있습니다.</p>
        </div>
        {canManage && (
          <Button to="/admin/billing-catalog/optional-features/new">
            <Plus size={16} />
            새로 만들기
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="이름" className="w-56">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="선택옵션 이름"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </SearchField>
        <SearchField label="코드">
          <select
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value as OptionalFeatureCode | 'ALL')}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {CODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={pageItems.length === 0}
        emptyMessage="해당 조건의 선택옵션이 없습니다."
        pagination={{ page, totalPages, hasNext: page < totalPages - 1, totalElements, onPageChange: setPage }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">코드</th>
              <th className="text-left px-4 py-3 font-medium">이름</th>
              <th className="text-left px-4 py-3 font-medium">공급가/판매가</th>
              <th className="text-left px-4 py-3 font-medium">할인</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-left px-4 py-3 font-medium">분류</th>
              <th className="text-right px-4 py-3 font-medium">사용 건수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((feature) => (
              <tr key={feature.id}>
                <td className="px-4 py-3 text-gray-600">{OPTIONAL_FEATURE_CODE_LABEL[feature.code] ?? feature.code}</td>
                <td className="px-4 py-3 font-medium">
                  <Link to={`/admin/billing-catalog/optional-features/${feature.id}`} className="text-gray-950 hover:underline">
                    {feature.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {feature.salePrice === null
                    ? '-'
                    : `${formatSupplyPrice(feature.supplyPrice, feature.currencyCode ?? 'KRW')} / ${formatPrice(feature.salePrice, feature.currencyCode ?? 'KRW')}`}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {feature.discountType === null || feature.discountValue === null
                    ? '-'
                    : formatDiscount(feature.discountType, feature.discountValue)}
                </td>
                <td className="px-4 py-3">
                  <PeriodStatusBadge status={feature.periodStatus} />
                </td>
                <td className="px-4 py-3 text-gray-600">{OPTIONAL_FEATURE_CATEGORY_LABEL[feature.category] ?? feature.category}</td>
                <td className="px-4 py-3 text-right text-gray-500">{feature.usageCount}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
