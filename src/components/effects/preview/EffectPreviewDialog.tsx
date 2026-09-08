import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { createPortal } from 'react-dom';
import { Play, RotateCcw, Square, X } from 'lucide-react';
import { COMPLETION_EFFECT_CATALOG, SIGNATURE_EFFECT_CATALOG } from '../../../utils/ceremonyEffectCatalog';
import { EffectPreviewStage } from './EffectPreviewStage';
import type { EffectPreviewDefinition } from './EffectPreviewStage';

interface Props {
  open: boolean;
  effect: EffectPreviewDefinition | null;
  onClose: () => void;
}

const durationFor = (effect: EffectPreviewDefinition): number => {
  if (effect.code in SIGNATURE_EFFECT_CATALOG) {
    return SIGNATURE_EFFECT_CATALOG[effect.code as keyof typeof SIGNATURE_EFFECT_CATALOG].durationMs;
  }
  if (effect.code in COMPLETION_EFFECT_CATALOG) {
    return COMPLETION_EFFECT_CATALOG[effect.code as keyof typeof COMPLETION_EFFECT_CATALOG].durationMs;
  }
  return 4000;
};

/**
 * 공용 효과 미리보기 dialog — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-ADMIN-03. 목록/등록·수정
 * draft/행사 설정(`CeremonyEventEffectSelectionFields`) 세 곳이 이 컴포넌트 하나를 그대로
 * 공유한다. `preview-{playbackKey}` requestId만 쓰고 운영 API·WebSocket을 전혀 호출하지
 * 않는다 — `EffectPreviewStage`가 실제 Renderer를 마운트하되, 그 Renderer들은 어차피
 * `completionEffectRegistry`/`signatureEffectRegistry`의 순수 컴포넌트라 이 dialog가 별도로
 * 격리할 것이 없다(Renderer 오류만 `EffectPreviewErrorBoundary`로 막는다).
 */
export const EffectPreviewDialog: FC<Props> = ({ open, effect, onClose }) => {
  const [playbackKey, setPlaybackKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const durationMs = useMemo(() => (effect ? durationFor(effect) : 0), [effect]);

  useEffect(() => {
    if (!open || !effect) return undefined;
    const start = window.setTimeout(() => {
      setPlaybackKey((current) => current + 1);
      setPlaying(true);
    }, 0);
    return () => window.clearTimeout(start);
  }, [effect, open]);

  useEffect(() => {
    if (!playing) return undefined;
    const timeout = window.setTimeout(() => setPlaying(false), durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, playbackKey, playing]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open || !effect || typeof document === 'undefined') return null;

  const replay = () => {
    setPlaybackKey((current) => current + 1);
    setPlaying(true);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-label={`${effect.displayName} 미리보기`} className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-gray-950">{effect.displayName}</h2>
              <code className="rounded bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">{effect.code}</code>
            </div>
            <p className="mt-1 text-xs text-gray-500">실제 행사 이벤트나 WebSocket 요청을 발생시키지 않는 로컬 미리보기입니다.</p>
          </div>
          <button type="button" aria-label="미리보기 닫기" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X size={20} />
          </button>
        </header>

        <EffectPreviewStage effect={effect} playbackKey={playbackKey} playing={playing} />

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            대상: {effect.targetType === 'PROJECTOR' ? '프로젝터 화면' : '서명자 화면'} · 예상 재생시간 {(durationMs / 1000).toFixed(1)}초
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPlaying(false)}
              disabled={!playing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <Square size={14} /> 정지
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
            >
              {playing ? <RotateCcw size={15} /> : <Play size={15} />} {playing ? '다시 재생' : '재생'}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
