import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, History, Loader2, Package, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, FinalPricePreview, HistoryButton, HistoryModal, PeriodStatusBadge, PlanDiscountPeriodSection } from './billingCatalog/components';
import { UNIT_PRODUCT_TYPE_LABEL, formatDiscount, formatPrice, planSubtotal } from './billingCatalog/constants';
import type { BillingPlanHistorySummary, BillingPlanSummary, CeremonyUsingPlanSummary, PageResponse } from '../types';

const CEREMONY_STATUS_LABEL: Record<string, string> = {
  DRAFT: '준비 중(플랜 미확정)',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

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

  const [isCeremoniesOpen, setIsCeremoniesOpen] = useState(false);
  const [ceremonies, setCeremonies] = useState<CeremonyUsingPlanSummary[]>([]);
  const [isCeremoniesLoading, setIsCeremoniesLoading] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/platform-admin/billing-plans/${planId}`);
      showSnackbar('과금 플랜을 삭제했습니다.', 'success');
      navigate('/admin/billing-catalog/plans', { replace: true });
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '과금 플랜 삭제에 실패했습니다.', 'error');
    } finally {
      setIsDeleting(false);
    }
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

  /**
   * "이 플랜을 쓰는 행사" 조직 횡단 목록 — 카탈로그 관리 화면(항상 "오늘" 가격만 보여준다)
   * 만으로는 특정 행사가 실제로 어떤 값에 고정돼 있는지 알 수 없다는 문제의 발견성 개선용
   * (2026-09-11 사용자 요청 — signstage-docs
   * business/ceremony-plan-price-snapshot-consistency-review.md 3.5절). 각 행에서 그 행사의
   * "행사 이력" 화면(플랜 선택 이력)으로 이어간다.
   */
  const openCeremonies = async () => {
    setIsCeremoniesOpen(true);
    setIsCeremoniesLoading(true);
    try {
      const response = await api.get(`/platform-admin/billing-plans/${planId}/ceremonies?size=50`);
      setCeremonies((response.data as PageResponse<CeremonyUsingPlanSummary>).content);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '이 플랜을 쓰는 행사 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setIsCeremoniesLoading(false);
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
              {canManage && plan.canDelete && (
                <Button variant="danger" size="sm" onClick={() => setIsDeleteConfirmOpen(true)}>
                  <Trash2 size={12} />
                  삭제
                </Button>
              )}
            </div>
          </div>

          {canManage && !plan.canDelete && (
            <p className="mb-4 text-xs text-gray-400">
              행사·조직 구독·조직×플랜 할인 오버라이드 중 하나라도 사용된 적이 있어 삭제할 수 없습니다.
            </p>
          )}

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
              label="단위 상품 구성"
              value={
                plan.unitProducts.length === 0
                  ? '없음'
                  : plan.unitProducts
                      .map(
                        (line) =>
                          // 구성에 올라간 상품은(포함 수량이 0이든 N이든) 전부 그 자체로 추가구매
                          // 후보다(2026-09-10, purchasable 필드 폐지) — 0이면 기본 포함 없이
                          // 추가구매만 가능하다는 뜻이다.
                          `${line.unitProductName}(${UNIT_PRODUCT_TYPE_LABEL[line.unitProductType] ?? line.unitProductType}) ${
                            line.includedQuantity > 0 ? `기본 ${line.includedQuantity} · 추가구매 가능` : '추가구매만 가능'
                          }`,
                      )
                      .join(', ')
              }
            />
            <DetailRow
              label="사용 건수"
              value={
                <div className="flex items-center gap-2">
                  <span>{plan.usageCount}건</span>
                  {plan.usageCount > 0 && (
                    <button
                      onClick={openCeremonies}
                      className="text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline"
                    >
                      이 플랜을 쓰는 행사 보기
                    </button>
                  )}
                </div>
              }
            />
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

          <Modal
            open={isCeremoniesOpen}
            onClose={() => setIsCeremoniesOpen(false)}
            title="이 플랜을 쓰는 행사"
            widthClassName="max-w-lg"
          >
            {isCeremoniesLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : ceremonies.length === 0 ? (
              <p className="text-sm text-gray-400">이 플랜을 쓰는 행사가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {ceremonies.map((c) => (
                  <li key={c.ceremonyId} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/organizations/${c.organizationId}/ceremonies/${c.ceremonyId}/history`}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-950 hover:underline"
                      >
                        <History size={13} className="text-gray-400 shrink-0" />
                        {c.ceremonyTitle}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Building2 size={11} />
                        {c.organizationName} · {CEREMONY_STATUS_LABEL[c.status] ?? c.status}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDateTime(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Modal>

          <ConfirmDialog
            open={isDeleteConfirmOpen}
            title="과금 플랜 삭제"
            message={`"${plan.name}" 과금 플랜을 정말 삭제할까요? 삭제하면 되돌릴 수 없습니다.`}
            isSubmitting={isDeleting}
            onConfirm={handleDelete}
            onCancel={() => setIsDeleteConfirmOpen(false)}
          />
        </>
      )}
    </div>
  );
};
