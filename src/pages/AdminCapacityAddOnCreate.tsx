import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { ActiveField, Field } from './billingCatalog/components';
import { CAPACITY_TYPE_OPTIONS, DISCOUNT_TYPE_OPTIONS, inputClass, todayIsoDate } from './billingCatalog/constants';
import type { CapacityAddOnSummary, CapacityType, CreateCapacityAddOnRequest, DiscountType } from '../types';

const EMPTY_DRAFT = (): CreateCapacityAddOnRequest => ({
  capacityType: 'SIGNERS',
  unitAmount: 1,
  secondaryCapacityType: null,
  secondaryUnitAmount: null,
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
});

/** 용량 추가구매 상품 등록 — 전용 페이지형(패턴 A), AdminBillingPlanCreate.tsx와 같은 구성. */
export const AdminCapacityAddOnCreate: FC = () => {
  const [draft, setDraft] = useState<CreateCapacityAddOnRequest>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<CapacityAddOnSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (draft.unitAmount < 1) {
      showSnackbar('단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    if (draft.secondaryCapacityType && (!draft.secondaryUnitAmount || draft.secondaryUnitAmount < 1)) {
      showSnackbar('보조 단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/capacity-addons', draft);
      setCreated(response.data as CapacityAddOnSummary);
      showSnackbar('용량 추가구매 상품을 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품 등록에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
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

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">용량 추가구매 상품 등록</h1>
        <p className="mt-1 text-sm text-gray-500">종류/단위 수량을 정하고 최초 판매가격 기간을 함께 만듭니다.</p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-500 mb-1">종류</p>
            <p className="text-base font-bold text-gray-950">
              {created.capacityType} +{created.unitAmount}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setDraft(EMPTY_DRAFT());
              }}
            >
              계속 추가하기
            </Button>
            <Button to={`/admin/billing-catalog/capacity-addons/${created.id}`}>상세로 이동</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="종류">
              <select
                value={draft.capacityType}
                onChange={(e) => {
                  const capacityType = e.target.value as CapacityType;
                  setDraft((prev) => ({
                    ...prev,
                    capacityType,
                    secondaryCapacityType: prev.secondaryCapacityType === capacityType ? null : prev.secondaryCapacityType,
                    secondaryUnitAmount: prev.secondaryCapacityType === capacityType ? null : prev.secondaryUnitAmount,
                  }));
                }}
                disabled={isLoading}
                className={inputClass}
              >
                {CAPACITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="단위 수량">
              <input
                type="number"
                min={1}
                value={draft.unitAmount === 0 ? '' : draft.unitAmount}
                onChange={(e) => setDraft((prev) => ({ ...prev, unitAmount: Number(e.target.value) }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="보조 용량(묶음 상품, 선택)">
              <select
                value={draft.secondaryCapacityType ?? ''}
                onChange={(e) => {
                  const value = e.target.value as CapacityType | '';
                  setDraft((prev) => ({
                    ...prev,
                    secondaryCapacityType: value === '' ? null : value,
                    secondaryUnitAmount: value === '' ? null : prev.secondaryUnitAmount || 1,
                  }));
                }}
                disabled={isLoading}
                className={inputClass}
              >
                <option value="">없음(단일 상품)</option>
                {CAPACITY_TYPE_OPTIONS.filter((option) => option.value !== draft.capacityType).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            {draft.secondaryCapacityType && (
              <Field label="보조 단위 수량">
                <input
                  type="number"
                  min={1}
                  value={draft.secondaryUnitAmount ? draft.secondaryUnitAmount : ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, secondaryUnitAmount: Number(e.target.value) }))}
                  disabled={isLoading}
                  className={inputClass}
                />
              </Field>
            )}
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
          <p className="text-xs text-gray-400">
            보조 용량을 지정하면 이 상품 1건 구매로 두 용량이 함께 늘어나는 묶음 상품이 됩니다(예: "서명자+태블릿" = 주 용량 서명자,
            보조 용량 태블릿). 묶음 여부와 보조 용량 종류는 등록 후 바꿀 수 없습니다.
          </p>
          <div className="flex justify-end gap-2">
            <Button to="/admin/billing-catalog/capacity-addons" variant="secondary">
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '등록 중...' : '용량 추가구매 상품 등록'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
