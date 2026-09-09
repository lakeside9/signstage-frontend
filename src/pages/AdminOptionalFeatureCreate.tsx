import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { ActiveField, EffectDefinitionPicker, Field, FinalPricePreview } from './billingCatalog/components';
import {
  DEFAULT_CATEGORY_BY_CODE,
  DISCOUNT_TYPE_OPTIONS,
  MANAGEABLE_OPTIONAL_FEATURE_CODES,
  OPTIONAL_FEATURE_CATEGORY_OPTIONS,
  OPTIONAL_FEATURE_CODE_LABEL,
  inputClass,
  normalizeExclusivityGroup,
  todayIsoDate,
} from './billingCatalog/constants';
import type {
  CeremonyEffectDefinition,
  CreateOptionalFeatureRequest,
  DiscountType,
  OptionalFeatureCategory,
  OptionalFeatureCode,
  OptionalFeatureSummary,
} from '../types';

const EMPTY_DRAFT = (): CreateOptionalFeatureRequest => {
  const code = MANAGEABLE_OPTIONAL_FEATURE_CODES[0];
  return {
    code,
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
    exclusivityGroup: '',
    category: DEFAULT_CATEGORY_BY_CODE[code] ?? 'APPLICATION',
    effectDefinitionIds: [],
  };
};

/** 선택옵션 등록 — 전용 페이지형(패턴 A), AdminBillingPlanCreate.tsx와 같은 구성. */
export const AdminOptionalFeatureCreate: FC = () => {
  const [draft, setDraft] = useState<CreateOptionalFeatureRequest>(EMPTY_DRAFT);
  const [effectDefinitions, setEffectDefinitions] = useState<CeremonyEffectDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<OptionalFeatureSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/ceremony-effects');
        if (!cancelled) setEffectDefinitions(response.data as CeremonyEffectDefinition[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '이벤트 효과 목록을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      showSnackbar('선택옵션 이름을 입력해주세요.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/optional-features', {
        ...draft,
        name: draft.name.trim(),
        exclusivityGroup: normalizeExclusivityGroup(draft.exclusivityGroup),
      });
      setCreated(response.data as OptionalFeatureSummary);
      showSnackbar('선택옵션을 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '선택옵션 등록에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
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

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">선택옵션 등록</h1>
        <p className="mt-1 text-sm text-gray-500">코드/이름/분류를 정하고 최초 판매가격 기간을 함께 만듭니다.</p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-500 mb-1">이름</p>
            <p className="text-base font-bold text-gray-950">{created.name}</p>
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
            <Button to={`/admin/billing-catalog/optional-features/${created.id}`}>상세로 이동</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="코드">
              <select
                value={draft.code}
                onChange={(e) => {
                  const code = e.target.value as OptionalFeatureCode;
                  setDraft((prev) => ({ ...prev, code, category: DEFAULT_CATEGORY_BY_CODE[code] ?? prev.category }));
                }}
                disabled={isLoading}
                className={inputClass}
              >
                {MANAGEABLE_OPTIONAL_FEATURE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {OPTIONAL_FEATURE_CODE_LABEL[code] ?? code}
                  </option>
                ))}
              </select>
            </Field>
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
            <Field label="배타 그룹">
              <input
                type="text"
                value={draft.exclusivityGroup ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, exclusivityGroup: e.target.value }))}
                disabled={isLoading}
                placeholder="예: SIGNER_HIGHLIGHT_COLOR"
                className={inputClass}
              />
            </Field>
            <Field label="카테고리">
              <select
                value={draft.category}
                onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value as OptionalFeatureCategory }))}
                disabled={isLoading}
                className={inputClass}
              >
                {OPTIONAL_FEATURE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            {draft.code === 'EVENT_EFFECT_BUNDLE' && (
              <EffectDefinitionPicker
                definitions={effectDefinitions}
                selectedIds={draft.effectDefinitionIds ?? []}
                disabled={isLoading}
                onChange={(effectDefinitionIds) => setDraft((prev) => ({ ...prev, effectDefinitionIds }))}
              />
            )}
          </div>
          <FinalPricePreview
            salePrice={draft.salePrice}
            discountType={draft.discountType}
            discountValue={draft.discountValue}
            currencyCode={draft.currencyCode}
          />
          <p className="text-xs text-gray-400">
            배타 그룹에 같은 값을 넣으면, 그 값을 공유하는 옵션들은 하위 행사 하나에 동시 적용할 수 없습니다(예: 서명 하이라이트
            색상 옵션 여러 개 중 하나만 고르게 하고 싶을 때).
          </p>
          <div className="flex justify-end gap-2">
            <Button to="/admin/billing-catalog/optional-features" variant="secondary">
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '등록 중...' : '선택옵션 등록'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
