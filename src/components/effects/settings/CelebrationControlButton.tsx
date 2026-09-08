import { useState } from 'react';
import type { FC } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { useSnackbarStore } from '../../../store/useSnackbarStore';
import { api } from '../../../utils/api';
import type { CeremonyEventEffectSetting } from '../../../types';

interface Props {
  apiBasePath: string;
  setting: CeremonyEventEffectSetting;
}

/**
 * 전체완료 효과 수동 실행 버튼 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-EVENT-03. `runtimeEnabled`이면서
 * `manuallyTriggerable`인 ALL_SIGNATURES_COMPLETED 분류에만 나타난다. 레거시와 달리 이
 * 화면에서 효과를 직접 재생하지 않는다 — 서버가 `ceremony.effect.requested`를 방송하면
 * 프로젝터 화면만 재생한다(BE-RUNTIME-04 `triggerManualCelebration`).
 */
export const CelebrationControlButton: FC<Props> = ({ apiBasePath, setting }) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  if (!setting.runtimeEnabled || !setting.manuallyTriggerable) return null;

  const handleTrigger = async () => {
    setIsTriggering(true);
    try {
      await api.post(`${apiBasePath}/effects/trigger`, {
        targetType: setting.targetType,
        triggerType: setting.triggerType,
      });
      showSnackbar(`전시 화면에 ${setting.displayName} 효과를 요청했습니다.`, 'success');
    } catch (err) {
      // 짧은 시간 안에 다시 누르면 서버가 429(rate limit)로 막는다 — 메시지를 그대로 보여준다.
      const message = err instanceof Error ? err.message : `${setting.displayName} 효과 실행에 실패했습니다.`;
      showSnackbar(message, 'error');
    } finally {
      setIsTriggering(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isTriggering}
        title={`연결된 모든 전시 화면에 ${setting.displayName} 효과를 수동 실행합니다.`}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm transition-all hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50"
      >
        {isTriggering ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {setting.displayName} 실행
      </button>
      <ConfirmDialog
        open={isConfirmOpen}
        title={`${setting.displayName} 효과 실행`}
        message={`연결된 모든 전시 화면에 ${setting.displayName} 효과를 실행하시겠습니까?`}
        confirmLabel="실행"
        isSubmitting={isTriggering}
        onConfirm={handleTrigger}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
};
