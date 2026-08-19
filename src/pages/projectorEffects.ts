import type { OptionalFeatureCode, RealtimeEventMessage, TemplateFieldSummary } from '../types';

/**
 * 프로젝터(전시화면) 전용 연출 효과 레지스트리. 하위 행사에 적용된 선택옵션(OptionalFeatureCode)마다
 * "어떤 실시간 이벤트에 반응해 어떤 액션을 낼지"를 이 파일에서만 정의한다 — `ProjectorView`는
 * {@link resolveProjectorEffectActions} 하나만 호출해서 나온 액션을 자기 화면 상태에 반영할 뿐,
 * WebSocket 메시지 타입과 옵션 코드를 직접 매칭하지 않는다.
 *
 * 새 옵션의 효과를 추가할 때:
 * 1. 필요하면 {@link ProjectorEffectAction}에 새 `kind`를 늘린다(예: `{ kind: 'fireworks' }`).
 * 2. 그 옵션 코드용 `ProjectorEffectHandlers` 객체를 만들어 관심 있는 이벤트 타입에 대해
 *    페이로드 → 액션 계산 함수를 채운다.
 * 3. {@link OPTIONAL_FEATURE_EFFECTS}에 코드→핸들러 항목을 추가한다.
 * 4. `ProjectorView`에서 그 `kind`를 처리하는 렌더링/상태 코드를 추가한다.
 *
 * `ProjectorView`의 WebSocket 구독·디스패치 코드 자체는 건드릴 필요가 없다 — 그게 이 파일을
 * 분리해 둔 이유다.
 */

/** 각 효과가 낼 수 있는 액션. 새 효과를 추가하면 여기 새 kind를 늘린다. */
export type ProjectorEffectAction = { kind: 'highlightFields'; fieldIds: number[] } | { kind: 'fireworks' };

export interface ProjectorEffectContext {
  /** 전시용 문서에 배치된 서명란 전체 — signerId로 "이 서명자의 필드가 어디인지" 찾는 데 쓴다. */
  fields: TemplateFieldSummary[];
}

type ProjectorEffectHandler = (
  payload: Record<string, unknown>,
  ctx: ProjectorEffectContext,
) => ProjectorEffectAction | null;

/** 옵션 하나가 반응하는 실시간 이벤트 타입 → 액션 계산 함수 묶음. */
type ProjectorEffectHandlers = Partial<Record<RealtimeEventMessage['type'], ProjectorEffectHandler>>;

/**
 * 서명확대(SIGNER_FIELD_ZOOM) — "주목시키기"가 목적이라 실제 배율 확대 대신 테두리 하이라이트로
 * 구현한다(signstage-docs business/ceremony-feature-migration-review.md 참고). 스트로크
 * 단위(`SIGNATURE_STROKE_SUBMITTED`)가 아니라 그 서명자가 자기 몫을 전부 완료한 순간
 * (`SIGNATURE_COMPLETED`) 1회만 반응한다 — 트리거가 명확한 1회성 이벤트라 "언제 꺼야 하는지"
 * 추측(무입력 타이머)이 필요 없고, 서명 도중 계속 재조정되는 산만한 연출도 피할 수 있다.
 * 동시에 여러 명이 완료돼도 각자 자기 필드 위치에서 독립적으로 빛나 화면 자리를 다툴 일이 없다
 * (PIP 패널 방식과 달리 큐/슬롯 관리가 필요 없다).
 */
const SIGNER_FIELD_ZOOM_HANDLERS: ProjectorEffectHandlers = {
  SIGNATURE_COMPLETED: (payload, ctx) => {
    const signerId = Number(payload.signerId);
    if (!Number.isFinite(signerId)) return null;

    const fieldIds = ctx.fields.filter((field) => field.signerId === signerId).map((field) => field.id);
    if (fieldIds.length === 0) return null;

    return { kind: 'highlightFields', fieldIds };
  },
};

/**
 * 폭죽(ALL_SIGNED_FIREWORKS) — 백엔드가 이 이벤트의 필수 서명자 전원이 방금 완료로 전환된
 * 순간에만 정확히 한 번 보내는 `ALL_SIGNERS_COMPLETED`를 그대로 트리거로 쓴다("전원 완료"
 * 판정과 중복 방지는 백엔드 책임 — `SignerPortalService.completeSignature`가 이벤트 행 잠금으로
 * 보장한다). payload가 없어 페이로드를 읽을 필요조차 없다.
 */
const ALL_SIGNED_FIREWORKS_HANDLERS: ProjectorEffectHandlers = {
  ALL_SIGNERS_COMPLETED: () => ({ kind: 'fireworks' }),
};

/**
 * 하위 행사에 적용된 옵션 코드마다 쓸 핸들러 묶음. 아직 효과가 구현되지 않은 코드는 항목을
 * 두지 않는다 — 옵션이 적용돼 있어도 프로젝터는 조용히 아무 반응도 하지 않는다(구현 전 옵션을
 * 켰다고 에러가 나거나 다른 효과가 대신 뜨지 않는다).
 */
const OPTIONAL_FEATURE_EFFECTS: Partial<Record<OptionalFeatureCode, ProjectorEffectHandlers>> = {
  SIGNER_FIELD_ZOOM: SIGNER_FIELD_ZOOM_HANDLERS,
  ALL_SIGNED_FIREWORKS: ALL_SIGNED_FIREWORKS_HANDLERS,
};

/**
 * 실시간 이벤트 하나를, 이 하위 행사에 적용된 옵션들의 핸들러에 전부 통과시켜 나온 액션을
 * 모아 돌려준다. `ProjectorView`는 WebSocket 메시지를 받을 때마다 이 함수를 호출하고, 결과
 * 액션들을 화면 상태에 반영하기만 하면 된다.
 */
export function resolveProjectorEffectActions(
  event: RealtimeEventMessage,
  appliedOptionalFeatureCodes: OptionalFeatureCode[],
  ctx: ProjectorEffectContext,
): ProjectorEffectAction[] {
  const actions: ProjectorEffectAction[] = [];
  for (const code of appliedOptionalFeatureCodes) {
    const handler = OPTIONAL_FEATURE_EFFECTS[code]?.[event.type];
    if (!handler) continue;
    const action = handler(event.payload, ctx);
    if (action) actions.push(action);
  }
  return actions;
}
