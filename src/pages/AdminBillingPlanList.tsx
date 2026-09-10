import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { PeriodStatusBadge } from './billingCatalog/components';
import { CATALOG_PAGE_SIZE, PLAN_INCLUDABLE_UNIT_PRODUCT_TYPES, calculateFinalPrice, formatDiscount, formatPrice, planSubtotal } from './billingCatalog/constants';
import type { BillingPlanSummary } from '../types';

/**
 * 과금 플랜 목록 — signstage-docs frontend/list-screen-convention.md 구조(검색 → 목록 →
 * 페이지네비게이션)를 따른다. `GET /api/billing-plans`가 조직 스코프 없는 전역 카탈로그라
 * 서버 검색/페이지네이션을 지원하지 않아(누구든 전체 목록을 한 번에 받는다), 여기서는
 * 클라이언트 사이드로 검색·페이지를 자른다. 플랜은 자기 가격이 없다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10) — "판매가"
 * 열은 포함된 단위 상품 소계(subtotal)로 대체됐다.
 */
export const AdminBillingPlanList: FC = () => {
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [page, setPage] = useState(0);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/billing-plans');
        if (!cancelled) setPlans(response.data as BillingPlanSummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '과금 플랜 목록을 불러오지 못했습니다.', 'error');
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
  };

  const handleReset = () => {
    setPage(0);
    setNameDraft('');
    setNameQuery('');
  };

  const filtered = nameQuery
    ? plans.filter((plan) => plan.name.toLowerCase().includes(nameQuery.toLowerCase()))
    : plans;
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / CATALOG_PAGE_SIZE));
  const pageItems = filtered.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Package size={20} className="text-gray-400" />
            과금 플랜
          </h1>
          <p className="mt-1 text-sm text-gray-500">행사 과금 플랜 카탈로그입니다. 등록/수정은 PLATFORM_OPS 이상만 할 수 있습니다.</p>
        </div>
        {canManage && (
          <Button to="/admin/billing-catalog/plans/new">
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
            placeholder="플랜 이름"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={pageItems.length === 0}
        emptyMessage="해당 조건의 과금 플랜이 없습니다."
        pagination={{ page, totalPages, hasNext: page < totalPages - 1, totalElements, onPageChange: setPage }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">이름</th>
              <th className="text-left px-4 py-3 font-medium">단위 상품 소계</th>
              <th className="text-left px-4 py-3 font-medium">할인</th>
              <th className="text-left px-4 py-3 font-medium">예상 최종가</th>
              <th className="text-left px-4 py-3 font-medium">한도(서명자/템플릿/테스트/리허설/본행사)</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">사용 건수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((plan) => {
              const currencyCode = plan.unitProducts[0]?.currencyCode ?? 'KRW';
              const subtotal = planSubtotal(plan.unitProducts);
              return (
                <tr key={plan.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/admin/billing-catalog/plans/${plan.id}`} className="text-gray-950 hover:underline">
                      {plan.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatPrice(subtotal, currencyCode)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {plan.discountType === null || plan.discountValue === null ? '-' : formatDiscount(plan.discountType, plan.discountValue)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {plan.discountType === null || plan.discountValue === null
                      ? '-'
                      : formatPrice(calculateFinalPrice(subtotal, plan.discountType, plan.discountValue), currencyCode)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {PLAN_INCLUDABLE_UNIT_PRODUCT_TYPES.map(
                      (type) => plan.unitProducts.find((line) => line.unitProductType === type)?.includedQuantity ?? 0,
                    ).join('/')}
                  </td>
                  <td className="px-4 py-3">
                    <PeriodStatusBadge status={plan.periodStatus} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{plan.usageCount}건</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
