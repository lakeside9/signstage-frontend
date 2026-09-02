import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import { AlertCircle, ChevronUp, FileText, Info, Loader2, Maximize2, MousePointerClick, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { PortalSignCanvas } from '../components/PortalSignCanvas';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  CeremonyEventType,
  PortalContext,
  PortalContractDocument,
  RealtimeEventMessage,
  StrokeSubmitted,
  StrokeSummary,
  TemplateFieldSummary,
} from '../types';

const DEFAULT_CONTRACT_SIZE = { width: 595, height: 842 };
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const POLL_INTERVAL_MS = 5000;
// 문서 이미지 로딩 실패 시 자동 재시도까지의 대기 시간(ProjectorView.tsx와 같은 이유 —
// 레이트리밋 윈도우(60초)보다 훨씬 짧게 잡아 스스로 복구되는 게 보이게 한다).
const PAGE_IMAGE_RETRY_DELAY_MS = 3000;

/** 도구모음의 구분 뱃지 색상(2026-08-27 legacy 포팅) — 어두운 배경 위라 ProjectorView.tsx보다 톤을 낮췄다. */
const SIGNER_EVENT_TYPE_META: Record<CeremonyEventType, { label: string; className: string }> = {
  TEST: { label: '테스트', className: 'border-gray-600 bg-gray-800 text-gray-100' },
  REHEARSAL: { label: '리허설', className: 'border-sky-500/50 bg-sky-500/15 text-sky-100' },
  MAIN: { label: '본행사', className: 'border-indigo-500/50 bg-indigo-500/20 text-indigo-100' },
};

// 도구모음(헤더) 숨김 여부는 이벤트+서명자 조합별로 로컬에 기억해 둔다 — legacy
// SignerView.tsx와 같은 이유(같은 서명자가 화면을 새로고침해도 방금 고른 표시 방식이
// 유지되게 하기 위해서). TTL을 두는 이유는 같은 브라우저를 다른 행사/서명자가 나중에
// 다시 쓸 수도 있어 무기한 남기지 않기 위해서다.
const TOOLBAR_SETTINGS_TTL_MS = 24 * 60 * 60 * 1000;
const TOOLBAR_SETTINGS_STORAGE_PREFIX = 'signstage.signerPortalView.settings';

interface ToolbarSettings {
  isToolbarVisible: boolean;
  savedAt: number;
}

const getToolbarSettingsStorageKey = (eventAccessKey?: string, signerAccessKey?: string) =>
  `${TOOLBAR_SETTINGS_STORAGE_PREFIX}:${eventAccessKey ?? 'unknown'}:${signerAccessKey ?? 'unknown'}`;

const readToolbarSettings = (eventAccessKey?: string, signerAccessKey?: string): ToolbarSettings | null => {
  if (!eventAccessKey || !signerAccessKey) return null;
  const storageKey = getToolbarSettingsStorageKey(eventAccessKey, signerAccessKey);

  try {
    const rawSettings = window.localStorage.getItem(storageKey);
    if (!rawSettings) return null;

    const parsed = JSON.parse(rawSettings) as Partial<ToolbarSettings>;
    const savedAt = Number(parsed.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > TOOLBAR_SETTINGS_TTL_MS) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return {
      isToolbarVisible: typeof parsed.isToolbarVisible === 'boolean' ? parsed.isToolbarVisible : false,
      savedAt,
    };
  } catch (err) {
    console.warn('Failed to read signer portal toolbar settings:', err);
    window.localStorage.removeItem(storageKey);
    return null;
  }
};

const writeToolbarSettings = (
  eventAccessKey: string | undefined,
  signerAccessKey: string | undefined,
  settings: Omit<ToolbarSettings, 'savedAt'>,
) => {
  if (!eventAccessKey || !signerAccessKey) return;

  try {
    window.localStorage.setItem(
      getToolbarSettingsStorageKey(eventAccessKey, signerAccessKey),
      JSON.stringify({ ...settings, savedAt: Date.now() }),
    );
  } catch (err) {
    console.warn('Failed to save signer portal toolbar settings:', err);
  }
};

