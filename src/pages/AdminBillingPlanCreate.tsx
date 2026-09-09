import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { ActiveField, Field } from './billingCatalog/components';
import { DISCOUNT_TYPE_OPTIONS, PLAN_CAPACITY_TYPE_OPTIONS, emptyPlanCapacities, inputClass, todayIsoDate } from './billingCatalog/constants';
import type { BillingPlanSummary, CapacityAddOnSummary, CreateBillingPlanRequest, DiscountType, OptionalFeatureSummary } from '../types';

const EMPTY_DRAFT = (): CreateBillingPlanRequest => ({
  name: '',
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
  capacities: emptyPlanCapacities(),
  optionalFeatureIds: [],
  capacityAddOnIds: [],
});

/**
 * 과금 플랜 등록 — 전용 페이지형(detail-form-screen-convention.md 패턴 A). 제출 성공 시 같은
 * 페이지 안에서 "생성 완료" 뷰로 전환하고 "상세로 이동"/"계속 추가하기" 두 버튼으로 통일한다.
 */
export const AdminBillingPlanCreate: FC = () => {
  const [draft, setDraft] = useState<CreateBillingPlanRequest>(EMPTY_DRAFT);
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<BillingPlanSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [featuresRes, addOnsRes] = await Promise.all([api.get('/optional-features'), api.get('/capacity-addons')]);
        if (!cancelled) {
          setFeatures(featuresRes.data as OptionalFeatureSummary[]);
          setAddOns(addOnsRes.data as CapacityAddOnSummary[]);
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '선택옵션/용량 추가구매 상품 목록을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addOnLabel = (id: number) => {
    const addOn = addOns.find((a) => a.id === id);
    if (!addOn) return `#${id}`;
    return `${addOn.capacityType} +${addOn.unitAmount}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      showSnackbar('플랜 이름을 입력해주세요.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/billing-plans', { ...draft, name: draft.name.trim() });
      setCreated(response.data as BillingPlanSummary);
      showSnackbar('과금 플랜을 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '과금 플랜 등록에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
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

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">과금 플랜 등록</h1>
        <p className="mt-1 text-sm text-gray-500">이름/한도/포함 선택옵션을 정하고 최초 판매가격 기간을 함께 만듭니다.</p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-500 mb-1">이름</p>
            <p className="text-base font-bold text-gray-950">{created.name}</p>
          </div>
          <div className="flex gap-2">
            <Button to={`/admin/billing-catalog/plans/${created.id}`} className="flex-1">
              상세로 이동
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setCreated(null);
                setDraft(EMPTY_DRAFT());
              }}
            >
              계속 추가하기
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="이름">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="통화">
              <select
                value={draft.currencyCode}
                onChange={(e) => setDraft((prev) => ({ ...prev, currencyCode: e.target.value }))}
                disabled={isLoading}
                className={inputClass}
              >
                {['KRW', 'USD', 'EUR', 'JPY'].map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="공급가">
              <input
                type="number"
                min={0}
                value={draft.supplyPrice === null ? '' : draft.supplyPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, supplyPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="미상"
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="판매가">
              <input
                type="number"
                min={0}
                value={draft.salePrice === 0 ? '' : draft.salePrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="할인 방식">
              <select
                value={draft.discountType}
                onChange={(e) => setDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
                disabled={isLoading}
                className={inputClass}
              >
                {DISCOUNT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="할인 값">
              <input
                type="number"
                min={0}
                value={draft.discountValue === 0 ? '' : draft.discountValue}
                onChange={(e) => setDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="판매 시작일">
              <input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="판매 종료일(무기한이면 비움)">
              <input
                type="date"
                value={draft.effectiveTo ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveTo: e.target.value === '' ? null : e.target.value }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <ActiveField active={draft.active} disabled={isLoading} onChange={(active) => setDraft((prev) => ({ ...prev, active }))} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PLAN_CAPACITY_TYPE_OPTIONS.map((option) => (
              <Field key={option.value} label={`${option.label} 한도`}>
                <input
                  type="number"
                  min={0}
                  value={draft.capacities[option.value] === 0 ? '' : draft.capacities[option.value]}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, capacities: { ...prev.capacities, [option.value]: Number(e.target.value) } }))
                  }
                  disabled={isLoading}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">포함 선택옵션</span>
            {features.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 선택옵션이 없습니다. 먼저 선택옵션을 등록해주세요.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {features.map((feature) => (
                  <label key={feature.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.optionalFeatureIds.includes(feature.id)}
                      disabled={isLoading}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          optionalFeatureIds: e.target.checked
                            ? [...prev.optionalFeatureIds, feature.id]
                            : prev.optionalFeatureIds.filter((id) => id !== feature.id),
                        }))
                      }
                    />
                    {feature.name}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">플랜에 묶을 선택옵션 구성은 이후 수정 화면에서도 통째로 바꿀 수 있습니다.</p>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">구매 가능 용량 추가구매 상품</span>
            {addOns.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 용량 추가구매 상품이 없습니다. 먼저 용량 추가구매 상품을 등록해주세요.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {addOns.map((addOn) => (
                  <label key={addOn.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.capacityAddOnIds.includes(addOn.id)}
                      disabled={isLoading}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          capacityAddOnIds: e.target.checked
                            ? [...prev.capacityAddOnIds, addOn.id]
                            : prev.capacityAddOnIds.filter((id) => id !== addOn.id),
                        }))
                      }
                    />
                    {addOnLabel(addOn.id)}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              체크한 상품만 이 플랜의 행사가 구매할 수 있습니다(무료 포함 아님 — 여전히 사용자가 구매 요청하고 관리자가 승인해야 합니다).
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? '등록 중...' : '과금 플랜 등록'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
