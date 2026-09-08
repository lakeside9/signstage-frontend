import { useState } from 'react';
import type { FC } from 'react';
import { Loader2, Power } from 'lucide-react';
import { CelebrationControlButton } from './CelebrationControlButton';
import { useSnackbarStore } from '../../../store/useSnackbarStore';
import { api } from '../../../utils/api';
import type { CeremonyEffectTrigger, CeremonyEventEffectSetting } from '../../../types';

interface Props {
  apiBasePath: string;
  settings: CeremonyEventEffectSetting[];
  onSettingsChange: (settings: CeremonyEventEffectSetting[]) => void;
}

const TRIGGER_LABEL: Record<CeremonyEffectTrigger, string> = {
  SIGNATURE_COMPLETED: '서명란',
  ALL_SIGNATURES_COMPLETED: '전체 완료',
  EVENT_FINISHED: '행사 종료',
};

/**
 * FE-EVENT-01과 같은 두 고정 분류만 다룬다 — 이 화면도 그 두 그룹의 runtime만 켜고 끈다.
 * 여기 없는 분류(선택 안 함)는 `settings`에 애초에 없는 행이므로, 이 목록을 기준으로
 * "선택 안 함" 상태까지 명확히 표시한다(아래 GROUPS.map 참고).
 */
const GROUPS: CeremonyEffectTrigger[] = ['SIGNATURE_COMPLETED', 'ALL_SIGNATURES_COMPLETED'];

/**
 * 행사 제어 화면의 효과 runtime ON/OFF 패널 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-EVENT-02. 부모(`UserCeremonyEventControl`)가
 * 이미 갖고 있는 WebSocket 연결로 받은 `ceremony.effect.setting.changed`를 그대로 반영해주므로
 * (여러 관리자 탭이 함께 동기화된다) 이 컴포넌트는 fetch/WS를 직접 하지 않는 순수 표시+토글
 * 컴포넌트다 — 레거시(`components/effects/admin/EventEffectRuntimeControls.tsx`)는 자체
 * 폴링/PATCH 응답으로 갱신했지만, 이 백엔드의 PUT .../effects/runtime은 본문이 없다
 * (`ApiResponse<Void>`) — 낙관적 갱신 + 실패 시 되돌리기로 대신한다.
 */
export const EventEffectRuntimeControls: FC<Props> = ({ apiBasePath, settings, onSettingsChange }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [updatingKey, setUpdatingKey] = useState('');

  const completion = settings.find((setting) => setting.targetType === 'PROJECTOR' && setting.triggerType === 'ALL_SIGNATURES_COMPLETED');

  const toggle = async (setting: CeremonyEventEffectSetting) => {
    const key = `${setting.targetType}:${setting.triggerType}`;
    if (updatingKey === key) return; // 중복 클릭 방지
    setUpdatingKey(key);

    const nextEnabled = !setting.runtimeEnabled;
    onSettingsChange(settings.map((item) => (
      item.targetType === setting.targetType && item.triggerType === setting.triggerType
        ? { ...item, runtimeEnabled: nextEnabled }
        : item
    )));

    try {
      await api.put(`${apiBasePath}/effects/runtime`, {
        targetType: setting.targetType,
        triggerType: setting.triggerType,
        runtimeEnabled: nextEnabled,
      });
      showSnackbar(`${setting.displayName} 효과를 ${nextEnabled ? '켰습니다.' : '껐습니다.'}`, 'success');
    } catch (err) {
      // 실패하면 낙관적으로 바꿨던 상태를 되돌린다.
      onSettingsChange(settings.map((item) => (
        item.targetType === setting.targetType && item.triggerType === setting.triggerType
          ? { ...item, runtimeEnabled: setting.runtimeEnabled }
          : item
      )));
      const message = err instanceof Error ? err.message : '효과 상태를 변경하지 못했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setUpdatingKey('');
    }
  };

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
      {GROUPS.map((triggerType) => {
        const setting = settings.find((item) => item.targetType === 'PROJECTOR' && item.triggerType === triggerType);
        if (!setting) {
          return (
            <span
              key={triggerType}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-400"
            >
              {TRIGGER_LABEL[triggerType]}: 선택 안 함
            </span>
          );
        }
        const key = `${setting.targetType}:${setting.triggerType}`;
        return (
          <button
            key={key}
            type="button"
            disabled={updatingKey === key}
            onClick={() => toggle(setting)}
            title={`${setting.displayName} 효과를 켜거나 끕니다.`}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-bold ${
              setting.runtimeEnabled ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
            }`}
          >
            {updatingKey === key ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
            {TRIGGER_LABEL[setting.triggerType]}: {setting.displayName} {setting.runtimeEnabled ? 'ON' : 'OFF'}
          </button>
        );
      })}
      {completion && <CelebrationControlButton apiBasePath={apiBasePath} setting={completion} />}
    </div>
  );
};
