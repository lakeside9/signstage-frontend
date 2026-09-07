import React, { useEffect, useState } from 'react';
import type { ProjectorEffectPageFrame, ProjectorEffectRequest, TemplateFieldSummary } from '../../../types';
import {
  COMPLETION_EFFECT_CATALOG,
  normalizeCompletionEffect,
  normalizeSignatureEffect,
  SIGNATURE_EFFECT_CATALOG,
} from '../../../utils/ceremonyEffectCatalog';
import {
  completionEffectRegistry,
  signatureEffectRegistry,
} from './projectorEffectRegistry';

interface Props {
  enabled: boolean;
  eventStatus: string;
  request: ProjectorEffectRequest | null;
  frames: ProjectorEffectPageFrame[];
  fields: TemplateFieldSummary[];
  portalTarget?: HTMLElement;
  onComplete: (requestId: string) => void;
}

interface ActiveSignature {
  requestId: string;
  signerId: number;
  effectCode: ReturnType<typeof normalizeSignatureEffect>;
}

interface ActiveCompletion {
  requestId: string;
  effectCode: ReturnType<typeof normalizeCompletionEffect>;
}

/**
 * 이벤트 효과 재생 큐 하나를 소비해 실제로 Renderer를 올리는 독립 재생 모듈 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-CORE-03. `useCeremonyEffectScheduler`가
 * 내보내는 `activeRequest`를 그대로 `request`로 받아, 만료되면 `onComplete`로 다음 큐를
 * 진행시킨다. `request.effectCode`는 항상 채워져 있다고 가정한다 —
 * `useProjectorEffectsController`(FE-CORE-02)가 이미 행사 설정 snapshot/`ceremony.effect.requested`
 * payload에서 해석해 넣어 준다.
 *
 * <p>오류 격리(FE-CORE-04)는 이 컴포넌트가 직접 하지 않는다 — 호출부가
 * `ProjectorEffectsBoundary`로 이 컴포넌트를 감싸고 `onError`에서 같은 `onComplete`를 불러야
 * 한다(FE-PROJECTOR-02). 여기서는 로컬 Registry에 없는 code(등록은 됐지만 이 배포에 아직
 * Renderer가 없는 경우)만 방어적으로 걸러 즉시 완료 처리한다.
 */
export const ProjectorEffects: React.FC<Props> = ({
  enabled,
  eventStatus,
  request,
  frames,
  fields,
  portalTarget,
  onComplete,
}) => {
  const [activeSignature, setActiveSignature] = useState<ActiveSignature | null>(null);
  const [activeCompletion, setActiveCompletion] = useState<ActiveCompletion | null>(null);

  useEffect(() => {
    if (!request) return;

    // 재생할 수 없는 요청도 즉시 완료하여 대상별 단일 실행 큐가 멈추지 않게 한다.
    if (!enabled || eventStatus !== 'STARTED') {
      const skippedTimeout = window.setTimeout(() => onComplete(request.requestId), 0);
      return () => window.clearTimeout(skippedTimeout);
    }

    let expiryTimeout: number | undefined;
    const startTimeout = window.setTimeout(() => {
      if (request.kind === 'SIGNATURE_COMPLETED' && request.signerId != null) {
        const effectCode = normalizeSignatureEffect(request.effectCode);
        const Renderer = signatureEffectRegistry[effectCode];
        if (!Renderer) {
          onComplete(request.requestId);
          return;
        }
        setActiveSignature({ requestId: request.requestId, signerId: request.signerId, effectCode });
        expiryTimeout = window.setTimeout(() => {
          setActiveSignature(current => current?.requestId === request.requestId ? null : current);
          onComplete(request.requestId);
        }, SIGNATURE_EFFECT_CATALOG[effectCode].durationMs);
        return;
      }

      if (request.kind === 'ALL_SIGNATURES_COMPLETED') {
        const effectCode = normalizeCompletionEffect(request.effectCode);
        const Renderer = completionEffectRegistry[effectCode];
        if (!Renderer) {
          onComplete(request.requestId);
          return;
        }
        // FE-CORE-04 — 축하 연출은 눈에 잘 띄는 만큼 모션 민감 사용자에게는 생략한다.
        // 숨겨진 탭에서 굳이 재생해 rAF 예산을 쓰지도 않는다(어차피 아무도 못 본다).
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion || document.visibilityState === 'hidden') {
          onComplete(request.requestId);
          return;
        }
        setActiveCompletion({ requestId: request.requestId, effectCode });
        expiryTimeout = window.setTimeout(() => {
          setActiveCompletion(current => current?.requestId === request.requestId ? null : current);
          onComplete(request.requestId);
        }, COMPLETION_EFFECT_CATALOG[effectCode].durationMs);
      }
    }, 0);

    return () => {
      window.clearTimeout(startTimeout);
      if (expiryTimeout != null) window.clearTimeout(expiryTimeout);
    };
  }, [enabled, eventStatus, onComplete, request]);

  useEffect(() => {
    if (enabled) return;
    const timeout = window.setTimeout(() => {
      setActiveSignature(null);
      setActiveCompletion(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [enabled]);

  const SignatureRenderer = activeSignature
    ? signatureEffectRegistry[activeSignature.effectCode]
    : undefined;
  const CompletionRenderer = activeCompletion
    ? completionEffectRegistry[activeCompletion.effectCode]
    : undefined;

  return (
    <>
      {activeSignature && SignatureRenderer && (
        <SignatureRenderer
          requestId={activeSignature.requestId}
          signerId={activeSignature.signerId}
          frames={frames}
          fields={fields}
        />
      )}
      {activeCompletion && CompletionRenderer && (
        <CompletionRenderer
          key={activeCompletion.requestId}
          requestId={activeCompletion.requestId}
          portalTarget={portalTarget}
        />
      )}
    </>
  );
};
