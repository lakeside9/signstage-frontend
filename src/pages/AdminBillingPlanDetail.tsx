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
import { SALES_CHANNEL_LABEL, UNIT_PRODUCT_TYPE_LABEL, formatDiscount, formatPrice, planSubtotal } from './billingCatalog/constants';
import { UNIT_PRODUCT_QUANTITY_UNIT } from './order/constants';
import type { BillingPlanHistorySummary, BillingPlanSummary, CeremonyUsingPlanSummary, PageResponse, PlanUnitProductLineSummary } from '../types';

const CEREMONY_STATUS_LABEL: Record<string, string> = {
  DRAFT: '준비 중(플랜 미확정)',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

/** 단위 상품 구성 표 — 포함 수량은 묶음 수, 총 포함 개수는 묶음 수 × 판매 단위다(2026-11-13).
 * compact는 좁은 이력 모달용으로 유형을 상품명 아래에 두고 추가구매 열을 뺀다. 이력 스냅샷에는
 * 판매가가 없어(salePrice null) showPrice를 끈다. */
const UnitProductLineTable: FC<{ lines: PlanUnitProductLineSummary[]; showPrice: boolean; compact?: boolean }> = ({
  lines,
  showPrice,
  compact = false,
}) => (
  <div className="rounded-md border border-gray-200 overflow-x-auto">
    <table className={`w-full ${compact ? 'text-xs' : 'text-sm'}`}>
      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
        <tr>
          <th className="text-left px-3 py-2 font-medium">단위 상품</th>
          {!compact && <th className="text-left px-3 py-2 font-medium">유형</th>}
          <th className="text-right px-3 py-2 font-medium">판매 단위</th>
          <th className="text-right px-3 py-2 font-medium">기본 포함(묶음)</th>
          <th className="text-right px-3 py-2 font-medium">총 포함 개수</th>
          {showPrice && <th className="text-right px-3 py-2 font-medium">판매가(개당)</th>}
          {showPrice && <th className="text-right px-3 py-2 font-medium">소계</th>}
          {!compact && <th className="text-left px-3 py-2 font-medium">추가구매</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 text-gray-950">
        {lines.map((line) => {
          const unit = UNIT_PRODUCT_QUANTITY_UNIT[line.unitProductType];
          const typeLabel = UNIT_PRODUCT_TYPE_LABEL[line.unitProductType] ?? line.unitProductType;
          const currencyCode = line.currencyCode ?? 'KRW';
          return (
            <tr key={line.unitProductId}>
              <td className="px-3 py-2">
                {line.unitProductName}
                {compact && typeLabel !== line.unitProductName && <span className="block text-gray-400">{typeLabel}</span>}
              </td>
              {!compact && <td className="px-3 py-2 text-gray-600">{typeLabel}</td>}
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {line.saleUnitQuantity > 1 ? `${line.saleUnitQuantity.toLocaleString()}${unit} 묶음` : `1${unit}`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {line.includedQuantity > 0 ? line.includedQuantity.toLocaleString() : '-'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                {line.totalQuantity > 0 ? `${line.totalQuantity.toLocaleString()}${unit}` : '-'}
              </td>
              {showPrice && (
                <td className="px-3 py-2 text-right tabular-nums">
                  {line.salePrice === null ? '-' : formatPrice(line.salePrice, currencyCode)}
                </td>
              )}
              {showPrice && (
                <td className="px-3 py-2 text-right tabular-nums">
                  {line.salePrice === null ? '-' : formatPrice(line.salePrice * line.totalQuantity, currencyCode)}
                </td>
              )}
              {/* 구성에 올라간 상품은(포함 수량이 0이든 N이든) 전부 그 자체로 추가구매
                  후보다(2026-09-10, purchasable 필드 폐지) — 0이면 기본 포함 없이
                  추가구매만 가능하다는 뜻이다. */}
              {!compact && (
                <td className="px-3 py-2 text-gray-600">{line.includedQuantity > 0 ? '가능' : '추가구매만 가능'}</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

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

  const isPlatformOrder = plan?.salesChannel === 'PLATFORM_ORDER';

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
            <DetailRow label="판매 경로" value={SALES_CHANNEL_LABEL[plan.salesChannel]} />
            <DetailRow
              label="플랜 유형"
              value={
                plan.subscription
                  ? `구독형 — ${plan.subscriptionType === 'PERIOD_AND_COUNT' ? `${plan.subscriptionPeriodMonths}개월 ` : ''}${plan.subscriptionAllowedCount}회`
                  : '일반'
              }
            />
            {!isPlatformOrder && (
              <>
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
              </>
            )}
            {plan.unitProducts.length === 0 ? (
              <DetailRow label="단위 상품 구성" value="없음" />
            ) : (
              <div className="px-4 py-3 space-y-2">
                <span className="text-xs font-medium text-gray-500">단위 상품 구성</span>
                <UnitProductLineTable lines={plan.unitProducts} showPrice={!isPlatformOrder} />
              </div>
            )}
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

          {isPlatformOrder ? (
            <p className="mt-4 text-xs text-gray-400">
              플랫폼 수주 플랜은 할인 기간이 없습니다. 고객 패키지 가격은 수주 가격표에서 정합니다.
            </p>
          ) : (
            <PlanDiscountPeriodSection
              itemId={plan.id}
              canManage={canManage}
              onChanged={() => load().then((found) => found && setPlan(found))}
              showSnackbar={showSnackbar}
            />
          )}

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
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(h.createdAt)}</p>
                {h.unitProducts.length === 0 ? (
                  <p className="text-xs text-gray-500 mt-1">포함 단위 상품 없음</p>
                ) : (
                  <div className="mt-2">
                    <UnitProductLineTable lines={h.unitProducts} showPrice={false} compact />
                  </div>
                )}
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
