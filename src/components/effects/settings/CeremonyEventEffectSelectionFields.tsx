import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { api } from '../../../utils/api';
import { intersectDefinitionsWithRegistry } from '../../../utils/ceremonyEffectCatalog';
import { completionEffectRegistry, signatureEffectRegistry } from '../projector/projectorEffectRegistry';
import type {
  CeremonyEffectDefinition,
  CeremonyEffectSelection,
  CeremonyEffectTrigger,
  OptionalFeatureCode,
  OptionalFeatureSummary,
} from '../../../types';

/**
 * 개별/전체 완료 효과 그룹 정의 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-EVENT-01. 백엔드 seed
 * (`V202609071100__seed_and_backfill_ceremony_event_effects.sql`)가 이 두 (target=PROJECTOR,
 * trigger) 분류에만 정의를 심으므로, 화면도 이 두 그룹만 고정으로 다룬다 — 관리자가 나중에
 * `EVENT_FINISHED`/`SIGNER` 대상 정의를 추가해도(PRE-02) 이 화면은 아직 그 UI가 없다.
 */
const EFFECT_GROUPS: {
  triggerType: CeremonyEffectTrigger;
  label: string;
  requiredFeatureCode: OptionalFeatureCode;
  registry: Partial<Record<string, unknown>>;
}[] = [
  { triggerType: 'SIGNATURE_COMPLETED', label: '개별 서명 확인', requiredFeatureCode: 'SIGNER_FIELD_ZOOM', registry: signatureEffectRegistry },
  { triggerType: 'ALL_SIGNATURES_COMPLETED', label: '전체 서명 완료', requiredFeatureCode: 'ALL_SIGNED_FIREWORKS', registry: completionEffectRegistry },
];

const NONE_VALUE = 'NONE';

interface Props {
  /** 이 행사 마스터가 실제로 쓸 수 있는 선택옵션 목록(등록/수정 화면이 이미 불러온 값을 그대로 넘긴다). */
  availableFeatures: OptionalFeatureSummary[];
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
 * DRAFT/READY 잠금)에 맞게 다시 작성했다 — 미리보기 버튼은 이식하지 않았다(FE-ADMIN 몫,
 * `EffectPreviewErrorBoundary`만 먼저 이식돼 있고 아직 호출부가 없다).
 */
export const CeremonyEventEffectSelectionFields: FC<Props> = ({
  availableFeatures, selectedFeatureIds, value, onChange, disabled = false, dense = false,
}) => {
  const [definitions, setDefinitions] = useState<CeremonyEffectDefinition[] | null>(null);

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

  const visibleGroups = EFFECT_GROUPS.filter((group) => {
    const feature = availableFeatures.find((f) => f.code === group.requiredFeatureCode);
    return feature != null && selectedFeatureIds.includes(feature.id);
  });

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
  }, [selectedFeatureIds, availableFeatures]);

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
            definitions.filter((d) => d.targetType === 'PROJECTOR' && d.triggerType === group.triggerType),
            group.registry,
          );
        const selectedId = value.find((selection) => selection.triggerType === group.triggerType)?.effectId ?? null;
        return (
          <div key={group.triggerType}>
            <label className={labelClass}>{group.label} 효과</label>
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
          </div>
        );
      })}
    </div>
  );
};
