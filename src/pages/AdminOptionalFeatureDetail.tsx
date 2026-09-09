import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Sparkles } from 'lucide-react';
import { Button } from '../components/Button';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, HistoryButton, HistoryModal, PeriodStatusBadge, PricePeriodSection } from './billingCatalog/components';
import {
  MANAGEABLE_OPTIONAL_FEATURE_CODES,
  OPTIONAL_FEATURE_CATEGORY_LABEL,
  OPTIONAL_FEATURE_CODE_LABEL,
  formatDiscount,
  formatPrice,
  formatSupplyPrice,
} from './billingCatalog/constants';
import type { CeremonyEffectDefinition, OptionalFeatureHistorySummary, OptionalFeatureSummary } from '../types';

/** 선택옵션 상세 — AdminBillingPlanDetail.tsx와 같은 구성. */
export const AdminOptionalFeatureDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const featureId = Number(id);

  const [feature, setFeature] = useState<OptionalFeatureSummary | null>(null);
  const [effectDefinitions, setEffectDefinitions] = useState<CeremonyEffectDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<OptionalFeatureHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const load = async () => {
    const [featuresRes, effectsRes] = await Promise.all([api.get('/optional-features'), api.get('/ceremony-effects')]);
    const found = (featuresRes.data as OptionalFeatureSummary[]).find(
      (f) => f.id === featureId && MANAGEABLE_OPTIONAL_FEATURE_CODES.includes(f.code),
    ) ?? null;
    return { found, effectDefinitions: effectsRes.data as CeremonyEffectDefinition[] };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (!cancelled) {
          if (!data.found) {
            showSnackbar('선택옵션을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/optional-features', { replace: true });
            return;
          }
          setFeature(data.found);
          setEffectDefinitions(data.effectDefinitions);
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '선택옵션을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureId]);

  const effectName = (eid: number) => effectDefinitions.find((d) => d.id === eid)?.displayName ?? `#${eid}`;

  const openHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/optional-features/${featureId}/history`);
      setHistory(response.data as OptionalFeatureHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <div>
      <Link
        to="/admin/billing-catalog/optional-features"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        선택옵션 목록으로
      </Link>

      {isLoading || !feature ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
              <Sparkles size={20} className="text-gray-400" />
              {feature.name}
            </h1>
            <div className="flex items-center gap-2">
              <HistoryButton onClick={openHistory} />
              {canManage && (
                <Button to={`/admin/billing-catalog/optional-features/${feature.id}/edit`} variant="secondary" size="sm">
                  <Pencil size={12} />
                  수정
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            <DetailRow label="코드" value={OPTIONAL_FEATURE_CODE_LABEL[feature.code] ?? feature.code} />
            <DetailRow label="이름" value={feature.name} />
            <DetailRow
              label="공급가/판매가"
              value={
                feature.salePrice === null
                  ? '-'
                  : `${formatSupplyPrice(feature.supplyPrice, feature.currencyCode ?? 'KRW')} / ${formatPrice(feature.salePrice, feature.currencyCode ?? 'KRW')}`
              }
            />
            <DetailRow
              label="할인"
              value={
                feature.discountType === null || feature.discountValue === null
                  ? '-'
                  : formatDiscount(feature.discountType, feature.discountValue)
              }
            />
            <DetailRow
              label="판매 기간"
              value={feature.effectiveFrom ? `${feature.effectiveFrom} ~ ${feature.effectiveTo ?? '무기한'}` : '-'}
            />
            <DetailRow label="상태" value={<PeriodStatusBadge status={feature.periodStatus} />} />
            <DetailRow label="분류" value={OPTIONAL_FEATURE_CATEGORY_LABEL[feature.category] ?? feature.category} />
            <DetailRow label="배타 그룹" value={feature.exclusivityGroup ?? '없음'} />
            {feature.code === 'EVENT_EFFECT_BUNDLE' && (
              <DetailRow label="여는 이벤트 효과" value={feature.effectDefinitionIds.map(effectName).join(', ') || '없음'} />
            )}
            <DetailRow label="사용 건수" value={`${feature.usageCount}건`} />
            <DetailRow label="생성일" value={formatDateTime(feature.createdAt)} />
          </div>

          <PricePeriodSection
            itemId={feature.id}
            basePath="/platform-admin/optional-features"
            canManage={canManage}
            onChanged={() => load().then((data) => data.found && setFeature(data.found))}
            showSnackbar={showSnackbar}
          />

          <HistoryModal
            open={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            title="선택옵션 변경 이력"
            isLoading={isHistoryLoading}
            isEmpty={history.length === 0}
          >
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <p className="text-sm text-gray-950 font-medium">
                  {OPTIONAL_FEATURE_CODE_LABEL[h.code] ?? h.code} · {h.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {OPTIONAL_FEATURE_CATEGORY_LABEL[h.category] ?? h.category}
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
