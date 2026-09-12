import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { ActiveField, EffectDefinitionPicker, ExclusivityGroupField, Field, PlatformUsageFeeField } from './billingCatalog/components';
import {
  DEFAULT_CATEGORY_BY_TYPE,
  UNIT_PRODUCT_CATEGORY_OPTIONS,
  UNIT_PRODUCT_TYPE_LABEL,
  UNIT_PRODUCT_TYPE_OPTIONS,
  defaultPlatformUsageFeeByCategory,
  inputClass,
  normalizeDescription,
  normalizeExclusivityGroup,
  todayIsoDate,
} from './billingCatalog/constants';
import type { CeremonyEffectDefinition, CreateUnitProductRequest, UnitProductCategory, UnitProductSummary, UnitProductType } from '../types';

const EMPTY_DRAFT = (): CreateUnitProductRequest => {
  const type = UNIT_PRODUCT_TYPE_OPTIONS[0].value;
  const category = DEFAULT_CATEGORY_BY_TYPE[type];
  return {
    type,
    name: '',
    description: '',
    category,
    exclusivityGroup: '',
    maxPurchaseQuantity: null,
    platformUsageFee: defaultPlatformUsageFeeByCategory(category),
    currencyCode: 'KRW',
    supplyPrice: null,
    salePrice: 0,
    taxCode: 'KR_VAT_STANDARD',
    active: true,
    effectiveFrom: todayIsoDate(),
    effectiveTo: null,
    effectDefinitionIds: [],
  };
};

/**
 * 단위 상품 등록 — 옛 선택옵션/용량 추가구매 등록 2개를 통합했다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10). 전용
 * 페이지형(패턴 A), `AdminBillingPlanCreate.tsx`와 같은 구성. 등록 가능한 종류(type) 제한이
 * 없다 — 이중 청구 위험이 통합으로 구조적으로 없어졌다(2장).
 */
export const AdminUnitProductCreate: FC = () => {
  const [draft, setDraft] = useState<CreateUnitProductRequest>(EMPTY_DRAFT);
  const [effectDefinitions, setEffectDefinitions] = useState<CeremonyEffectDefinition[]>([]);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<UnitProductSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [effectsRes, productsRes] = await Promise.all([api.get('/ceremony-effects'), api.get('/unit-products')]);
        if (!cancelled) {
          setEffectDefinitions(effectsRes.data as CeremonyEffectDefinition[]);
          const groups = (productsRes.data as UnitProductSummary[])
            .map((p) => p.exclusivityGroup)
            .filter((g): g is string => g !== null);
          setExistingGroups([...new Set(groups)].sort());
        }
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
      showSnackbar('단위 상품 이름을 입력해주세요.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/unit-products', {
        ...draft,
        name: draft.name.trim(),
        description: normalizeDescription(draft.description),
        exclusivityGroup: normalizeExclusivityGroup(draft.exclusivityGroup),
      });
      setCreated(response.data as UnitProductSummary);
      showSnackbar('단위 상품을 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '단위 상품 등록에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
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

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">단위 상품 등록</h1>
        <p className="mt-1 text-sm text-gray-500">종류/이름/분류를 정하고 최초 판매가격 기간을 함께 만듭니다.</p>
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
            <Button to={`/admin/billing-catalog/unit-products/${created.id}`}>상세로 이동</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="종류">
              <select
                value={draft.type}
                onChange={(e) => {
                  const type = e.target.value as UnitProductType;
                  const category = DEFAULT_CATEGORY_BY_TYPE[type] ?? draft.category;
                  setDraft((prev) => ({ ...prev, type, category, platformUsageFee: defaultPlatformUsageFeeByCategory(category) }));
                }}
                disabled={isLoading}
                className={inputClass}
              >
                {UNIT_PRODUCT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {UNIT_PRODUCT_TYPE_LABEL[option.value] ?? option.label}
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
              <FormattedNumberInput
                min={0}
                value={draft.supplyPrice === null ? '' : draft.supplyPrice}
                onChange={(raw) => setDraft((prev) => ({ ...prev, supplyPrice: raw === '' ? null : Number(raw) }))}
                placeholder="미상"
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="판매가">
              <FormattedNumberInput
                min={0}
                value={draft.salePrice === 0 ? '' : draft.salePrice}
                onChange={(raw) => setDraft((prev) => ({ ...prev, salePrice: Number(raw) }))}
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
            <ExclusivityGroupField
              value={draft.exclusivityGroup ?? ''}
              existingGroups={existingGroups}
              disabled={isLoading}
              onChange={(exclusivityGroup) => setDraft((prev) => ({ ...prev, exclusivityGroup }))}
            />
            <Field label="분류">
              <select
                value={draft.category}
                onChange={(e) => {
                  const category = e.target.value as UnitProductCategory;
                  setDraft((prev) => ({ ...prev, category, platformUsageFee: defaultPlatformUsageFeeByCategory(category) }));
                }}
                disabled={isLoading}
                className={inputClass}
              >
                {UNIT_PRODUCT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <PlatformUsageFeeField
              platformUsageFee={draft.platformUsageFee ?? false}
              disabled={isLoading}
              onChange={(platformUsageFee) => setDraft((prev) => ({ ...prev, platformUsageFee }))}
            />
            {draft.type === 'EVENT_EFFECT_BUNDLE' ? (
              <EffectDefinitionPicker
                definitions={effectDefinitions}
                selectedIds={draft.effectDefinitionIds ?? []}
                disabled={isLoading}
                onChange={(effectDefinitionIds) => setDraft((prev) => ({ ...prev, effectDefinitionIds }))}
              />
            ) : (
              <Field label="최대 구매 수량(선택)">
                <FormattedNumberInput
                  min={1}
                  value={draft.maxPurchaseQuantity ?? ''}
                  onChange={(raw) => setDraft((prev) => ({ ...prev, maxPurchaseQuantity: raw === '' ? null : Number(raw) }))}
                  placeholder="무제한"
                  disabled={isLoading}
                  className={inputClass}
                />
              </Field>
            )}
          </div>
          <Field label="설명(선택)">
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              disabled={isLoading}
              rows={3}
              placeholder="이 상품이 무엇인지 설명해주세요 — 이벤트 효과 묶음처럼 이름만으로는 무엇이 포함되는지 알기 어려운 상품일수록 도움이 됩니다."
              className={`${inputClass} resize-y`}
            />
          </Field>
          <p className="text-xs text-gray-400">
            배타 그룹에 같은 값을 넣으면, 그 값을 공유하는 단위 상품들은 하위 행사 하나에 동시 적용할 수 없습니다(예: 서명
            하이라이트 색상 옵션 여러 개 중 하나만 고르게 하고 싶을 때).
          </p>
          {draft.type !== 'EVENT_EFFECT_BUNDLE' && (
            <p className="text-xs text-gray-400">
              최대 구매 수량을 비워두면 한 행사가 이 상품을 몇 개든 추가구매할 수 있습니다. 값을 넣으면 그 행사의 누적
              구매(대기중+승인) 수량이 이 값을 넘는 요청을 거부합니다 — 플랜에 기본 포함된 수량은 이 합계에 들어가지
              않습니다.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button to="/admin/billing-catalog/unit-products" variant="secondary">
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '등록 중...' : '단위 상품 등록'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
