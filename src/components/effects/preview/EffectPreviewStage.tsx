import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import type {
  AllSignaturesCompleteEffect,
  ProjectorEffectPageFrame,
  SignatureCompleteEffect,
  TemplateFieldSummary,
} from '../../../types';
import { completionEffectRegistry, signatureEffectRegistry } from '../projector/projectorEffectRegistry';
import { EffectPreviewErrorBoundary } from './EffectPreviewErrorBoundary';

/**
 * 미리보기 대상 효과 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-ADMIN-03. `CeremonyEffectDefinition`을
 * 그대로 재사용하지 않는다 — 이 백엔드의 `configJson`은 이미 파싱된 객체
 * (`Record<string, unknown> | null`)인데, 등록/수정 폼은 아직 저장 전 원문 텍스트를 편집하는
 * 중이라 유효하지 않은 JSON일 수도 있다. 그래서 여기서는 `configJson`을 원문 문자열로
 * 받는다 — 목록/수정 화면처럼 이미 저장된 정의를 미리볼 때는 `JSON.stringify`로 맞춘다.
 */
export interface EffectPreviewDefinition {
  code: string;
  displayName: string;
  targetType: 'PROJECTOR' | 'SIGNER';
  triggerType: 'SIGNATURE_COMPLETED' | 'ALL_SIGNATURES_COMPLETED' | 'EVENT_FINISHED';
  rendererKey: string;
  configJson?: string | null;
}

type Props = {
  effect: EffectPreviewDefinition;
  playbackKey: number;
  playing: boolean;
};

const PREVIEW_SIGNER_ID = 1;

/** 미리보기 stage 안에서만 쓰는 샘플 서명란 — 실제 템플릿 데이터를 조회하지 않는다. */
const PREVIEW_FIELD: TemplateFieldSummary = {
  id: 1,
  templateId: 1,
  signerId: PREVIEW_SIGNER_ID,
  fieldKey: 'preview-field',
  pageIndex: 0,
  fieldIndex: 0,
  fieldName: '서명',
  roleCode: null,
  signOrder: null,
  isRequired: true,
  xRatio: 0.22,
  yRatio: 0.61,
  widthRatio: 0.56,
  heightRatio: 0.16,
  createdAt: '2026-01-01T00:00:00',
};

export const EffectPreviewStage: FC<Props> = ({ effect, playbackKey, playing }) => {
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 768, height: 432 });
  const [failedRenderKey, setFailedRenderKey] = useState<string | null>(null);

  useEffect(() => {
    if (!portalTarget) return undefined;
    const measure = () => {
      const width = portalTarget.clientWidth;
      if (width > 0) setSize({ width, height: (width * 9) / 16 });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(portalTarget);
    return () => observer.disconnect();
  }, [portalTarget]);

  const configError = useMemo(() => {
    if (!effect.configJson?.trim()) return false;
    try {
      const parsed = JSON.parse(effect.configJson);
      return parsed == null || Array.isArray(parsed) || typeof parsed !== 'object';
    } catch {
      return true;
    }
  }, [effect.configJson]);

  const SignatureRenderer = effect.targetType === 'PROJECTOR' && effect.triggerType === 'SIGNATURE_COMPLETED'
    ? signatureEffectRegistry[effect.code as SignatureCompleteEffect]
    : undefined;
  const CompletionRenderer = effect.targetType === 'PROJECTOR' && effect.triggerType === 'ALL_SIGNATURES_COMPLETED'
    ? completionEffectRegistry[effect.code as AllSignaturesCompleteEffect]
    : undefined;
  const rendererAvailable = Boolean(SignatureRenderer || CompletionRenderer);
  const renderKey = `${effect.code}:${playbackKey}`;
  const renderFailed = failedRenderKey === renderKey;

  const frames: ProjectorEffectPageFrame[] = [{ pageIndex: 0, x: 0, y: 0, width: size.width, height: size.height }];

  const message = configError
    ? '설정 JSON이 올바른 객체 형식이어야 미리볼 수 있습니다.'
    : renderFailed
      ? '효과 Renderer에서 오류가 발생했습니다. 실제 행사 동작에는 영향을 주지 않습니다.'
      : !rendererAvailable
        ? '현재 프론트엔드에 배포된 Renderer가 없어 미리볼 수 없습니다.'
        : null;

  return (
    <div
      ref={setPortalTarget}
      data-testid="effect-preview-stage"
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-700 bg-slate-950 shadow-inner"
    >
      <div className="absolute inset-[7%] rounded-sm bg-white shadow-2xl">
        <div className="mx-auto mt-[8%] h-2 w-2/5 rounded bg-gray-300" />
        <div className="mx-auto mt-5 h-1.5 w-3/5 rounded bg-gray-200" />
        <div className="mx-auto mt-3 h-1.5 w-2/3 rounded bg-gray-200" />
        <div className="absolute bottom-[19%] left-[22%] h-[16%] w-[56%] rounded-lg border-2 border-dashed border-gray-400 bg-gray-50">
          <span className="flex h-full items-center justify-center font-serif text-[clamp(12px,2vw,24px)] italic text-gray-700">
            SignStage Preview
          </span>
        </div>
      </div>

      {message && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-slate-950/85 p-8 text-center text-sm font-medium text-white">
          {message}
        </div>
      )}

      {playing && rendererAvailable && !configError && !renderFailed && (
        <EffectPreviewErrorBoundary resetKey={playbackKey} onError={() => setFailedRenderKey(renderKey)}>
          {SignatureRenderer && (
            <SignatureRenderer
              key={`signature-${playbackKey}`}
              requestId={`preview-${playbackKey}`}
              signerId={PREVIEW_SIGNER_ID}
              frames={frames}
              fields={[PREVIEW_FIELD]}
            />
          )}
          {CompletionRenderer && portalTarget && (
            <CompletionRenderer key={`completion-${playbackKey}`} requestId={`preview-${playbackKey}`} portalTarget={portalTarget} />
          )}
        </EffectPreviewErrorBoundary>
      )}
    </div>
  );
};
