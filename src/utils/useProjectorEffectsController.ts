import { useCallback, useState } from 'react';
import type { CeremonyEventEffectSetting, ProjectorEffectRequest, RealtimeEventMessage } from '../types';
import type { CeremonyEffectTrigger } from './ceremonyEffectCatalog';
import { useCeremonyEffectScheduler } from './useCeremonyEffectScheduler';

interface TriggerRuntimeSetting {
  effectCode: string;
  runtimeEnabled: boolean;
}

/**
 * 실시간 이벤트를 해석해 이벤트 효과 재생 큐에 넣는 controller — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-CORE-02. 기존 대문자 "사실"
 * 이벤트(`SIGNATURE_COMPLETED`)와 신규 점(dot) 표기 효과 이벤트
 * (`ceremony.effect.requested`/`ceremony.effect.setting.changed`)를 함께 처리한다(PRE-04
 * 호환 정책). `ALL_SIGNERS_COMPLETED`(구 frontend 호환용)는 의도적으로 다루지 않는다 — 전체완료
 * 재생은 `ceremony.effect.requested`만 트리거한다(이중 재생 방지).
 *
 * <p>`effectCode`는 이 controller가 이미 해석해서 요청에 채워 넣는다 — `SIGNATURE_COMPLETED`는
 * {@link applySettings}로 미리 받아 둔 스냅샷에서, `ceremony.effect.requested`는 그 payload
 * 자체에서 가져온다. `ProjectorEffects`(FE-CORE-03)는 그 값을 로컬 Registry에서 찾기만 하면
 * 된다 — 어떤 효과가 선택됐는지 다시 조회하지 않는다.
 *
 * <p>`initialEnabled`는 FE-PROJECTOR-03의 로컬 비상 스위치 — 서버 runtime 설정과 무관하게 "이
 * 화면"에서만 켜고 끄는 값이라, `ProjectorView`가 자기 `localStorage`(기존 projector local
 * setting 정책, `SETTINGS_TTL_MS`)에서 복구한 값을 그대로 넘겨줄 수 있게 초기값으로 받는다.
 */
export const useProjectorEffectsController = (initialEnabled = true) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [settingsByTrigger, setSettingsByTrigger] = useState<Partial<Record<CeremonyEffectTrigger, TriggerRuntimeSetting>>>({});
  const {
    activeRequest,
    enqueue,
    completeActiveRequest,
    cancelByTrigger,
  } = useCeremonyEffectScheduler<ProjectorEffectRequest>('PROJECTOR');

  /** 행사 설정 snapshot(GET .../effects/settings 또는 공개 프로젝터 조회)을 적용한다. */
  const applySettings = useCallback((settings: CeremonyEventEffectSetting[]) => {
    const next: Partial<Record<CeremonyEffectTrigger, TriggerRuntimeSetting>> = {};
    settings.filter(setting => setting.targetType === 'PROJECTOR').forEach(setting => {
      next[setting.triggerType] = { effectCode: setting.effectCode, runtimeEnabled: setting.runtimeEnabled };
    });
    setSettingsByTrigger(next);
  }, []);

  const consumeRealtimeEvent = useCallback((event: RealtimeEventMessage): boolean => {
    if (event.type === 'ceremony.effect.setting.changed') {
      const targetType = String(event.payload.targetType ?? '');
      const triggerType = String(event.payload.triggerType ?? '') as CeremonyEffectTrigger;
      const effectCode = String(event.payload.effectCode ?? '');
      const runtimeEnabled = event.payload.runtimeEnabled === true;
      if (targetType === 'PROJECTOR') {
        setSettingsByTrigger(current => ({ ...current, [triggerType]: { effectCode, runtimeEnabled } }));
        if (!runtimeEnabled) cancelByTrigger(triggerType);
      }
      return true;
    }

    if (event.type === 'ceremony.effect.requested') {
      const targetType = String(event.payload.targetType ?? '');
      const triggerType = String(event.payload.triggerType ?? '') as CeremonyEffectTrigger;
      const requestId = String(event.payload.requestId ?? '');
      const effectCode = String(event.payload.effectCode ?? '');
      const triggeredBy = event.payload.triggeredBy === 'manual' ? 'manual' : 'auto';
      if (requestId && effectCode && targetType === 'PROJECTOR' && triggerType === 'ALL_SIGNATURES_COMPLETED') {
        enqueue({
          kind: triggerType,
          requestId,
          effectCode,
          triggeredBy,
          targetType: 'PROJECTOR',
          triggerType,
        });
      }
      return true;
    }

    if (event.type === 'SIGNATURE_COMPLETED') {
      const signerId = Number(event.payload.signerId);
      const completionId = String(event.payload.completionId ?? event.version ?? '');
      const setting = settingsByTrigger.SIGNATURE_COMPLETED;
      if (Number.isFinite(signerId) && completionId && setting?.runtimeEnabled && setting.effectCode !== 'NONE') {
        enqueue({
          kind: 'SIGNATURE_COMPLETED',
          requestId: `signature-${signerId}-${completionId}`,
          effectCode: setting.effectCode,
          signerId,
          completionId,
          targetType: 'PROJECTOR',
          triggerType: 'SIGNATURE_COMPLETED',
        });
      }
      // 다른 화면 로직(서명 인원 카운트 등)도 이 "사실" 이벤트를 계속 처리해야 하므로
      // ceremony.effect.* 이벤트와 달리 false를 돌려준다.
      return false;
    }

    return false;
  }, [cancelByTrigger, enqueue, settingsByTrigger]);

  return {
    enabled,
    activeRequest,
    completeActiveRequest,
    toggle: useCallback(() => setEnabled(current => !current), []),
    consumeRealtimeEvent,
    applySettings,
    isRuntimeEnabled: useCallback((triggerType?: CeremonyEffectTrigger) => (
      triggerType == null || settingsByTrigger[triggerType]?.runtimeEnabled !== false
    ), [settingsByTrigger]),
  };
};
