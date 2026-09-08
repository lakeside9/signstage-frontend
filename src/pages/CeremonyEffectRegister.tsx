import { useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CeremonyEffectDefinitionForm } from '../components/effects/admin/CeremonyEffectDefinitionForm';
import type { CeremonyEffectFormValue } from '../components/effects/admin/CeremonyEffectDefinitionForm';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CreateCeremonyEffectDefinitionRequest } from '../types';

/**
 * 이벤트 효과 정의 등록(`/admin/effects/new`) — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-ADMIN-01/02.
 *
 * 등록 시점에는 이 효과를 여는 선택옵션(묶음)을 고르지 않는다(2026-09-08 재설계) — 묶음
 * 구성은 과금 카탈로그 관리 화면(`AdminBillingCatalog.tsx`)에서 반대쪽(묶음 → 효과 목록)으로
 * 관리한다.
 */
export const CeremonyEffectRegister: FC = () => {
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (value: CeremonyEffectFormValue) => {
    setIsSaving(true);
    try {
      await api.post('/platform-admin/ceremony-effects', {
        code: value.code,
        targetType: value.targetType,
        triggerType: value.triggerType,
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
        <p className="mt-1 text-sm text-gray-500">등록 후에는 코드/대상 화면/실행 시점/Renderer 키를 바꿀 수 없습니다.</p>
      </div>

      <CeremonyEffectDefinitionForm
        mode="create"
        saving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/effects')}
      />
    </div>
  );
};
