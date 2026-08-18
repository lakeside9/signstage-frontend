import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import { FileText, Loader2, Maximize, Minimize } from 'lucide-react';
import { MappedDocumentPreview } from '../components/MappedDocumentPreview';
import type { ProjectorContext, RealtimeEventMessage, StrokeSummary } from '../types';

const API_BASE = '/api/projector/events';

/**
 * 공개 프로젝터 화면(전시용 화면). legacy(~/Works/eform/source/signstage/signstage-frontend)
 * `ProjectorView.tsx`를 참고했다 — 로그인 없이 `eventAccessKey`만으로 접속하는 완전히 새로운
 * 공개 라우트다(`/projector/:eventAccessKey`, 레이아웃 없음). 서명자 포털과 같은 인가 모델
 * (accessKey 소지, JWT 없음)이라 관리자 콘솔의 `api.ts`(JWT Bearer 헤더)를 쓰지 않고 plain
 * `fetch`로 직접 호출한다.
 *
 * legacy의 다중 페이지 동시 표시/localStorage 설정 저장까지는 포팅하지 않고 단일 페이지
 * 뷰 + 줌 + 전체화면으로 단순화했다 — `MappedDocumentPreview`가 이미 페이지 이동/줌을
 * 제공하므로 그대로 재사용한다.
 */
export const ProjectorView: FC = () => {
  const { eventAccessKey } = useParams<{ eventAccessKey: string }>();
  const [context, setContext] = useState<ProjectorContext | null>(null);
  const [strokes, setStrokes] = useState<StrokeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!eventAccessKey) return;
    let cancelled = false;

    (async () => {
      try {
        const [contextRes, strokesRes] = await Promise.all([
          fetch(`${API_BASE}/${eventAccessKey}`).then((r) => r.json()),
          fetch(`${API_BASE}/${eventAccessKey}/strokes`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (contextRes.code !== 'SUCCESS') {
          setError(contextRes.message ?? '행사 정보를 불러오지 못했습니다.');
          return;
        }
        setContext(contextRes.data as ProjectorContext);
        setStrokes((strokesRes.data ?? []) as StrokeSummary[]);
      } catch {
        if (!cancelled) setError('행사 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventAccessKey]);

  useEffect(() => {
    if (!context?.eventId || !eventAccessKey) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const client = new Client({
      brokerURL: `${wsProtocol}://${window.location.hostname}:8080/ws-signstage`,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(
          `/topic/events/${context.eventId}/state`,
          (message: IMessage) => {
            let realtimeEvent: RealtimeEventMessage;
            try {
              realtimeEvent = JSON.parse(message.body) as RealtimeEventMessage;
            } catch {
              return;
            }

            if (realtimeEvent.type === 'SIGNATURE_STROKE_SUBMITTED') {
              const payload = realtimeEvent.payload as {
                signerId: number;
                templateFieldId: number;
                strokeSeq: number;
                rawData: string;
              };
              setStrokes((prev) => [
                ...prev,
                {
                  id: Date.now(),
                  signerId: payload.signerId,
                  templateFieldId: payload.templateFieldId,
                  strokeSeq: payload.strokeSeq,
                  rawData: payload.rawData,
                  createdAt: new Date().toISOString(),
                },
              ]);
            } else if (realtimeEvent.type === 'SIGNATURE_CLEARED') {
              const payload = realtimeEvent.payload as { templateFieldId: number };
              setStrokes((prev) => prev.filter((s) => s.templateFieldId !== payload.templateFieldId));
            } else if (realtimeEvent.type === 'EVENT_STATUS_CHANGED') {
              const newStatus = (realtimeEvent.payload as { newStatus: string }).newStatus;
              setContext((prev) => (prev ? { ...prev, eventStatus: newStatus as ProjectorContext['eventStatus'] } : prev));
            }
          },
          { eventAccessKey },
        );
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [context?.eventId, eventAccessKey]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // 전체화면 API를 지원하지 않는 브라우저도 있다 — 실패해도 조용히 무시한다.
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {
        // 위와 같은 이유.
      });
      setIsFullscreen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mb-3" size={40} />
        전시용 화면을 불러오는 중입니다...
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-gray-400 gap-3">
        <FileText size={48} className="opacity-30" />
        <p>{error ?? '행사 정보를 찾을 수 없습니다.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div>
          <h1 className="text-white font-bold">{context.eventName}</h1>
          <p className="text-xs text-gray-400">전시용 화면</p>
        </div>
        <button
          onClick={toggleFullscreen}
          className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        {context.exhibition ? (
          <div className="w-full max-w-4xl">
            <MappedDocumentPreview
              label={context.exhibition.title}
              fields={context.exhibition.fields}
              signerNameById={new Map(context.exhibition.signers.map((s) => [s.id, s.name]))}
              fetchPage={(pageIndex, scale) =>
                fetch(`${API_BASE}/${eventAccessKey}/pages/${pageIndex}?scale=${scale}`).then((r) => r.blob())
              }
              pageCount={context.exhibition.pageCount}
              strokes={strokes}
              emptyMessage="전시용 문서를 불러오는 중입니다."
            />
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-500 gap-3">
            <FileText size={48} className="opacity-30" />
            <p>전시용 문서가 매핑되지 않았습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};
