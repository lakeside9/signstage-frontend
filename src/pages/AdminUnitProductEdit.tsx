import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { EffectDefinitionPicker, ExclusivityGroupField, Field, PeriodStatusBadge, PlatformUsageFeeField, UsageWarning } from './billingCatalog/components';
import {
  UNIT_PRODUCT_CATEGORY_OPTIONS,
  UNIT_PRODUCT_TYPE_LABEL,
  inputClass,
  normalizeDescription,
  normalizeExclusivityGroup,
} from './billingCatalog/constants';
import type { CeremonyEffectDefinition, UnitProductCategory, UnitProductSummary, UpdateUnitProductRequest } from '../types';

/**
 * 단위 상품 수정 — 인라인 편집이 아니라 별도 페이지로 구성한다(사용자 요청, 2026-09-09).
 * type은 생성 후 불변이라 읽기 전용으로만 보여준다. 옛 선택옵션/용량 추가구매 수정 2개를
 * 통합했다(signstage-docs business/billing-catalog-unit-product-model-redesign-review.md
 * 결정, 2026-09-10).
 */
export const AdminUnitProductEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productId = Number(id);

  const [product, setProduct] = useState<UnitProductSummary | null>(null);
  const [effectDefinitions, setEffectDefinitions] = useState<CeremonyEffectDefinition[]>([]);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [draft, setDraft] = useState<UpdateUnitProductRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [productsRes, effectsRes] = await Promise.all([api.get('/unit-products'), api.get('/ceremony-effects')]);
        const allProducts = productsRes.data as UnitProductSummary[];
        const found = allProducts.find((p) => p.id === productId) ?? null;
        if (!cancelled) {
          if (!found) {
            showSnackbar('단위 상품을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/unit-products', { replace: true });
            return;
          }
          setProduct(found);
          setEffectDefinitions(effectsRes.data as CeremonyEffectDefinition[]);
          const groups = allProducts.map((p) => p.exclusivityGroup).filter((g): g is string => g !== null);
          setExistingGroups([...new Set(groups)].sort());
          setDraft({
            name: found.name,
            description: found.description,
            exclusivityGroup: found.exclusivityGroup ?? '',
            maxPurchaseQuantity: found.maxPurchaseQuantity,
            category: found.category,
            platformUsageFee: found.platformUsageFee,
            effectDefinitionIds: found.effectDefinitionIds,
          });
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.name.trim()) {
      showSnackbar('단위 상품 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/unit-products/${productId}`, {
        ...draft,
        name: draft.name.trim(),
        description: normalizeDescription(draft.description),
        exclusivityGroup: normalizeExclusivityGroup(draft.exclusivityGroup),
      });
      showSnackbar('단위 상품을 저장했습니다.', 'success');
      navigate(`/admin/billing-catalog/unit-products/${productId}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '단위 상품 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link
        to={`/admin/billing-catalog/unit-products/${productId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        단위 상품 상세로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">단위 상품 수정</h1>
        <p className="mt-1 text-sm text-gray-500">
          가격/판매기간/사용여부는 여기서 다루지 않습니다 —{' '}
          <Link to={`/admin/billing-catalog/unit-products/${productId}`} className="text-gray-950 underline">
            상세 화면의 "판매가격 기간 관리"
          </Link>
          에서 기간을 추가하거나 기존 기간을 수정해 사용여부를 바꿀 수 있습니다.
        </p>
      </div>

      {isLoading || !product || !draft ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="종류(읽기 전용)">
              <input
                type="text"
                value={UNIT_PRODUCT_TYPE_LABEL[product.type] ?? product.type}
                disabled
                className={`${inputClass} bg-gray-100 text-gray-400`}
              />
            </Field>
            <Field label="상태(읽기 전용 — 판매가격 기간 관리에서 변경)">
              <div className={`${inputClass} bg-gray-100 flex items-center`}>
                <PeriodStatusBadge status={product.periodStatus} />
              </div>
            </Field>
            <Field label="이름">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((prev) => prev && { ...prev, name: e.target.value })}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
            <ExclusivityGroupField
              value={draft.exclusivityGroup ?? ''}
              existingGroups={existingGroups}
              disabled={isSaving}
              onChange={(exclusivityGroup) => setDraft((prev) => prev && { ...prev, exclusivityGroup })}
            />
            <Field label="분류">
              <select
                value={draft.category}
                onChange={(e) => setDraft((prev) => prev && { ...prev, category: e.target.value as UnitProductCategory })}
                disabled={isSaving}
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
              platformUsageFee={draft.platformUsageFee}
              disabled={isSaving}
              onChange={(platformUsageFee) => setDraft((prev) => prev && { ...prev, platformUsageFee })}
            />
            {product.type === 'EVENT_EFFECT_BUNDLE' ? (
              <EffectDefinitionPicker
                definitions={effectDefinitions}
                selectedIds={draft.effectDefinitionIds ?? []}
                disabled={isSaving}
                onChange={(effectDefinitionIds) => setDraft((prev) => prev && { ...prev, effectDefinitionIds })}
              />
            ) : (
              <Field label="최대 구매 수량(선택)">
                <FormattedNumberInput
                  min={1}
                  value={draft.maxPurchaseQuantity ?? ''}
                  onChange={(raw) => setDraft((prev) => prev && { ...prev, maxPurchaseQuantity: raw === '' ? null : Number(raw) })}
                  placeholder="무제한"
                  disabled={isSaving}
                  className={inputClass}
                />
              </Field>
            )}
          </div>

          <Field label="설명(선택)">
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => setDraft((prev) => prev && { ...prev, description: e.target.value })}
              disabled={isSaving}
              rows={3}
              placeholder="이 상품이 무엇인지 설명해주세요 — 이벤트 효과 묶음처럼 이름만으로는 무엇이 포함되는지 알기 어려운 상품일수록 도움이 됩니다."
              className={`${inputClass} resize-y`}
            />
          </Field>

          {product.type !== 'EVENT_EFFECT_BUNDLE' && (
            <p className="text-xs text-gray-400">
              최대 구매 수량을 비워두면 한 행사가 이 상품을 몇 개든 추가구매할 수 있습니다. 값을 넣으면 그 행사의 누적
              구매(대기중+승인) 수량이 이 값을 넘는 요청을 거부합니다 — 플랜에 기본 포함된 수량은 이 합계에 들어가지
              않습니다.
            </p>
          )}

          <UsageWarning count={product.usageCount} itemLabel="단위 상품" />

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/admin/billing-catalog/unit-products/${productId}`)}
              disabled={isSaving}
            >
              취소
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
