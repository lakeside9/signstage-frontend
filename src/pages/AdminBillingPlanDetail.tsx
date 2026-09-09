import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, Pencil } from 'lucide-react';
import { Button } from '../components/Button';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, HistoryButton, HistoryModal, PeriodStatusBadge, PricePeriodSection } from './billingCatalog/components';
import { PLAN_CAPACITY_TYPE_OPTIONS, formatDiscount, formatPrice, formatSupplyPrice } from './billingCatalog/constants';
import type { BillingPlanHistorySummary, BillingPlanSummary, CapacityAddOnSummary, OptionalFeatureSummary } from '../types';

/** 과금 플랜 상세 — 파트너관리(AdminOrganizationDetail.tsx)와 같은 구성: 읽기 전용 정보 +
 * 이력/가격 기간 관리는 모달, 수정은 별도 페이지(사용자 요청, 2026-09-09)로 이동한다. */
export const AdminBillingPlanDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = Number(id);

  const [plan, setPlan] = useState<BillingPlanSummary | null>(null);
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<BillingPlanHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const load = async () => {
    const [plansRes, featuresRes, addOnsRes] = await Promise.all([
      api.get('/billing-plans'),
      api.get('/optional-features'),
      api.get('/capacity-addons'),
    ]);
    const found = (plansRes.data as BillingPlanSummary[]).find((p) => p.id === planId) ?? null;
    return { found, features: featuresRes.data as OptionalFeatureSummary[], addOns: addOnsRes.data as CapacityAddOnSummary[] };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (!cancelled) {
          if (!data.found) {
            showSnackbar('과금 플랜을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/plans', { replace: true });
            return;
          }
          setPlan(data.found);
          setFeatures(data.features);
          setAddOns(data.addOns);
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

  const featureName = (fid: number) => features.find((f) => f.id === fid)?.name ?? `#${fid}`;
  const addOnLabel = (aid: number) => {
    const addOn = addOns.find((a) => a.id === aid);
    if (!addOn) return `#${aid}`;
    const primary = `${addOn.capacityType} +${addOn.unitAmount}`;
    return addOn.secondaryCapacityType ? `${primary} · ${addOn.secondaryCapacityType} +${addOn.secondaryUnitAmount}` : primary;
  };

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
              label="공급가/판매가"
              value={
                plan.salePrice === null
                  ? '-'
                  : `${formatSupplyPrice(plan.supplyPrice, plan.currencyCode ?? 'KRW')} / ${formatPrice(plan.salePrice, plan.currencyCode ?? 'KRW')}`
              }
            />
            <DetailRow
              label="할인"
              value={plan.discountType === null || plan.discountValue === null ? '-' : formatDiscount(plan.discountType, plan.discountValue)}
            />
            <DetailRow
              label="판매 기간"
              value={plan.effectiveFrom ? `${plan.effectiveFrom} ~ ${plan.effectiveTo ?? '무기한'}` : '-'}
            />
            <DetailRow label="상태" value={<PeriodStatusBadge status={plan.periodStatus} />} />
            <DetailRow
              label="한도"
              value={PLAN_CAPACITY_TYPE_OPTIONS.map((option) => `${option.label} ${plan.capacities[option.value]}`).join(' · ')}
            />
            <DetailRow label="포함 선택옵션" value={plan.optionalFeatureIds.map(featureName).join(', ') || '없음'} />
            <DetailRow label="구매 가능 추가구매 상품" value={plan.capacityAddOnIds.map(addOnLabel).join(', ') || '없음'} />
            <DetailRow label="사용 건수" value={`${plan.usageCount}건`} />
            <DetailRow label="생성일" value={formatDateTime(plan.createdAt)} />
          </div>

          <PricePeriodSection
            itemId={plan.id}
            basePath="/platform-admin/billing-plans"
            canManage={canManage}
            onChanged={() => load().then((data) => data.found && setPlan(data.found))}
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
                  서명자 {h.capacities.SIGNERS}명 · 템플릿 {h.capacities.TEMPLATES}건 · 테스트 {h.capacities.TEST_EVENTS}건 · 리허설{' '}
                  {h.capacities.REHEARSAL_EVENTS}건 · 본행사 {h.capacities.MAIN_EVENTS}건
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
