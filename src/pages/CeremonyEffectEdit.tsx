import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { CeremonyEffectDefinitionForm } from '../components/effects/admin/CeremonyEffectDefinitionForm';
import type { CeremonyEffectFormValue } from '../components/effects/admin/CeremonyEffectDefinitionForm';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CeremonyEffectDefinition, OptionalFeatureSummary, UpdateCeremonyEffectDefinitionRequest } from '../types';

/**
 * 이벤트 효과 정의 수정(`/admin/effects/:id/edit`) — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-ADMIN-01/02.
 */
export const CeremonyEffectEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [definition, setDefinition] = useState<CeremonyEffectDefinition | null>(null);
  const [optionalFeatures, setOptionalFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [definitionRes, featuresRes] = await Promise.all([
          api.get(`/platform-admin/ceremony-effects/${id}`),
          api.get('/optional-features'),
        ]);
        if (!cancelled) {
          setDefinition(definitionRes.data as CeremonyEffectDefinition);
          setOptionalFeatures(featuresRes.data as OptionalFeatureSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '이벤트 효과 정의를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate('/admin/effects', { replace: true });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async (value: CeremonyEffectFormValue) => {
    setIsSaving(true);
    try {
      const response = await api.put(`/platform-admin/ceremony-effects/${id}`, {
        displayName: value.displayName,
        description: value.description || null,
        enabled: value.enabled,
        userVisible: value.userVisible,
        manuallyTriggerable: value.manuallyTriggerable,
        configJson: value.configJsonDraft ? JSON.parse(value.configJsonDraft) : null,
      } satisfies UpdateCeremonyEffectDefinitionRequest);
      setDefinition(response.data as CeremonyEffectDefinition);
      showSnackbar('이벤트 효과 정의를 저장했습니다.', 'success');
      navigate('/admin/effects');
    } catch (err) {
      const message = err instanceof Error ? err.message : '이벤트 효과 정의 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !definition) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const initialValue: CeremonyEffectFormValue = {
    code: definition.code,
    targetType: definition.targetType,
    triggerType: definition.triggerType,
    displayName: definition.displayName,
    description: definition.description ?? '',
    rendererKey: definition.rendererKey,
    enabled: definition.enabled,
    userVisible: definition.userVisible,
    manuallyTriggerable: definition.manuallyTriggerable,
    configJsonDraft: definition.configJson ? JSON.stringify(definition.configJson, null, 2) : '',
  };

  const belongingBundleNames = definition.optionalFeatureIds
    .map((featureId) => optionalFeatures.find((f) => f.id === featureId)?.name ?? `#${featureId}`);

  return (
    <div>
      <Link to="/admin/effects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} /> 이벤트 효과 관리로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">이벤트 효과 수정</h1>
        <p className="mt-1 text-sm text-gray-500">{definition.displayName}</p>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <span className="font-bold text-gray-700">속한 선택옵션(묶음): </span>
        {belongingBundleNames.length > 0 ? belongingBundleNames.join(', ') : '없음'}
        <p className="mt-1 text-[11px] text-gray-500">
          이 효과를 여는 묶음 구성은 과금 카탈로그 관리 화면(선택 옵션)에서 바꿀 수 있습니다.
        </p>
      </div>

      <CeremonyEffectDefinitionForm
        mode="edit"
        initialValue={initialValue}
        saving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/effects')}
      />
    </div>
  );
};
