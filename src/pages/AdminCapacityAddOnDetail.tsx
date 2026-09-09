import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, Loader2, Pencil } from 'lucide-react';
import { Button } from '../components/Button';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, HistoryButton, HistoryModal, PeriodStatusBadge, PricePeriodSection } from './billingCatalog/components';
import { CAPACITY_TYPE_LABEL, formatDiscount, formatPrice, formatSupplyPrice } from './billingCatalog/constants';
import type { CapacityAddOnHistorySummary, CapacityAddOnSummary } from '../types';

/** 용량 추가구매 상품 상세 — AdminBillingPlanDetail.tsx와 같은 구성. */
export const AdminCapacityAddOnDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addOnId = Number(id);

  const [addOn, setAddOn] = useState<CapacityAddOnSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<CapacityAddOnHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const load = async () => {
    const response = await api.get('/capacity-addons');
    return (response.data as CapacityAddOnSummary[]).find((a) => a.id === addOnId) ?? null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await load();
        if (!cancelled) {
          if (!found) {
            showSnackbar('용량 추가구매 상품을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/capacity-addons', { replace: true });
            return;
          }
          setAddOn(found);
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOnId]);

  const openHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/capacity-addons/${addOnId}/history`);
      setHistory(response.data as CapacityAddOnHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <div>
      <Link
        to="/admin/billing-catalog/capacity-addons"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        용량 추가구매 상품 목록으로
      </Link>

      {isLoading || !addOn ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
              <Boxes size={20} className="text-gray-400" />
              {CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType}
              {addOn.secondaryCapacityType && ` + ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType}`}
            </h1>
            <div className="flex items-center gap-2">
              <HistoryButton onClick={openHistory} />
              {canManage && (
                <Button to={`/admin/billing-catalog/capacity-addons/${addOn.id}/edit`} variant="secondary" size="sm">
                  <Pencil size={12} />
                  수정
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            <DetailRow label="종류" value={CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType} />
            <DetailRow label="단위 수량" value={`+${addOn.unitAmount}`} />
            {addOn.secondaryCapacityType && (
              <>
                <DetailRow label="보조 용량" value={CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType} />
                <DetailRow label="보조 단위 수량" value={`+${addOn.secondaryUnitAmount}`} />
              </>
            )}
            <DetailRow
              label="공급가/판매가"
              value={
                addOn.salePrice === null
                  ? '-'
                  : `${formatSupplyPrice(addOn.supplyPrice, addOn.currencyCode ?? 'KRW')} / ${formatPrice(addOn.salePrice, addOn.currencyCode ?? 'KRW')}`
              }
            />
            <DetailRow
              label="할인"
              value={addOn.discountType === null || addOn.discountValue === null ? '-' : formatDiscount(addOn.discountType, addOn.discountValue)}
            />
            <DetailRow
              label="판매 기간"
              value={addOn.effectiveFrom ? `${addOn.effectiveFrom} ~ ${addOn.effectiveTo ?? '무기한'}` : '-'}
            />
            <DetailRow label="상태" value={<PeriodStatusBadge status={addOn.periodStatus} />} />
            <DetailRow label="사용 건수" value={`${addOn.usageCount}건`} />
            <DetailRow label="생성일" value={formatDateTime(addOn.createdAt)} />
          </div>

          <PricePeriodSection
            itemId={addOn.id}
            basePath="/platform-admin/capacity-addons"
            canManage={canManage}
            onChanged={() => load().then((found) => found && setAddOn(found))}
            showSnackbar={showSnackbar}
          />

          <HistoryModal
            open={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            title="용량 추가구매 상품 변경 이력"
            isLoading={isHistoryLoading}
            isEmpty={history.length === 0}
          >
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <p className="text-sm text-gray-950 font-medium">
                  {CAPACITY_TYPE_LABEL[h.capacityType] ?? h.capacityType} +{h.unitAmount}
                  {h.secondaryCapacityType && ` · ${CAPACITY_TYPE_LABEL[h.secondaryCapacityType] ?? h.secondaryCapacityType} +${h.secondaryUnitAmount}`}
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
