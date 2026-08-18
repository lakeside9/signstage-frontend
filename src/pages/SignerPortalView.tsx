import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, BadgeCheck, CircleCheckBig, Eraser, Key, Loader2, PenTool } from 'lucide-react';
import { SignaturePad } from '../components/SignaturePad';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PortalContext } from '../types';

interface FieldState {
  hasStroke: boolean;
  strokeSeq: number;
  /** 이번 세션에서 실제로 그린 점 배열만 들고 있다 — 포털 API는 이전 세션의 획 좌표(rawData)를
   * 돌려주지 않는다(hasStroke만 준다). 그래서 hasStroke=true인데 이 목록이 비어 있으면
   * "예전에 서명했지만 지금은 그릴 수 없는 상태"로 표시한다. */
  localStrokes: [number, number][][];
}

/**
 * 서명자 포털(공개, JWT 없음) — `/portal/:eventAccessKey/:signerAccessKey`. accessKey 소지만으로
 * 접근한다(signstage-docs business/ceremony-feature-migration-review.md 2.3/4.5절).
 * 레이아웃 없이 독립된 화면이다.
 *
 * PDF를 배경으로 보여주지 않는다 — 포털 컨텍스트에는 필드 좌표가 없다(좌표가 있는
 * TemplateField 조회는 JWT가 필요해 공개 포털에서 못 부른다). 대신 서명란마다 독립된
 * {@link SignaturePad}를 필드 박스라고 간주하고, 그 안에서의 0~1 상대좌표를 그대로
 * `StrokeData.rawData`로 제출한다 — 계약을 그대로 만족한다.
 */
export const SignerPortalView: FC = () => {
  const { eventAccessKey, signerAccessKey } = useParams<{ eventAccessKey: string; signerAccessKey: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [context, setContext] = useState<PortalContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fieldStates, setFieldStates] = useState<Record<number, FieldState>>({});
  const [isCompleting, setIsCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const portalBase = `/portal/events/${eventAccessKey}/signers/${signerAccessKey}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(portalBase);
        const data = response.data as PortalContext;
        if (!cancelled) {
          setContext(data);
          setFieldStates(
            Object.fromEntries(
              data.requiredFields.map((field) => [
                field.templateFieldId,
                { hasStroke: field.hasStroke, strokeSeq: 0, localStrokes: [] },
              ]),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '접속 정보를 확인할 수 없습니다.';
          setLoadError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventAccessKey, signerAccessKey]);

  const handleStrokeComplete = async (templateFieldId: number, points: [number, number][]) => {
    const state = fieldStates[templateFieldId];
    if (!state) return;

    const seq = state.strokeSeq;
    try {
      await api.post(`${portalBase}/strokes`, {
        templateFieldId,
        strokeSeq: seq,
        rawData: JSON.stringify(points),
      });
      setFieldStates((prev) => ({
        ...prev,
        [templateFieldId]: {
          hasStroke: true,
          strokeSeq: seq + 1,
          localStrokes: [...prev[templateFieldId].localStrokes, points],
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명 획을 저장하지 못했습니다.';
      showSnackbar(message, 'error');
    }
  };

  const handleClear = async (templateFieldId: number) => {
    try {
      await api.delete(`${portalBase}/fields/${templateFieldId}/strokes`);
      setFieldStates((prev) => ({
        ...prev,
        [templateFieldId]: { hasStroke: false, strokeSeq: 0, localStrokes: [] },
      }));
      showSnackbar('서명을 지웠습니다. 다시 그려주세요.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명 지우기에 실패했습니다.';
      showSnackbar(message, 'error');
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await api.post(`${portalBase}/complete`);
      setCompleted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명 완료 처리에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <PortalShell>
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      </PortalShell>
    );
  }

  if (loadError || !context) {
    return (
      <PortalShell>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle size={32} className="text-red-500" />
          <p className="text-sm text-gray-600">{loadError ?? '접속 정보를 확인할 수 없습니다.'}</p>
        </div>
      </PortalShell>
    );
  }

  if (completed) {
    return (
      <PortalShell>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CircleCheckBig size={40} className="text-emerald-500" />
          <p className="text-base font-bold text-gray-950">서명이 완료되었습니다</p>
          <p className="text-sm text-gray-500">{context.signerName}님, 참여해주셔서 감사합니다.</p>
        </div>
      </PortalShell>
    );
  }

  if (context.eventStatus !== 'STARTED') {
    const message = context.eventStatus === 'FINISHED' ? '이미 종료된 행사입니다.' : '아직 서명을 시작할 수 없습니다. 진행자의 안내를 기다려주세요.';
    return (
      <PortalShell>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle size={32} className="text-gray-400" />
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </PortalShell>
    );
  }

  const allSigned = context.requiredFields.every((field) => fieldStates[field.templateFieldId]?.hasStroke);

  return (
    <PortalShell>
      <div className="mb-6 text-center">
        <p className="text-xs text-gray-400">{context.eventName}</p>
        <h1 className="text-lg font-bold text-gray-950">{context.signerName}님, 서명해주세요</h1>
      </div>

      <div className="space-y-6">
        {context.requiredFields.map((field) => {
          const state = fieldStates[field.templateFieldId];
          const alreadySignedElsewhere = state?.hasStroke && state.localStrokes.length === 0;

          return (
            <div key={field.templateFieldId} className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <PenTool size={14} className="text-gray-400" />
                {field.fieldName}
              </p>

              {alreadySignedElsewhere ? (
                <div className="w-[320px] h-[120px] border border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center justify-center gap-1.5 text-gray-400">
                  <BadgeCheck size={24} className="text-emerald-500" />
                  <span className="text-xs">이미 서명함</span>
                </div>
              ) : (
                <SignaturePad
                  strokes={state?.localStrokes ?? []}
                  onStrokeComplete={(points) => handleStrokeComplete(field.templateFieldId, points)}
                />
              )}

              {state?.hasStroke && (
                <button
                  onClick={() => handleClear(field.templateFieldId)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-950"
                >
                  <Eraser size={12} />
                  지우고 다시 서명
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleComplete}
        disabled={!allSigned || isCompleting}
        className="mt-8 w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2.5 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-300"
      >
        {isCompleting ? '처리 중...' : '서명 완료'}
      </button>
    </PortalShell>
  );
};

const PortalShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-center gap-2 mb-6 text-gray-400">
        <Key size={16} />
        <span className="text-xs font-medium">SignStage 서명자 포털</span>
      </div>
      {children}
    </div>
  </div>
);
