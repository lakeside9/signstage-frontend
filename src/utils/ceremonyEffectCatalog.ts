import type { CeremonyEffectDefinition } from '../types';

/**
 * feature.ceremony.entity.CeremonyEffectTarget/CeremonyEffectTrigger 값과 맞춘다 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-CORE-01. `SIGNER`/`EVENT_FINISHED`는
 * 백엔드 스키마·계약만 열려 있고 실제 효과가 없다(PRE-02) — 이 카탈로그도 아직 값을 채우지 않는다.
 */
export type CeremonyEffectTarget = 'PROJECTOR' | 'SIGNER';
export type CeremonyEffectTrigger = 'SIGNATURE_COMPLETED' | 'ALL_SIGNATURES_COMPLETED' | 'EVENT_FINISHED';

/**
 * 로컬 폴백 카탈로그 — signstage-backend `V202609071100__seed_and_backfill_ceremony_event_effects.sql`이
 * 심는 `ceremony_effect_definitions`의 code/rendererKey/displayOrder와 정확히 일치해야 한다
 * (`ceremonyEffectCatalog.test.ts`가 이 계약을 고정한다). `durationMs`/`fieldAnchored`는
 * 순수 프런트 연출 값이라 백엔드에 없다.
 */
export const SIGNATURE_EFFECT_CATALOG = {
  NONE: {
    code: 'NONE',
    label: '사용 안 함',
    durationMs: 0,
    targetType: 'PROJECTOR',
    triggerType: 'SIGNATURE_COMPLETED',
    rendererKey: null,
    // 특정 서명란 좌표에 앵커되는 효과인지. NONE은 렌더러 자체가 없어 의미 없지만
    // 형식상 false — 화면 전체를 덮고 필드 위치가 필요 없는 효과가 생기면 이 값을
    // false로 둬서, 미리보기 화면이 "매핑된 서명란 필요" 안내를 잘못 띄우지 않게 한다.
    fieldAnchored: false,
  },
  HIGHLIGHT: {
    code: 'HIGHLIGHT',
    label: '서명란 강조',
    durationMs: 1600,
    targetType: 'PROJECTOR',
    triggerType: 'SIGNATURE_COMPLETED',
    rendererKey: 'projector-signature-highlight',
    fieldAnchored: true,
  },
  PULSE: {
    code: 'PULSE',
    label: '서명란 펄스',
    durationMs: 2200,
    targetType: 'PROJECTOR',
    triggerType: 'SIGNATURE_COMPLETED',
    rendererKey: 'projector-signature-pulse',
    fieldAnchored: true,
  },
  RIPPLE: {
    code: 'RIPPLE',
    label: '서명란 물결',
    durationMs: 2400,
    targetType: 'PROJECTOR',
    triggerType: 'SIGNATURE_COMPLETED',
    rendererKey: 'projector-signature-ripple',
    fieldAnchored: true,
  },
  FLASH: {
    code: 'FLASH',
    label: '카메라 플래시',
    // 3회 연속 번쩍임(FLASH_COUNT×FLASH_INTERVAL, SignatureFlashEffect.tsx)의 마지막 펄스가
    // 완전히 잦아드는 시점(~1.06s)에 여유를 둔 값.
    durationMs: 1200,
    targetType: 'PROJECTOR',
    triggerType: 'SIGNATURE_COMPLETED',
    rendererKey: 'projector-signature-flash',
    fieldAnchored: true,
  },
} as const;

export const COMPLETION_EFFECT_CATALOG = {
  NONE: {
    code: 'NONE',
    label: '사용 안 함',
    durationMs: 0,
    manuallyTriggerable: false,
    targetType: 'PROJECTOR',
    triggerType: 'ALL_SIGNATURES_COMPLETED',
    rendererKey: null,
  },
  CONFETTI: {
    code: 'CONFETTI',
    label: '축하 색종이',
    durationMs: 4800,
    manuallyTriggerable: true,
    targetType: 'PROJECTOR',
    triggerType: 'ALL_SIGNATURES_COMPLETED',
    rendererKey: 'projector-confetti',
  },
  FIREWORKS: {
    code: 'FIREWORKS',
    label: '축하 불꽃놀이',
    // 마지막 버스트(delay 2.15s) + 스파크 애니메이션(1.45s) 종료 시점(3.6s)에
    // 200ms 여유를 둔 값. 실제 연출보다 durationMs가 길면 화면이 빈 채로
    // 큐가 묶여 다음 효과 재생이 불필요하게 지연된다.
    durationMs: 3800,
    manuallyTriggerable: true,
    targetType: 'PROJECTOR',
    triggerType: 'ALL_SIGNATURES_COMPLETED',
    rendererKey: 'projector-fireworks',
  },
  SPARKLE: {
    code: 'SPARKLE',
    label: '축하 별빛',
    durationMs: 4200,
    manuallyTriggerable: true,
    targetType: 'PROJECTOR',
    triggerType: 'ALL_SIGNATURES_COMPLETED',
    rendererKey: 'projector-sparkle',
  },
  AIR_SHOT: {
    code: 'AIR_SHOT',
    label: '에어샷 꽃가루',
    durationMs: 5200,
    manuallyTriggerable: true,
    targetType: 'PROJECTOR',
    triggerType: 'ALL_SIGNATURES_COMPLETED',
    rendererKey: 'projector-air-shot',
  },
  PAPER_REEL: {
    code: 'PAPER_REEL',
    label: '페이퍼 릴',
    durationMs: 5000,
    manuallyTriggerable: true,
    targetType: 'PROJECTOR',
    triggerType: 'ALL_SIGNATURES_COMPLETED',
    rendererKey: 'projector-paper-reel',
  },
} as const;

