import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Eye } from 'lucide-react';
import { api } from '../../../utils/api';
import { intersectDefinitionsWithRegistry } from '../../../utils/ceremonyEffectCatalog';
import { completionEffectRegistry, signatureEffectRegistry } from '../projector/projectorEffectRegistry';
import { EffectPreviewDialog } from '../preview/EffectPreviewDialog';
import type { EffectPreviewDefinition } from '../preview/EffectPreviewStage';
import type {
  CeremonyEffectDefinition,
  CeremonyEffectSelection,
  CeremonyEffectTrigger,
} from '../../../types';

/**
 * 개별/전체 완료 효과 그룹 정의 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-EVENT-01. 백엔드 seed
 * (`V202609071100__seed_and_backfill_ceremony_event_effects.sql`)가 이 두 (target=PROJECTOR,
 * trigger) 분류에만 정의를 심으므로, 화면도 이 두 그룹만 고정으로 다룬다 — 관리자가 나중에
 * `EVENT_FINISHED`/`SIGNER` 대상 정의를 추가해도(PRE-02) 이 화면은 아직 그 UI가 없다.
 *
 * 어느 선택옵션이 필요한지는 더 이상 이 화면이 고정으로 알지 못한다(2026-09-08 결정) —
 * "이벤트 효과 묶음"이 관리자가 계속 추가하는 상품이라 코드에 특정 code를 박아둘 수 없다.
 * 대신 각 `CeremonyEffectDefinition.optionalFeatureIds`(그 효과를 여는 묶음 id 목록)와
 * `selectedFeatureIds`(이 행사가 실제로 적용한 옵션 id 목록)의 교집합 유무로 판단한다 —
 * 백엔드 `CeremonyEventEffectSettingService`의 entitlement 판정(합집합)과 같은 규칙이다.
 */
const EFFECT_GROUPS: {
  triggerType: CeremonyEffectTrigger;
  label: string;
  registry: Partial<Record<string, unknown>>;
}[] = [
  { triggerType: 'SIGNATURE_COMPLETED', label: '개별 서명 확인', registry: signatureEffectRegistry },
  { triggerType: 'ALL_SIGNATURES_COMPLETED', label: '전체 서명 완료', registry: completionEffectRegistry },
];

const NONE_VALUE = 'NONE';

/** 이 효과가 열어주는 묶음 중 하나라도 지금 적용돼 있으면 entitled다(합집합 판정). */
const isEntitled = (definition: CeremonyEffectDefinition, selectedFeatureIds: number[]): boolean => (
  definition.optionalFeatureIds.some((featureId) => selectedFeatureIds.includes(featureId))
);

interface Props {
  /** 폼에서 지금 체크돼 있는 선택옵션 id 목록 — 이 값이 바뀌면(옵션 해제) 종속 프리셋도 즉시 해제한다. */
  selectedFeatureIds: number[];
  value: CeremonyEffectSelection[];
  onChange: (value: CeremonyEffectSelection[]) => void;
  disabled?: boolean;
  /** 모달처럼 좁은 자리에서는 true로 둬 컴팩트한 padding을 쓴다(`EventDateTimeInput`과 같은 관례). */
  dense?: boolean;
}

/**
 * 하위 행사 등록/수정 화면의 "개별/전체 완료 효과 선택" 필드. 레거시
 * `ProjectorEffectSettingsFields.tsx`를 이 백엔드의 계약(선택옵션 종속, effectId 기반 선택,
 * DRAFT/READY 잠금)에 맞게 다시 작성했다. 미리보기는 FE-ADMIN-03에서 만든 공용
 * `EffectPreviewDialog`를 그대로 재사용한다(목록/등록·수정 draft와 같은 컴포넌트).
 */