const upsertStroke = (list: StrokeSummary[], stroke: StrokeSummary): StrokeSummary[] => {
  if (list.some((s) => s.templateFieldId === stroke.templateFieldId && s.strokeSeq === stroke.strokeSeq)) return list;
  return [...list, stroke];
};
const removeStrokesForField = (list: StrokeSummary[], templateFieldId: number) => list.filter((s) => s.templateFieldId !== templateFieldId);
const removeStrokesForSigner = (list: StrokeSummary[], signerId: number) => list.filter((s) => s.signerId !== signerId);
const mergeStrokes = (current: StrokeSummary[], incoming: StrokeSummary[]) => incoming.reduce(upsertStroke, current);

/**
 * `PortalSignCanvas`(legacy `SignCanvas.tsx`를 그대로 포팅)는 legacy 관례대로 한 획을 flat
 * `[x0,y0,x1,y1,...]` 배열로 다룬다. 하지만 `StrokeData.rawData`(우리 백엔드/`MappedDocumentPreview`/
 * `ProjectorView` 전부가 따르는 계약, `SignaturePad.tsx` 때부터의 관례)는 좌표쌍 배열
 * `[[x,y],...]` 이다 — 서버에 보내기 직전에 여기서 변환해야 한다. 이 변환을 빠뜨리면 스트로크
 * 자체는 (그 순간 로컬 상태로) 그려진 것처럼 보이지만, 저장된 rawData를 다시 읽어 그리는
 * 다른 화면(전시용 화면/행사제어)에서는 `[x,y]` 구조분해가 깨져 조용히 무시된다 — 서명자
 * 본인 눈에는 성공한 것처럼 보이는데 다른 화면에는 실시간으로 반영되지 않는 버그가 이래서
 * 생겼었다.
 */
const toPointPairs = (flatPoints: number[]): [number, number][] => {
  const pairs: [number, number][] = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    pairs.push([flatPoints[i], flatPoints[i + 1]]);
  }
  return pairs;
};

/**
 * 서명자 포털(공개, JWT 없음) — `/portal/:eventAccessKey/:signerAccessKey`. legacy
 * (~/Works/eform/source/signstage/signstage-frontend) `SignerView.tsx`(871줄)와 기능적으로
 * 동일하게 다시 만들었다 — 이전 버전(서명란마다 독립된 빈 서명 패드 목록만 보여주던 화면)을
 * 대체한다.
 *
 * 핵심 UX: 서명용(CONTRACT) 문서 전체를 배경 이미지로 깔고 그 위에 모든 서명란(본인 것은
 * 빨간 실선, 남의 것은 회색 점선)을 오버레이로 겹쳐 보여준다. 본인 서명란을 클릭하면 모달이
 * 뜨고, 거기서 그린 뒤 "확인"을 누르면 저장된다. 문서 확대/축소(75~200%), 여러 페이지 이동,
 * 실시간으로 다른 서명자의 서명도 함께 보여주는 것까지 legacy와 같다.
 *
 * legacy `SignerView.tsx`처럼 이벤트가 STARTED인 동안은 이미 서명을 마친 서명란도 몇 번이든
 * 다시 클릭해 새로 그릴 수 있다 — legacy 백엔드(`SignerPortalController#replaceAndCompleteEventSignature`)
 * 가 완료 여부를 아예 검사하지 않고 매번 무조건 교체+재완료 로그를 남기는 것과 같다. 이
 * 화면은 별도의 "완료" 종료 화면으로 전환하지 않는다 — 완료돼도 문서 화면에 그대로 머물고,
 * 서명란은 그저 다 채워진 상태(노란 강조 없이 조용한 모습)로 보일 뿐이다("서명이
 * 저장되었습니다" 토스트가 유일한 완료 신호, legacy와 같다). FINISHED로 바뀌면(행사 종료)
 * 그때부터 문서 전체가 흐려지고 클릭이 막힌다 — 그 전까지는 언제든 다시 서명할 수 있다.
 *
 * legacy 대비 의도적으로 다르게 둔 부분:
 * - legacy는 모달 확인 한 번으로 "CLEAR+DRAW 전체를 한 번에 교체"하는 배치 API를 쓰지만,
 *   우리 백엔드는 스트로크를 하나씩 저장하는 API만 있다(재서명이면 먼저 DELETE로 지우고
 *   순서대로 POST). 사용자 눈에 보이는 흐름(모달에서 그리고 확인 한 번)은 똑같다.
 * - legacy는 배정된 서명란에 스트로크가 하나라도 있으면 "완료"로 취급해 곧바로 완료 로그를
 *   남기지만, 우리 백엔드는 `/complete`를 별도로 명시 호출해야 한다(감사 로그/행사 종료 조건
 *   때문에 필요) — 그래서 배정된 필수 서명란을 전부 채우면 자동으로 `/complete`를 호출한다.
 *   그 호출 자체가 실패해도(예: 동시에 다른 갱신이 껴들어 타이밍이 어긋난 경우) 스트로크
 *   저장은 이미 끝난 뒤라 조용히 넘어간다 — 다음에 필수 서명란을 다시 채우면 재시도된다.
 * - legacy는 CONTRACT 문서만 다룬다(EXHIBITION은 프로젝터 전용) — 이 화면도 그대로 따른다.
 *   "완료 가능 여부" 판정은 포털 컨텍스트의 `requiredFields`를 기준으로 하는데, 이건 이제
 *   CONTRACT 필수 서명란만 담고 있다(`SignerPortalService.collectRequiredFieldsForSigner`가
 *   CONTRACT만 보도록 고쳤다 — 안 그러면 EXHIBITION의 마찬가지로 필수인 서명란을 이 화면이
 *   보여주지도 못하면서 완료 조건에는 넣어버려 영원히 완료가 안 되는 버그가 있었다).
 */
