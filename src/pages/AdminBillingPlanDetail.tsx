import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, Pencil } from 'lucide-react';
import { Button } from '../components/Button';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, FinalPricePreview, HistoryButton, HistoryModal, PeriodStatusBadge, PlanDiscountPeriodSection } from './billingCatalog/components';
import { UNIT_PRODUCT_TYPE_LABEL, formatDiscount, formatPrice, planSubtotal } from './billingCatalog/constants';
import type { BillingPlanHistorySummary, BillingPlanSummary } from '../types';

/** 과금 플랜 상세 — 파트너관리(AdminOrganizationDetail.tsx)와 같은 구성: 읽기 전용 정보 +
 * 이력/할인 기간 관리는 모달, 수정은 별도 페이지(사용자 요청, 2026-09-09)로 이동한다. 플랜은
 * 자기 가격이 없다 — 포함 단위 상품 구성으로 소계를 보여준다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10, 3.3절). */
export const AdminBillingPlanDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = Number(id);

  const [plan, setPlan] = useState<BillingPlanSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<BillingPlanHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const load = async () => {
    const plansRes = await api.get('/billing-plans');
    return (plansRes.data as BillingPlanSummary[]).find((p) => p.id === planId) ?? null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await load();
        if (!cancelled) {
          if (!found) {
            showSnackbar('과금 플랜을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/plans', { replace: true });
            return;
          }
          setPlan(found);
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '과금 플랜을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const openHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/billing-plans/${planId}/history`);
      setHistory(response.data as BillingPlanHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <div>
      <Link
        to="/admin/billing-catalog/plans"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        과금 플랜 목록으로
      </Link>

      {isLoading || !plan ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
              <Package size={20} className="text-gray-400" />
              {plan.name}
            </h1>
            <div className="flex items-center gap-2">
              <HistoryButton onClick={openHistory} />
              {canManage && (
                <Button to={`/admin/billing-catalog/plans/${plan.id}/edit`} variant="secondary" size="sm">
                  <Pencil size={12} />
                  수정
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            <DetailRow label="이름" value={plan.name} />
            <DetailRow
              label="플랜 유형"
              value={
                plan.subscription
                  ? `구독형 — ${plan.subscriptionType === 'PERIOD_AND_COUNT' ? `${plan.subscriptionPeriodMonths}개월 ` : ''}${plan.subscriptionAllowedCount}회`
                  : '일반'
              }
            />
            <DetailRow
              label="단위 상품 소계"
              value={formatPrice(planSubtotal(plan.unitProducts), plan.unitProducts[0]?.currencyCode ?? 'KRW')}
            />
            <DetailRow
              label="할인"
              value={
                plan.discountType === null || plan.discountValue === null ? (
                  '-'
                ) : (
                  <div>
                    <p>{formatDiscount(plan.discountType, plan.discountValue)}</p>
                    <FinalPricePreview
                      salePrice={planSubtotal(plan.unitProducts)}
                      discountType={plan.discountType}
                      discountValue={plan.discountValue}
                      currencyCode={plan.unitProducts[0]?.currencyCode ?? 'KRW'}
                    />
                  </div>
                )
              }
            />
            <DetailRow
              label="할인 적용 기간"
              value={plan.effectiveFrom ? `${plan.effectiveFrom} ~ ${plan.effectiveTo ?? '무기한'}` : '-'}
            />
            <DetailRow label="상태" value={<PeriodStatusBadge status={plan.periodStatus} />} />
            <DetailRow
              label="포함 단위 상품"
              value={
                plan.unitProducts.length === 0
                  ? '없음'
                  : plan.unitProducts
                      .map(
                        (line) =>
                          `${line.unitProductName}(${UNIT_PRODUCT_TYPE_LABEL[line.unitProductType] ?? line.unitProductType}) 기본 ${line.includedQuantity}${line.purchasable ? ' · 추가구매 가능' : ''}`,
                      )
                      .join(', ')
              }
            />
            <DetailRow label="사용 건수" value={`${plan.usageCount}건`} />
            <DetailRow label="생성일" value={formatDateTime(plan.createdAt)} />
          </div>

          <PlanDiscountPeriodSection
            itemId={plan.id}
            canManage={canManage}
            onChanged={() => load().then((found) => found && setPlan(found))}
            showSnackbar={showSnackbar}
          />

          <HistoryModal
            open={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            title="과금 플랜 변경 이력"
            isLoading={isHistoryLoading}
            isEmpty={history.length === 0}
          >
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <p className="text-sm text-gray-950 font-medium">{h.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {h.unitProducts.length === 0
                    ? '포함 단위 상품 없음'
                    : h.unitProducts.map((line) => `${line.unitProductName} 기본 ${line.includedQuantity}`).join(' · ')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(h.createdAt)}</p>
              </li>
            ))}
          </HistoryModal>
        </>
      )}
    </div>
  );
};