export type SignatureCompleteEffect = keyof typeof SIGNATURE_EFFECT_CATALOG;
export type AllSignaturesCompleteEffect = keyof typeof COMPLETION_EFFECT_CATALOG;

export const signatureEffectDefinitions = Object.values(SIGNATURE_EFFECT_CATALOG);
export const completionEffectDefinitions = Object.values(COMPLETION_EFFECT_CATALOG);

export const normalizeSignatureEffect = (value: unknown): SignatureCompleteEffect => (
  typeof value === 'string' && value in SIGNATURE_EFFECT_CATALOG
    ? value as SignatureCompleteEffect
    : 'NONE'
);

export const normalizeCompletionEffect = (value: unknown): AllSignaturesCompleteEffect => (
  typeof value === 'string' && value in COMPLETION_EFFECT_CATALOG
    ? value as AllSignaturesCompleteEffect
    : 'NONE'
);

export const isCompletionEffectManuallyTriggerable = (value: unknown): boolean => (
  COMPLETION_EFFECT_CATALOG[normalizeCompletionEffect(value)].manuallyTriggerable
);

export const isSignatureEffectFieldAnchored = (value: unknown): boolean => (
  SIGNATURE_EFFECT_CATALOG[normalizeSignatureEffect(value)].fieldAnchored
);

/**
 * 이 코드의 효과가 실제로 어느 화면(targetType)을 대상으로 하는지 판단한다.
 * 백엔드 효과 카탈로그(관리자가 등록한 CeremonyEffectDefinition)에 값이 있으면 그걸
 * 우선하고, 없으면(카탈로그 미조회/미등록) 프론트엔드에 내장된 기본 카탈로그 값으로 대체한다.
 * 지금은 두 로컬 카탈로그 모두 PROJECTOR만 갖고 있지만, 관리자가 SIGNER 대상 효과를
 * 등록하면 이 함수가 그 값을 그대로 반영한다.
 */
export const resolveSignatureEffectTargetType = (
  definitions: CeremonyEffectDefinition[] | null | undefined,
  code: SignatureCompleteEffect,
): CeremonyEffectTarget => (
  definitions?.find(effect => effect.code === code && effect.triggerType === 'SIGNATURE_COMPLETED')?.targetType
    ?? SIGNATURE_EFFECT_CATALOG[code].targetType
);

export const resolveCompletionEffectTargetType = (
  definitions: CeremonyEffectDefinition[] | null | undefined,
  code: AllSignaturesCompleteEffect,
): CeremonyEffectTarget => (
  definitions?.find(effect => effect.code === code && effect.triggerType === 'ALL_SIGNATURES_COMPLETED')?.targetType
    ?? COMPLETION_EFFECT_CATALOG[code].targetType
);

/**
 * 서버 효과 정의 목록을, 실제로 재생할 수 있는(로컬 Renderer Registry에 등록된) 것만으로
 * 좁힌다 — signstage-docs business/ceremony-event-effect-implementation-tasks.md FE-CORE-01.
 * 관리자가 새 code를 카탈로그에 등록해도 이 배포에 그 Renderer가 아직 없으면, 선택 화면에
 * 노출하거나 재생을 시도해 깨지는 대신 조용히 제외한다.
 */
export const intersectDefinitionsWithRegistry = <T extends string>(
  definitions: CeremonyEffectDefinition[],
  registry: Partial<Record<T, unknown>>,
): CeremonyEffectDefinition[] => (
  definitions.filter(definition => (definition.code as T) in registry)
);