export const SignerPortalView: FC = () => {
  const { eventAccessKey, signerAccessKey } = useParams<{ eventAccessKey: string; signerAccessKey: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [context, setContext] = useState<PortalContext | null>(null);
  const [contract, setContract] = useState<PortalContractDocument | null>(null);
  const [strokes, setStrokes] = useState<StrokeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [documentZoom, setDocumentZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageImageUrl, setPageImageUrl] = useState('');
  const [pageImageError, setPageImageError] = useState(false);
  const [pageImageRetryCount, setPageImageRetryCount] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(
    () => readToolbarSettings(eventAccessKey, signerAccessKey)?.isToolbarVisible ?? false,
  );

  const [myField, setMyField] = useState<TemplateFieldSummary | null>(null);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [pendingSignatureStrokes, setPendingSignatureStrokes] = useState<number[][]>([]);
  const [signatureCanvasKey, setSignatureCanvasKey] = useState(0);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const portalBase = `/portal/events/${eventAccessKey}/signers/${signerAccessKey}`;

  useEffect(() => {
    writeToolbarSettings(eventAccessKey, signerAccessKey, { isToolbarVisible });
  }, [eventAccessKey, isToolbarVisible, signerAccessKey]);

  const fetchAll = async () => {
    const [contextRes, contractRes, strokesRes] = await Promise.all([
      api.get(portalBase),
      api.get(`${portalBase}/contract`),
      api.get(`${portalBase}/strokes`),
    ]);
    const contextData = contextRes.data as PortalContext;
    const contractData = contractRes.data as PortalContractDocument | null;
    const strokesData = strokesRes.data as StrokeSummary[];

    setContext(contextData);
    setContract(contractData);
    setStrokes(mergeStrokes([], strokesData));

    const mine = contractData?.fields.filter((f) => f.signerId === contextData.signerId) ?? [];
    if (mine.length > 0) {
      setMyField((prev) => prev ?? mine[0]);
      setCurrentPage((prev) => (prev === 0 ? mine[0].pageIndex : prev));
    }
  };

  /**
   * 도구모음의 수동 새로고침 버튼(2026-08-27 legacy 포팅) — 자동 폴링/실시간 구독과 별개로
   * 서명자가 즉시 최신 상태를 당겨오고 싶을 때 쓴다. 실패하면 스낵바로만 알리고 화면은
   * 그대로 둔다(ProjectorView.tsx와 달리 여기는 사용자가 직접 누른 조작이라 결과를 알려준다).
   */
  const handleRefresh = async () => {
    if (isRefreshing || isSubmittingSignature) return;
    setIsRefreshing(true);
    try {
      await fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : '화면을 새로고침하지 못했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchAll();
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '접속 정보를 확인할 수 없습니다.';
          setLoadError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventAccessKey, signerAccessKey]);

  // 최초 로딩 자체가 네트워크 단절 중에 실패했을 때의 자동 복구(ProjectorView.tsx와 같은
  // 이유). WebSocket 재연결(아래 effect)과 5초 폴링 폴백은 둘 다 context가 이미 있어야
  // 켜지는 조건이라, 최초 로딩이 실패하면 아무 것도 재시도되지 않고 에러 화면에 영원히
  // 머문다 — 그래서 loadError가 남아 있는 동안만 'online' 이벤트/5초 폴링으로 최초 로딩을
  // 다시 시도한다.
  useEffect(() => {
    if (!eventAccessKey || !signerAccessKey || !loadError) return;
    let cancelled = false;

    const retry = async () => {
      try {
        await fetchAll();
        if (!cancelled) setLoadError(null);
      } catch {
        // 여전히 실패 — 다음 트리거(online 이벤트/폴링)를 기다린다.
      }
    };

    window.addEventListener('online', retry);
    const interval = window.setInterval(retry, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.removeEventListener('online', retry);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventAccessKey, signerAccessKey, loadError]);

  // 실시간 구독 — 다른 서명자의 스트로크, 서명 지우기/재서명 요청, 행사 상태 변경까지 전부 받는다.
  useEffect(() => {
    if (!context?.eventId || !eventAccessKey) return;

    // 최초 연결인지 재연결인지 구분한다(ProjectorView.tsx와 같은 이유) — 최초 연결에서까지
    // fetchAll()로 캐치업하면 마운트 시 이미 불러온 것과 거의 동시에 또 불러오는 셈이라
    // 요청이 불필요하게 배로 늘고, IP당 요청 수를 제한하는 RateLimiter(포털/프로젝터/WS
    // SUBSCRIBE가 예산을 공유한다)에 부담을 더해 화면을 여는 순간 "문서 이미지를 불러오지
    // 못했습니다"가 뜰 확률을 높인다 — 놓친 이벤트를 따라잡아야 하는 건 재연결뿐이다.
    let hasConnectedOnce = false;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const client = new Client({
      brokerURL: `${wsProtocol}://${window.location.hostname}:8080/ws-signstage`,
      reconnectDelay: 5000,
      onConnect: () => {
        setIsRealtimeConnected(true);
        if (hasConnectedOnce) {
          fetchAll().catch(() => undefined);
        }
        hasConnectedOnce = true;

        client.subscribe(
          `/topic/events/${context.eventId}/state`,
          (message: IMessage) => {
            let event: RealtimeEventMessage;
            try {
              event = JSON.parse(message.body) as RealtimeEventMessage;
            } catch {
              return;
            }

            if (event.type === 'SIGNATURE_STROKE_SUBMITTED') {
              const payload = event.payload as { signerId: number; templateFieldId: number; strokeSeq: number; rawData: string };
              setStrokes((prev) =>
                upsertStroke(prev, {
                  id: Date.now(),
                  signerId: payload.signerId,
                  templateFieldId: payload.templateFieldId,
                  strokeSeq: payload.strokeSeq,
                  rawData: payload.rawData,
                  createdAt: new Date().toISOString(),
                }),
              );
            } else if (event.type === 'SIGNATURE_CLEARED') {
              const payload = event.payload as { templateFieldId: number };
              setStrokes((prev) => removeStrokesForField(prev, payload.templateFieldId));
            } else if (event.type === 'SIGNATURE_REPLACED') {
              const payload = event.payload as { signerId: number };
              setStrokes((prev) => removeStrokesForSigner(prev, payload.signerId));
              if (payload.signerId === context.signerId) {
                showSnackbar('관리자가 재서명을 요청했습니다. 다시 서명해주세요.', 'info');
              }
            } else if (event.type === 'EVENT_STATUS_CHANGED') {
              const payload = event.payload as { newStatus: PortalContext['eventStatus'] };
              setContext((prev) => (prev ? { ...prev, eventStatus: payload.newStatus } : prev));
            }
          },
          { eventAccessKey },
        );
      },
      onDisconnect: () => setIsRealtimeConnected(false),
      onWebSocketClose: () => setIsRealtimeConnected(false),
    });

    client.activate();
    return () => {
      client.deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.eventId, eventAccessKey]);

  useEffect(() => {
    if (!context?.eventId || isRealtimeConnected) return;
    const interval = window.setInterval(() => fetchAll().catch(() => undefined), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.eventId, isRealtimeConnected]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    window.addEventListener('resize', updateSize);
    const frame = window.requestAnimationFrame(updateSize);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isLoading, contract]);

  const contractInfo = {
    width: contract?.width ?? DEFAULT_CONTRACT_SIZE.width,
    height: contract?.height ?? DEFAULT_CONTRACT_SIZE.height,
    totalPages: contract?.pageCount ?? 1,
  };
  const fitScale = useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return 1;
    const padding = 16;
    const availableWidth = Math.max(1, viewportSize.width - padding);
    const availableHeight = Math.max(1, viewportSize.height - padding);
    return Math.min(availableWidth / contractInfo.width, availableHeight / contractInfo.height);
  }, [contractInfo.height, contractInfo.width, viewportSize.height, viewportSize.width]);
  const effectiveScale = fitScale * documentZoom;
  const documentSize = {
    width: Math.max(1, Math.round(contractInfo.width * effectiveScale)),
    height: Math.max(1, Math.round(contractInfo.height * effectiveScale)),
  };

  useEffect(() => {
    // contract가 없으면(문서 미매핑) 캔버스 자체를 렌더링하지 않으므로 pageImageUrl을 굳이
    // 되돌릴 필요가 없다 — effect 본문에서 곧바로 setState하면 cascading render 경고가 뜬다.
    if (!contract?.templateId) return;
    let cancelled = false;
    let objectUrl = '';

    (async () => {
      setPageImageError(false);
      try {
        const blob = await api.getBlob(`${portalBase}/contract/pages/${currentPage}`);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPageImageUrl(objectUrl);
      } catch {
        if (!cancelled) setPageImageError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.templateId, currentPage, pageImageRetryCount]);

  // 실패해도 이 화면은 서명자가 그 자리에서 계속 보고 있을 화면이라, 새로고침 없이 스스로
  // 복구되게 한다 — 레이트리밋(포털/프로젝터/WS SUBSCRIBE가 IP당 예산을 공유한다) 순간 초과나
  // 일시적 네트워크 오류로 실패해도 잠시 뒤 같은 페이지를 다시 시도하면 대개 정상으로 돌아온다.
  useEffect(() => {
    if (!pageImageError) return;
    const timeout = window.setTimeout(() => setPageImageRetryCount((count) => count + 1), PAGE_IMAGE_RETRY_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [pageImageError]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <Loader2 className="mr-2 animate-spin" /> 로딩 중...
      </div>
    );
  }

  if (loadError || !context) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-950 text-white">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm">{loadError ?? '정보를 찾을 수 없습니다.'}</p>
      </div>
    );
  }

  const fieldById = new Map((contract?.fields ?? []).map((f) => [f.id, f]));
  const myFields = (contract?.fields ?? []).filter((f) => f.signerId === context.signerId);
  const currentPageMyFields = myFields.filter((f) => f.pageIndex === currentPage);
  const maxStartPage = Math.max(0, contractInfo.totalPages - 1);

  const renderedStrokes = strokes
    .map((stroke) => {
      const field = fieldById.get(stroke.templateFieldId);
      if (!field || field.pageIndex !== currentPage) return null;
      try {
        const raw = JSON.parse(stroke.rawData) as [number, number][];
        return {
          points: raw.flatMap(([x, y]) => [field.xRatio + x * field.widthRatio, field.yRatio + y * field.heightRatio]),
          color: '#000000',
          width: 2,
        };
      } catch {
        return null;
      }
    })
    .filter((s): s is { points: number[]; color: string; width: number } => s !== null);

  const currentPageSignatureFields = (contract?.fields ?? [])
    .filter((f) => f.pageIndex === currentPage)
    .map((f) => ({
      id: f.id,
      xRatio: f.xRatio,
      yRatio: f.yRatio,
      widthRatio: f.widthRatio,
      heightRatio: f.heightRatio,
      isMine: f.signerId === context.signerId,
      isActive: myField?.id === f.id,
      isSigned: strokes.some((s) => s.templateFieldId === f.id),
      canSign: context.eventStatus === 'STARTED',
    }));

  // 서명란을 눌러야 팝업이 뜬다는 것을 사용자가 쉽게 알 수 있도록, 현재 페이지에 있는 내
  // 미서명 서명란 아래에 "여기를 눌러서 서명하세요" 콜아웃을 띄운다. 서명이 완료되면(strokes에
  // 반영되면) 자동으로 사라진다. legacy(~/Works/eform/source/signstage/signstage-frontend)
  // SignerView.tsx 포팅.
  const activeCalloutField = context.eventStatus === 'STARTED'
    ? currentPageMyFields.find((f) => !strokes.some((s) => s.templateFieldId === f.id))
    : undefined;

  const openSigningPanel = (field: TemplateFieldSummary) => {
    if (context.eventStatus !== 'STARTED') return;
    setMyField(field);
    setCurrentPage(field.pageIndex);
    setPendingSignatureStrokes([]);
    setSignatureCanvasKey((k) => k + 1);
    setIsSigningModalOpen(true);
  };

  const handleSignatureFieldClick = (fieldId: number) => {
    const field = myFields.find((f) => f.id === fieldId);
    if (!field) return;
    if (context.eventStatus !== 'STARTED') {
      showSnackbar('아직 서명식이 시작되지 않았습니다. 진행자의 안내를 기다려주세요.', 'info');
      return;
    }
    openSigningPanel(field);
  };

  const handleDrawEnd = (points: number[]) => {
    if (!myField || context.eventStatus !== 'STARTED') return;
    setPendingSignatureStrokes((prev) => [...prev, points]);
  };

  const handleClearSignature = () => {
    setPendingSignatureStrokes([]);
    setSignatureCanvasKey((k) => k + 1);
  };

  const handleCloseSigningModal = () => {
    setPendingSignatureStrokes([]);
    setSignatureCanvasKey((k) => k + 1);
    setIsSigningModalOpen(false);
  };

  const handleConfirmSignature = async () => {
    if (!myField || context.eventStatus !== 'STARTED' || pendingSignatureStrokes.length === 0) return;

    setIsSubmittingSignature(true);
    try {
      let nextStrokes = strokes;
      if (nextStrokes.some((s) => s.templateFieldId === myField.id)) {
        await api.delete(`${portalBase}/fields/${myField.id}/strokes`);
        nextStrokes = removeStrokesForField(nextStrokes, myField.id);
      }
      for (let i = 0; i < pendingSignatureStrokes.length; i += 1) {
        const rawData = JSON.stringify(toPointPairs(pendingSignatureStrokes[i]));
        const res = await api.post(`${portalBase}/strokes`, { templateFieldId: myField.id, strokeSeq: i, rawData });
        const submitted = res.data as StrokeSubmitted;
        nextStrokes = upsertStroke(nextStrokes, {
          id: submitted.id,
          signerId: context.signerId,
          templateFieldId: myField.id,
          strokeSeq: submitted.strokeSeq,
          rawData,
          createdAt: submitted.createdAt,
        });
      }
      setStrokes(nextStrokes);
      setPendingSignatureStrokes([]);
      setSignatureCanvasKey((k) => k + 1);
      setIsSigningModalOpen(false);
      showSnackbar('서명이 저장되었습니다.', 'success');

      const allRequiredSigned = context.requiredFields.every((f) => nextStrokes.some((s) => s.templateFieldId === f.templateFieldId));
      if (allRequiredSigned) {
        try {
          await api.post(`${portalBase}/complete`);
        } catch {
          // 스트로크 저장 자체는 이미 끝났다 — 완료 로그만 실패한 것이라 조용히 넘어간다
          // (다음에 필수 서명란을 다시 채우면 자동으로 재시도된다).
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      {!isToolbarVisible && (
        <button
          type="button"
          onClick={() => setIsToolbarVisible(true)}
          className="absolute right-4 top-4 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-white/75 shadow-lg backdrop-blur-md transition-colors hover:bg-black/75 hover:text-white"
          title="도구모음 보이기"
        >
          <ChevronUp size={12} />
          <span className="text-[10px] font-black tracking-wide">도구모음</span>
        </button>
      )}
      {isToolbarVisible && (
      <header className="relative shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-black sm:text-lg">{context.eventName}</h1>
            <p className="truncate text-xs font-semibold text-gray-400 sm:text-sm">
              {context.signerName}
              {context.signerAffiliation && ` | ${context.signerAffiliation}`}
              {context.signerPosition && ` | ${context.signerPosition}`}
            </p>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            {context.eventStatus === 'READY' && (
              <span className="whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-xs font-black text-white shadow-lg">
                행사 시작 대기 중
              </span>
            )}
            {context.eventStatus === 'STARTED' && (
              <span className="whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-500/90 px-4 py-1.5 text-xs font-black text-white shadow-lg">
                행사가 시작되었습니다
              </span>
            )}
            {context.eventStatus === 'FINISHED' && (
              <span className="whitespace-nowrap rounded-full border border-red-500/30 bg-red-600/80 px-4 py-1.5 text-xs font-black text-white shadow-lg">
                행사가 종료되었습니다
              </span>
            )}
            {context.eventStatus === 'FORCE_FINISHED' && (
              <span className="whitespace-nowrap rounded-full border border-red-500/30 bg-red-600/80 px-4 py-1.5 text-xs font-black text-white shadow-lg">
                행사가 강제종료되었습니다
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-black ${SIGNER_EVENT_TYPE_META[context.eventType].className}`}>
              {SIGNER_EVENT_TYPE_META[context.eventType].label}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isSubmittingSignature}
              className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-950/40 px-2.5 py-1.5 text-xs font-black text-gray-200 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-wait disabled:opacity-50"
              title="서명자 화면 새로고침"
            >
              {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              새로고침
            </button>
            {contractInfo.totalPages > 1 && (
              <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-950/40 p-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage <= 0}
                  className="rounded-md px-2 py-1.5 text-xs font-black text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  title="이전 페이지"
                >
                  이전
                </button>
                <span className="min-w-14 text-center text-xs font-black text-gray-200">
                  {currentPage + 1} / {Math.max(contractInfo.totalPages, maxStartPage + 1)}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(maxStartPage, p + 1))}
                  disabled={currentPage >= maxStartPage}
                  className="rounded-md px-2 py-1.5 text-xs font-black text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  title="다음 페이지"
                >
                  다음
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-950/40 p-1">
              <button
                type="button"
                onClick={() => setDocumentZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                disabled={documentZoom <= MIN_ZOOM}
                className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                title="서명문서 축소"
              >
                <ZoomOut size={16} />
              </button>
              <span className="min-w-12 text-center text-xs font-black text-gray-200">{Math.round(documentZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setDocumentZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                disabled={documentZoom >= MAX_ZOOM}
                className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                title="서명문서 확대"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDocumentZoom(1)}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-black text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                title="서명문서 전체 맞춤"
              >
                <Maximize2 size={14} />
                전체
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowInfo((v) => !v)}
                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                title="페이지 정보"
              >
                <Info size={18} />
              </button>
              {showInfo && (
                <div className="absolute right-0 top-full z-[100] mt-2 w-64 rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-2xl">
                  <p className="text-xs font-bold text-gray-200">
                    {currentPage + 1}페이지 / 현재 페이지 서명란 {(contract?.fields ?? []).filter((f) => f.pageIndex === currentPage).length}개 / 내
                    서명란 {currentPageMyFields.length}개
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsToolbarVisible(false)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-black text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              title="도구모음 숨기기"
            >
              <ChevronUp size={14} />
              숨기기
            </button>
          </div>
        </div>
      </header>
      )}

      <main className="relative min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        <div className="flex h-full min-h-0 flex-col items-center">
          <div ref={viewportRef} className="min-h-0 w-full flex-1 overflow-auto rounded-xl bg-gray-900/40 p-2">
            <div className="flex min-h-full min-w-full items-center justify-center">
              <div
                className={`relative overflow-hidden rounded-xl bg-white shadow-2xl ${
                  context.eventStatus === 'FINISHED' || context.eventStatus === 'FORCE_FINISHED'
                    ? 'pointer-events-none grayscale-[0.3] blur-[2px] filter'
                    : ''
                }`}
                style={{ width: `${documentSize.width}px`, height: `${documentSize.height}px` }}
              >
                {documentSize.width > 0 && contract && pageImageUrl && (
                  <PortalSignCanvas
                    width={documentSize.width}
                    height={documentSize.height}
                    backgroundImage={pageImageUrl}
                    strokes={renderedStrokes}
                    readOnly
                    scale={effectiveScale}
                    signatureFields={currentPageSignatureFields}
                    onSignatureFieldClick={handleSignatureFieldClick}
                  />
                )}
                {!contract && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                    <FileText size={32} className="opacity-30" />
                    <p className="text-xs font-bold">서명용 문서가 아직 준비되지 않았습니다.</p>
                  </div>
                )}
                {pageImageError && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-6 text-center text-xs font-bold text-red-700">
                    문서 이미지를 불러오지 못했습니다.
                  </div>
                )}
                {currentPageMyFields.length === 0 && myFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(myFields[0].pageIndex)}
                    className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-xl"
                  >
                    내 서명란은 {myFields[0].pageIndex + 1}페이지에 있습니다
                  </button>
                )}
                {activeCalloutField && documentSize.width > 0 && (
                  <div
                    className="pointer-events-none absolute z-30 flex -translate-x-1/2 flex-col items-center"
                    style={{
                      left: `${(activeCalloutField.xRatio + activeCalloutField.widthRatio / 2) * documentSize.width}px`,
                      top: `${Math.min(
                        documentSize.height - 8,
                        (activeCalloutField.yRatio + activeCalloutField.heightRatio) * documentSize.height + 8,
                      )}px`,
                    }}
                  >
                    <div className="-mb-px h-2 w-2 rotate-45 bg-orange-500" />
                    <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black text-white shadow-xl">
                      <MousePointerClick size={14} />
                      여기를 눌러서 서명하세요
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {contract && myFields.length === 0 && (
            <div className="mt-3 w-full max-w-lg shrink-0 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-center">
              <p className="text-sm font-bold text-red-100">본인에게 배정된 서명란이 없습니다.</p>
              <p className="mt-2 text-xs text-red-200/70">진행자에게 문의해주세요.</p>
            </div>
          )}
        </div>
      </main>

      {isSigningModalOpen && myField && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 text-gray-950 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-black">서명란</h2>
              <p className="mt-1 text-xs font-semibold text-gray-500">{myField.pageIndex + 1}페이지 선택된 서명란에 서명합니다.</p>
            </div>
            <div className="h-56 touch-none select-none overflow-hidden rounded-xl border border-gray-200 bg-white">
              <PortalSignCanvas
                key={signatureCanvasKey}
                width={520}
                height={224}
                strokes={pendingSignatureStrokes.map((points) => ({ points, color: '#000000', width: 2 }))}
                onDrawEnd={handleDrawEnd}
                readOnly={context.eventStatus !== 'STARTED' || isSubmittingSignature}
                scale={1.5}
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseSigningModal}
                disabled={isSubmittingSignature}
                className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 disabled:text-gray-400"
              >
                닫기
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearSignature}
                  disabled={pendingSignatureStrokes.length === 0 || isSubmittingSignature}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 disabled:text-gray-400"
                >
                  지우기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSignature}
                  disabled={pendingSignatureStrokes.length === 0 || isSubmittingSignature || context.eventStatus !== 'STARTED'}
                  className="rounded-lg bg-orange-600 px-8 py-2 text-xs font-black text-white hover:bg-orange-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {isSubmittingSignature ? '저장 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
