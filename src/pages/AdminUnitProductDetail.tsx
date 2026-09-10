import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, Loader2, Pencil } from 'lucide-react';
import { Button } from '../components/Button';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, HistoryButton, HistoryModal, PeriodStatusBadge, UnitProductPeriodSection } from './billingCatalog/components';
import { UNIT_PRODUCT_CATEGORY_LABEL, UNIT_PRODUCT_TYPE_LABEL, formatPrice, formatSupplyPrice } from './billingCatalog/constants';
import type { CeremonyEffectDefinition, UnitProductHistorySummary, UnitProductSummary } from '../types';

/**
 * 단위 상품 상세 — 옛 선택옵션/용량 추가구매 상세 2개를 통합했다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10).
 * `AdminBillingPlanDetail.tsx`와 같은 구성.
 */
export const AdminUnitProductDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productId = Number(id);

  const [product, setProduct] = useState<UnitProductSummary | null>(null);
  const [effectDefinitions, setEffectDefinitions] = useState<CeremonyEffectDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<UnitProductHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const load = async () => {
    const [productsRes, effectsRes] = await Promise.all([api.get('/unit-products'), api.get('/ceremony-effects')]);
    const found = (productsRes.data as UnitProductSummary[]).find((p) => p.id === productId) ?? null;
    return { found, effectDefinitions: effectsRes.data as CeremonyEffectDefinition[] };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (!cancelled) {
          if (!data.found) {
            showSnackbar('단위 상품을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/unit-products', { replace: true });
            return;
          }
          setProduct(data.found);
          setEffectDefinitions(data.effectDefinitions);
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '단위 상품을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const effectName = (eid: number) => effectDefinitions.find((d) => d.id === eid)?.displayName ?? `#${eid}`;

  const openHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/unit-products/${productId}/history`);
      setHistory(response.data as UnitProductHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <div>
      <Link
        to="/admin/billing-catalog/unit-products"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        단위 상품 목록으로
      </Link>

      {isLoading || !product ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
              <Boxes size={20} className="text-gray-400" />
              {product.name}
            </h1>
            <div className="flex items-center gap-2">
              <HistoryButton onClick={openHistory} />
              {canManage && (
                <Button to={`/admin/billing-catalog/unit-products/${product.id}/edit`} variant="secondary" size="sm">
                  <Pencil size={12} />
                  수정
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            <DetailRow label="종류" value={UNIT_PRODUCT_TYPE_LABEL[product.type] ?? product.type} />
            <DetailRow label="이름" value={product.name} />
            <DetailRow
              label="공급가/판매가"
              value={
                product.salePrice === null
                  ? '-'
                  : `${formatSupplyPrice(product.supplyPrice, product.currencyCode ?? 'KRW')} / ${formatPrice(product.salePrice, product.currencyCode ?? 'KRW')}`
              }
            />
            <DetailRow
              label="판매 기간"
              value={product.effectiveFrom ? `${product.effectiveFrom} ~ ${product.effectiveTo ?? '무기한'}` : '-'}
            />
            <DetailRow label="상태" value={<PeriodStatusBadge status={product.periodStatus} />} />
            <DetailRow label="분류" value={UNIT_PRODUCT_CATEGORY_LABEL[product.category] ?? product.category} />
            <DetailRow label="배타 그룹" value={product.exclusivityGroup ?? '없음'} />
            {product.type === 'EVENT_EFFECT_BUNDLE' && (
              <DetailRow label="여는 이벤트 효과" value={product.effectDefinitionIds.map(effectName).join(', ') || '없음'} />
            )}
            <DetailRow label="사용 건수" value={`${product.usageCount}건`} />
            <DetailRow label="생성일" value={formatDateTime(product.createdAt)} />
          </div>

          <UnitProductPeriodSection
            itemId={product.id}
            canManage={canManage}
            onChanged={() => load().then((data) => data.found && setProduct(data.found))}
            showSnackbar={showSnackbar}
          />

          <HistoryModal
            open={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            title="단위 상품 변경 이력"
            isLoading={isHistoryLoading}
            isEmpty={history.length === 0}
          >
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <p className="text-sm text-gray-950 font-medium">
                  {UNIT_PRODUCT_TYPE_LABEL[h.type] ?? h.type} · {h.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {UNIT_PRODUCT_CATEGORY_LABEL[h.category] ?? h.category}
                  {h.exclusivityGroup && ` · 배타 그룹: ${h.exclusivityGroup}`}
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
