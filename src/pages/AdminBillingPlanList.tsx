import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { PeriodStatusBadge } from './billingCatalog/components';
import { CATALOG_PAGE_SIZE, ESSENTIAL_UNIT_PRODUCT_TYPES, calculateFinalPrice, formatDiscount, formatPrice, planSubtotal } from './billingCatalog/constants';
import type { BillingPlanSummary } from '../types';

type TypeFilter = 'ALL' | 'GENERAL' | 'SUBSCRIPTION';

const TYPE_BADGE_CLASS: Record<'GENERAL' | 'SUBSCRIPTION', string> = {
  GENERAL: 'bg-gray-100 text-gray-500 border-gray-200',
  SUBSCRIPTION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

/**
 * 과금 플랜 목록 — signstage-docs frontend/list-screen-convention.md 구조(검색 → 목록 →
 * 페이지네비게이션)를 따른다. `GET /api/billing-plans`가 조직 스코프 없는 전역 카탈로그라
 * 서버 검색/페이지네이션을 지원하지 않아(누구든 전체 목록을 한 번에 받는다), 여기서는
 * 클라이언트 사이드로 검색·페이지를 자른다. 플랜은 자기 가격이 없다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10) — "판매가"
 * 열은 포함된 단위 상품 소계(subtotal)로 대체됐다.
 *
 * <p>"구독 플랜 카탈로그"(옛 `AdminSubscriptionPlanCatalog.tsx`,
 * `/admin/billing-catalog/subscription-plans`)를 여기로 통합했다(2026-09-14, signstage-docs
 * business/platform-admin-partner-ux-confusion-review.md 3.1절 "안 B" 채택) — 구독형 플랜도
 * 결국 같은 `BillingPlan` 테이블·같은 목록 API(`GET /billing-plans`)를 다른 렌즈로 보여주던
 * 화면이라, 메뉴 2개로 쪼개 놓은 것 자체가 "선택옵션/용량 추가구매 → 단위 상품" 통합
 * (`billing-catalog-unit-product-model-redesign-review.md`)과 같은 종류의 문제였다. "유형"
 * 필터(전체/일반/구독형)를 추가하고, "구독형"으로 좁히면 컬럼 자체를 구독
 * 조건(구독 유형/기간/허용 횟수) 중심으로 바꾼다 — 구독형 플랜에는 애초에 의미 없는
 * 단위 상품 소계/할인/예상 최종가/한도 컬럼을 "-"로 채우는 대신, 그 조건을 보여주는
 * 옛 `AdminSubscriptionPlanCatalog.tsx`의 컬럼 구성을 그대로 재사용했다. "전체"에서는
 * 기존 컬럼을 그대로 쓰되 "유형" 배지 컬럼을 얹어 구독형 행을 구분한다. `?type=SUBSCRIPTION`
 * 쿼리로 구독형만 미리 필터링해 열 수 있다 — 옛 메뉴 경로
 * (`/admin/billing-catalog/subscription-plans`)는 여기로 리다이렉트된다(`App.tsx`), 메뉴
 * 자체는 비활성화했다(마이그레이션 `V202609141200`, 삭제 아님 — 이 프로젝트 관례). "구독 요청
 * 관리"(`AdminSubscriptionRequestList.tsx`)는 카탈로그 열람이 아니라 신청 승인/반려
 * 워크플로라 통합 대상이 아니다 — 그대로 둔다.
 */
export const AdminBillingPlanList: FC = () => {
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [page, setPage] = useState(0);
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    initialType === 'SUBSCRIPTION' || initialType === 'GENERAL' ? initialType : 'ALL',
  );

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
    setTypeFilter('ALL');
  };

  const handleTypeChange = (value: TypeFilter) => {
    setPage(0);
    setTypeFilter(value);
  };

  const filtered = plans.filter((plan) => {
    if (typeFilter === 'GENERAL' && plan.subscription) return false;
    if (typeFilter === 'SUBSCRIPTION' && !plan.subscription) return false;
    return !nameQuery || plan.name.toLowerCase().includes(nameQuery.toLowerCase());
  });
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / CATALOG_PAGE_SIZE));
  const pageItems = filtered.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE);
  const showSubscriptionColumns = typeFilter === 'SUBSCRIPTION';
  const showTypeBadge = typeFilter === 'ALL';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Package size={20} className="text-gray-400" />
            과금 플랜
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {typeFilter === 'SUBSCRIPTION'
              ? '조직이 신청 → 승인받아야 쓸 수 있는 구독형(N회 이용권) 플랜입니다. 신청 승인/반려는 "구독 요청 관리"에서 합니다.'
              : '행사 과금 플랜 카탈로그입니다. 등록/수정은 PLATFORM_OPS 이상만 할 수 있습니다.'}
          </p>
        </div>
        {canManage && (
          <Button to="/admin/billing-catalog/plans/new">
            <Plus size={16} />
            새로 만들기
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="유형">
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value as TypeFilter)}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            <option value="ALL">전체</option>
            <option value="GENERAL">일반</option>
            <option value="SUBSCRIPTION">구독형</option>
          </select>
        </SearchField>
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
        emptyMessage={typeFilter === 'SUBSCRIPTION' ? '해당 조건의 구독형 플랜이 없습니다.' : '해당 조건의 과금 플랜이 없습니다.'}
        pagination={{ page, totalPages, hasNext: page < totalPages - 1, totalElements, onPageChange: setPage }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">이름</th>
              {showTypeBadge && <th className="text-left px-4 py-3 font-medium">유형</th>}
              {showSubscriptionColumns ? (
                <>
                  <th className="text-left px-4 py-3 font-medium">구독 유형</th>
                  <th className="text-left px-4 py-3 font-medium">기간</th>
                  <th className="text-left px-4 py-3 font-medium">허용 횟수</th>
                </>
              ) : (
                <>
                  <th className="text-left px-4 py-3 font-medium">단위 상품 소계</th>
                  <th className="text-left px-4 py-3 font-medium">할인</th>
                  <th className="text-left px-4 py-3 font-medium">예상 최종가</th>
                  <th className="text-left px-4 py-3 font-medium">한도(서명자/템플릿/테스트/리허설/본행사)</th>
                </>
              )}
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
                  {showTypeBadge && (
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                          plan.subscription ? TYPE_BADGE_CLASS.SUBSCRIPTION : TYPE_BADGE_CLASS.GENERAL
                        }`}
                      >
                        {plan.subscription ? '구독형' : '일반'}
                      </span>
                    </td>
                  )}
                  {showSubscriptionColumns ? (
                    <>
                      <td className="px-4 py-3 text-gray-600">
                        {plan.subscriptionType === 'PERIOD_AND_COUNT' ? '기간+횟수' : '횟수제'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {plan.subscriptionPeriodMonths ? `${plan.subscriptionPeriodMonths}개월` : '무기한'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{plan.subscriptionAllowedCount}회</td>
                    </>
                  ) : (
                    <>
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
                        {ESSENTIAL_UNIT_PRODUCT_TYPES.map(
                          (type) => plan.unitProducts.find((line) => line.unitProductType === type)?.includedQuantity ?? 0,
                        ).join('/')}
                      </td>
                    </>
                  )}
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
