import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { EffectDefinitionPicker, Field, UsageWarning } from './billingCatalog/components';
import {
  MANAGEABLE_OPTIONAL_FEATURE_CODES,
  OPTIONAL_FEATURE_CATEGORY_OPTIONS,
  OPTIONAL_FEATURE_CODE_LABEL,
  inputClass,
  normalizeExclusivityGroup,
} from './billingCatalog/constants';
import type {
  CeremonyEffectDefinition,
  OptionalFeatureCategory,
  OptionalFeatureSummary,
  UpdateOptionalFeatureRequest,
} from '../types';

/** 선택옵션 수정 — 인라인 편집이 아니라 별도 페이지로 구성한다(사용자 요청, 2026-09-09).
 * code는 생성 후 불변이라 읽기 전용으로만 보여준다. */
export const AdminOptionalFeatureEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const featureId = Number(id);

  const [feature, setFeature] = useState<OptionalFeatureSummary | null>(null);
  const [effectDefinitions, setEffectDefinitions] = useState<CeremonyEffectDefinition[]>([]);
  const [draft, setDraft] = useState<UpdateOptionalFeatureRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [featuresRes, effectsRes] = await Promise.all([api.get('/optional-features'), api.get('/ceremony-effects')]);
        const found = (featuresRes.data as OptionalFeatureSummary[]).find(
          (f) => f.id === featureId && MANAGEABLE_OPTIONAL_FEATURE_CODES.includes(f.code),
        ) ?? null;
        if (!cancelled) {
          if (!found) {
            showSnackbar('선택옵션을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/optional-features', { replace: true });
            return;
          }
          setFeature(found);
          setEffectDefinitions(effectsRes.data as CeremonyEffectDefinition[]);
          setDraft({
            name: found.name,
            exclusivityGroup: found.exclusivityGroup ?? '',
            category: found.category,
            effectDefinitionIds: found.effectDefinitionIds,
          });
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.name.trim()) {
      showSnackbar('선택옵션 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/optional-features/${featureId}`, {
        ...draft,
        name: draft.name.trim(),
        exclusivityGroup: normalizeExclusivityGroup(draft.exclusivityGroup),
      });
      showSnackbar('선택옵션을 저장했습니다.', 'success');
      navigate(`/admin/billing-catalog/optional-features/${featureId}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '선택옵션 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link
        to={`/admin/billing-catalog/optional-features/${featureId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        선택옵션 상세로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">선택옵션 수정</h1>
        <p className="mt-1 text-sm text-gray-500">가격/할인/판매기간/사용여부는 상세 화면의 "가격 기간 관리"에서 다룹니다.</p>
      </div>

      {isLoading || !feature || !draft ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="코드(읽기 전용)">
              <input
                type="text"
                value={OPTIONAL_FEATURE_CODE_LABEL[feature.code] ?? feature.code}
                disabled
                className={`${inputClass} bg-gray-100 text-gray-400`}
              />
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
            <Field label="배타 그룹">
              <input
                type="text"
                value={draft.exclusivityGroup ?? ''}
                onChange={(e) => setDraft((prev) => prev && { ...prev, exclusivityGroup: e.target.value })}
                disabled={isSaving}
                placeholder="예: SIGNER_HIGHLIGHT_COLOR"
                className={inputClass}
              />
            </Field>
            <Field label="카테고리">
              <select
                value={draft.category}
                onChange={(e) => setDraft((prev) => prev && { ...prev, category: e.target.value as OptionalFeatureCategory })}
                disabled={isSaving}
                className={inputClass}
              >
                {OPTIONAL_FEATURE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            {feature.code === 'EVENT_EFFECT_BUNDLE' && (
              <EffectDefinitionPicker
                definitions={effectDefinitions}
                selectedIds={draft.effectDefinitionIds ?? []}
                disabled={isSaving}
                onChange={(effectDefinitionIds) => setDraft((prev) => prev && { ...prev, effectDefinitionIds })}
              />
            )}
          </div>

          <UsageWarning count={feature.usageCount} itemLabel="선택옵션" />

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/admin/billing-catalog/optional-features/${featureId}`)}
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
