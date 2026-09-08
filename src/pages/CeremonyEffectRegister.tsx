import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CeremonyEffectDefinitionForm } from '../components/effects/admin/CeremonyEffectDefinitionForm';
import type { CeremonyEffectFormValue } from '../components/effects/admin/CeremonyEffectDefinitionForm';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CreateCeremonyEffectDefinitionRequest, OptionalFeatureSummary } from '../types';

/**
 * 이벤트 효과 정의 등록(`/admin/effects/new`) — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-ADMIN-01/02.
 */
export const CeremonyEffectRegister: FC = () => {
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [optionalFeatures, setOptionalFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isFeaturesLoading, setIsFeaturesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/optional-features');
        if (!cancelled) setOptionalFeatures(response.data as OptionalFeatureSummary[]);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '선택옵션을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) setIsFeaturesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (value: CeremonyEffectFormValue) => {
    // 폼이 이미 create 모드에서 requiredOptionalFeatureId 미선택을 막고 있다(CeremonyEffectDefinitionForm#submit).
    if (value.requiredOptionalFeatureId == null) return;

    setIsSaving(true);
    try {
      await api.post('/platform-admin/ceremony-effects', {
        code: value.code,
        targetType: value.targetType,
        triggerType: value.triggerType,
        requiredOptionalFeatureId: value.requiredOptionalFeatureId,
        displayName: value.displayName,
        description: value.description || null,
        rendererKey: value.rendererKey,
        manuallyTriggerable: value.manuallyTriggerable,
        configJson: value.configJsonDraft ? JSON.parse(value.configJsonDraft) : null,
      } satisfies CreateCeremonyEffectDefinitionRequest);
      showSnackbar('이벤트 효과 정의를 등록했습니다.', 'success');
      navigate('/admin/effects');
    } catch (err) {
      const message = err instanceof Error ? err.message : '이벤트 효과 정의 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link to="/admin/effects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} /> 이벤트 효과 관리로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">이벤트 효과 등록</h1>
        <p className="mt-1 text-sm text-gray-500">등록 후에는 코드/대상 화면/실행 시점/Renderer 키/필요 선택옵션을 바꿀 수 없습니다.</p>
      </div>

      {isFeaturesLoading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <CeremonyEffectDefinitionForm
          mode="create"
          optionalFeatures={optionalFeatures}
          saving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/effects')}
        />
      )}
    </div>
  );
};