export const CeremonyEventEffectSelectionFields: FC<Props> = ({
  selectedFeatureIds, value, onChange, disabled = false, dense = false,
}) => {
  const [definitions, setDefinitions] = useState<CeremonyEffectDefinition[] | null>(null);
  const [previewEffect, setPreviewEffect] = useState<EffectPreviewDefinition | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/ceremony-effects');
        if (!cancelled) {
          setDefinitions(response.data as CeremonyEffectDefinition[]);
        }
      } catch {
        // 카탈로그 조회 오류는 "사용 안 함"만 노출하는 것으로 충분하다 — 등록/수정 자체를 막지 않는다.
        if (!cancelled) {
          setDefinitions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGroups = EFFECT_GROUPS.filter((group) => (
    definitions?.some((d) => (
      d.targetType === 'PROJECTOR' && d.triggerType === group.triggerType && isEntitled(d, selectedFeatureIds)
    )) ?? false
  ));

  /**
   * 옵션을 해제하면(더 이상 selectedFeatureIds에 없으면) 그 그룹의 선택도 화면에서 즉시
   * 해제한다 — 백엔드 `pruneSettingsRequiringUnappliedFeatures`와 같은 규칙을 저장 전
   * 클라이언트에서도 미리 지킨다.
   */
  useEffect(() => {
    const visibleTriggerTypes = new Set(visibleGroups.map((group) => group.triggerType));
    const pruned = value.filter((selection) => visibleTriggerTypes.has(selection.triggerType));
    if (pruned.length !== value.length) {
      onChange(pruned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeatureIds, definitions]);

  if (visibleGroups.length === 0) return null;

  const selectClass = dense
    ? 'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100'
    : 'w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50';
  const labelClass = dense ? 'block text-xs font-medium text-gray-500 mb-1' : 'block text-sm font-medium text-gray-700 mb-2';

  const handleSelect = (triggerType: CeremonyEffectTrigger, rawValue: string) => {
    const next = value.filter((selection) => selection.triggerType !== triggerType);
    if (rawValue !== NONE_VALUE) {
      next.push({ targetType: 'PROJECTOR', triggerType, effectId: Number(rawValue) });
    }
    onChange(next);
  };

  return (
    <div className={dense ? 'space-y-3' : 'space-y-4'}>
      {visibleGroups.map((group) => {
        const options = definitions == null
          ? null
          : intersectDefinitionsWithRegistry(
            definitions.filter((d) => (
              d.targetType === 'PROJECTOR' && d.triggerType === group.triggerType && isEntitled(d, selectedFeatureIds)
            )),
            group.registry,
          );
        const selectedId = value.find((selection) => selection.triggerType === group.triggerType)?.effectId ?? null;
        const selectedDefinition = options?.find((effect) => effect.id === selectedId) ?? null;
        return (
          <div key={group.triggerType}>
            <label className={labelClass}>{group.label} 효과</label>
            <div className="flex items-center gap-2">
              <select
                disabled={disabled || options == null || options.length === 0}
                value={selectedId != null ? String(selectedId) : NONE_VALUE}
                onChange={(e) => handleSelect(group.triggerType, e.target.value)}
                className={selectClass}
              >
                <option value={NONE_VALUE}>사용 안 함</option>
                {options?.map((effect) => (
                  <option key={effect.id} value={String(effect.id)}>{effect.displayName}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedDefinition}
                onClick={() => selectedDefinition && setPreviewEffect({
                  code: selectedDefinition.code,
                  displayName: selectedDefinition.displayName,
                  targetType: selectedDefinition.targetType,
                  triggerType: selectedDefinition.triggerType,
                  rendererKey: selectedDefinition.rendererKey,
                  configJson: selectedDefinition.configJson ? JSON.stringify(selectedDefinition.configJson) : null,
                })}
                title="선택한 효과 미리보기"
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Eye size={13} />
              </button>
            </div>
          </div>
        );
      })}
      <EffectPreviewDialog open={previewEffect != null} effect={previewEffect} onClose={() => setPreviewEffect(null)} />
    </div>
  );
};
