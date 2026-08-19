import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Line } from 'react-konva';
import useImage from 'use-image';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Maximize,
  Maximize2,
  Minimize,
  Save,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CeremonyEventStatus, ProjectorContext, RealtimeEventMessage, StrokeSummary, TemplateFieldSummary } from '../types';

const API_BASE = '/api/projector/events';

// legacy(~/Works/eform/source/signstage/signstage-frontend) `ProjectorView.tsx`와 같은 상수.
const DEFAULT_PAGE_SIZE = { width: 1280, height: 720 };
const PAGE_RENDER_SCALE = 2;
const CONTROL_HEIGHT = 88;
const PAGE_GAP = 12;
const HORIZONTAL_MARGIN = 48;
const VERTICAL_MARGIN = 12;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const SETTINGS_TTL_MS = 24 * 60 * 60 * 1000;
const SETTINGS_STORAGE_PREFIX = 'signstage.projector.settings';
const POLL_INTERVAL_MS = 5000;

type VisiblePageCount = 1 | 2 | 3;

interface PageFrame {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ProjectorViewSettings {
  currentPage: number;
  visiblePageCount: VisiblePageCount;
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
  isToolbarVisible: boolean;
  savedAt: number;
}

const toVisiblePageCount = (value: unknown): VisiblePageCount | null => (value === 1 || value === 2 || value === 3 ? value : null);

const clampZoom = (value: unknown) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
};

const getSettingsStorageKey = (eventAccessKey?: string) => `${SETTINGS_STORAGE_PREFIX}:${eventAccessKey ?? 'unknown'}`;

const readSettings = (eventAccessKey?: string): ProjectorViewSettings | null => {
  if (!eventAccessKey) return null;
  const storageKey = getSettingsStorageKey(eventAccessKey);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ProjectorViewSettings>;
    const savedAt = Number(parsed.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > SETTINGS_TTL_MS) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    const visiblePageCount = toVisiblePageCount(parsed.visiblePageCount);
    if (!visiblePageCount) return null;

    return {
      currentPage: Math.max(0, Number(parsed.currentPage) || 0),
      visiblePageCount,
      zoom: clampZoom(parsed.zoom),
      scrollLeft: Math.max(0, Number(parsed.scrollLeft) || 0),
      scrollTop: Math.max(0, Number(parsed.scrollTop) || 0),
      isToolbarVisible: typeof parsed.isToolbarVisible === 'boolean' ? parsed.isToolbarVisible : true,
      savedAt,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
};

const writeSettings = (eventAccessKey: string | undefined, settings: Omit<ProjectorViewSettings, 'savedAt'>) => {
  if (!eventAccessKey) return;
  try {
    window.localStorage.setItem(getSettingsStorageKey(eventAccessKey), JSON.stringify({ ...settings, savedAt: Date.now() }));
  } catch {
    // 저장 공간이 꽉 찼거나 프라이빗 모드라 못 쓰는 경우 — 조용히 무시(뷰 자체는 계속 동작).
  }
};

/** 스트로크 하나를 목록에 없으면 추가한다(같은 필드+seq가 이미 있으면 중복 무시). */
const upsertStroke = (list: StrokeSummary[], stroke: StrokeSummary): StrokeSummary[] => {
  if (list.some((s) => s.templateFieldId === stroke.templateFieldId && s.strokeSeq === stroke.strokeSeq)) return list;
  return [...list, stroke];
};

/** 서명 지우기(포털의 "지우기") — 해당 서명란의 스트로크를 전부 뺀다. */
const removeStrokesForField = (list: StrokeSummary[], templateFieldId: number) =>
  list.filter((s) => s.templateFieldId !== templateFieldId);

/** 재서명 요청(운영자) — 해당 서명자가 채운 모든 서명란의 스트로크를 뺀다. */
const removeStrokesForSigner = (list: StrokeSummary[], signerId: number) => list.filter((s) => s.signerId !== signerId);

const mergeStrokes = (current: StrokeSummary[], incoming: StrokeSummary[]) => incoming.reduce(upsertStroke, current);

const ProjectorPageLayer = ({
  eventAccessKey,
  frame,
  fieldById,
  strokes,
}: {
  eventAccessKey: string;
  frame: PageFrame;
  fieldById: Map<number, TemplateFieldSummary>;
  strokes: StrokeSummary[];
}) => {
  const [img, status] = useImage(`${API_BASE}/${eventAccessKey}/pages/${frame.pageIndex}?scale=${PAGE_RENDER_SCALE}`, 'anonymous');

  return (
    <>
      <Rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill="#111827"
        stroke="#374151"
        strokeWidth={1}
        shadowColor="rgba(0,0,0,0.45)"
        shadowBlur={24}
        shadowOpacity={0.6}
      />
      {img && <KonvaImage image={img} x={frame.x} y={frame.y} width={frame.width} height={frame.height} listening={false} />}
      {!img && (
        <Text
          x={frame.x}
          y={frame.y + frame.height / 2 - 10}
          width={frame.width}
          align="center"
          fill="#ffffff"
          fontSize={16}
          fontStyle="bold"
          text={status === 'failed' ? `${frame.pageIndex + 1}페이지를 불러오지 못했습니다.` : `${frame.pageIndex + 1}페이지 로딩 중`}
        />
      )}

      {strokes.map((stroke) => {
        const field = fieldById.get(stroke.templateFieldId);
        if (!field) return null;

        let points: number[];
        try {
          const raw = JSON.parse(stroke.rawData) as [number, number][];
          points = raw.flatMap(([x, y]) => [
            frame.x + (field.xRatio + x * field.widthRatio) * frame.width,
            frame.y + (field.yRatio + y * field.heightRatio) * frame.height,
          ]);
        } catch {
          return null;
        }
        if (points.some((p) => Number.isNaN(p))) return null;

        return (
          <Line
            key={`${stroke.templateFieldId}-${stroke.strokeSeq}`}
            points={points}
            stroke="#111827"
            strokeWidth={Math.max(2, 3 * (frame.width / DEFAULT_PAGE_SIZE.width))}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        );
      })}
    </>
  );
};

/**
 * 공개 프로젝터 화면(전시용 화면, `/projector/:eventAccessKey`). legacy
 * (~/Works/eform/source/signstage/signstage-frontend) `ProjectorView.tsx`(867줄)와 기능적으로
 * 동일하게 다시 만들었다 — 이전 라운드의 "단일 페이지 뷰 + 줌 + 전체화면"으로 단순화한 버전을
 * 대체한다. `MappedDocumentPreview`(문서매핑/행사제어가 쓰는 공용 컴포넌트)는 여기서는 쓰지
 * 않는다 — 다중 페이지 동시 표시는 그 컴포넌트가 감당하는 단일 페이지 레이아웃과 근본적으로
 * 다른 배치 계산(row/column 동적 분할, 줌>1일 때 캔버스 자체가 뷰포트보다 커지는 스크롤 모드)이
 * 필요해서다.
 *
 * legacy 대비 의도적으로 다르게 둔 부분:
 * - 알림 카드 등장/퇴장 애니메이션은 framer-motion 대신 순수 CSS 트랜지션(mount/unmount)으로
 *   충분히 대체된다고 판단해 새 의존성을 추가하지 않았다.
 * - 페이지 이미지는 `/api/files/templates/{id}/pages/{n}`(고정 URL, 컨텍스트를 몰라도 접근
 *   가능) 대신 `/api/projector/events/{accessKey}/pages/{n}`을 쓴다 — 우리 백엔드는 이벤트에
 *   매핑된 전시용 문서만 accessKey로 공개하고, 존재하는지도 모르는 templateId로 직접 접근하는
 *   경로는 열어주지 않는다(그 편이 안전하다).
 * - `SIGNATURE_REPLACED`(재서명 요청) 처리를 legacy에는 없던 이벤트까지 반영해 추가했다 —
 *   우리 백엔드가 재서명 요청 시 서명자의 스트로크를 전부 지우므로, 그 사실을 프로젝터도 알아야
 *   화면이 낡은 서명을 계속 보여주지 않는다.
 */
export const ProjectorView: FC = () => {
  const { eventAccessKey } = useParams<{ eventAccessKey: string }>();
  const initialSettings = useMemo(() => readSettings(eventAccessKey), [eventAccessKey]);

  const [context, setContext] = useState<ProjectorContext | null>(null);
  const [strokes, setStrokes] = useState<StrokeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showStartedNotice, setShowStartedNotice] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState('');

  const [currentPage, setCurrentPage] = useState(() => initialSettings?.currentPage ?? 0);
  const [visiblePageCount, setVisiblePageCount] = useState<VisiblePageCount>(() => {
    if (initialSettings?.visiblePageCount) return initialSettings.visiblePageCount;
    const pages = Number(new URLSearchParams(window.location.search).get('pages'));
    return pages === 2 || pages === 3 ? pages : 1;
  });
  const [zoom, setZoom] = useState(() => initialSettings?.zoom ?? 1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(() => initialSettings?.isToolbarVisible ?? true);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredScrollRef = useRef(false);
  const scrollSaveTimeoutRef = useRef<number | null>(null);
  const settingsSaveMessageTimeoutRef = useRef<number | null>(null);
  const previousEventStatusRef = useRef<CeremonyEventStatus | null>(null);

  const exhibitionInfo = context?.exhibition
    ? {
        width: context.exhibition.width ?? DEFAULT_PAGE_SIZE.width,
        height: context.exhibition.height ?? DEFAULT_PAGE_SIZE.height,
        totalPages: context.exhibition.pageCount,
      }
    : { ...DEFAULT_PAGE_SIZE, totalPages: 0 };
  const maxStartPage = Math.max(0, exhibitionInfo.totalPages - visiblePageCount);
  const visiblePages = useMemo(
    () =>
      Array.from({ length: visiblePageCount }, (_, index) => currentPage + index).filter(
        (pageIndex) => pageIndex < exhibitionInfo.totalPages,
      ),
    [currentPage, exhibitionInfo.totalPages, visiblePageCount],
  );
  const fieldById = useMemo(
    () => new Map((context?.exhibition?.fields ?? []).map((field) => [field.id, field])),
    [context?.exhibition?.fields],
  );
  const strokesByPage = useMemo(() => {
    const map = new Map<number, StrokeSummary[]>();
    strokes.forEach((stroke) => {
      const field = fieldById.get(stroke.templateFieldId);
      if (!field) return;
      const pageStrokes = map.get(field.pageIndex) ?? [];
      pageStrokes.push(stroke);
      map.set(field.pageIndex, pageStrokes);
    });
    return map;
  }, [fieldById, strokes]);

  const pageFrames = useMemo<PageFrame[]>(() => {
    if (visiblePages.length === 0) return [];

    const availableWidth = Math.max(1, dimensions.width - HORIZONTAL_MARGIN * 2);
    const availableHeight = Math.max(1, dimensions.height - CONTROL_HEIGHT - VERTICAL_MARGIN * 2);
    const viewportX = HORIZONTAL_MARGIN;
    const viewportY = VERTICAL_MARGIN;
    const isLandscapeViewport = availableWidth >= availableHeight;
    const layoutDirection = isLandscapeViewport ? 'row' : 'column';
    const gapTotal = PAGE_GAP * Math.max(0, visiblePages.length - 1);
    const slotWidth = layoutDirection === 'row' ? Math.max(1, (availableWidth - gapTotal) / visiblePages.length) : availableWidth;
    const slotHeight = layoutDirection === 'column' ? Math.max(1, (availableHeight - gapTotal) / visiblePages.length) : availableHeight;
    const baseScale = Math.min(slotWidth / exhibitionInfo.width, slotHeight / exhibitionInfo.height);
    const scale = baseScale * zoom;
    const pageWidth = exhibitionInfo.width * scale;
    const pageHeight = exhibitionInfo.height * scale;

    return visiblePages.map((pageIndex, index) => {
      if (layoutDirection === 'row') {
        const slotX = index * (slotWidth + PAGE_GAP);
        return {
          pageIndex,
          x: viewportX + slotX + (slotWidth - pageWidth) / 2,
          y: viewportY + (availableHeight - pageHeight) / 2,
          width: pageWidth,
          height: pageHeight,
        };
      }
      const slotY = index * (slotHeight + PAGE_GAP);
      return {
        pageIndex,
        x: viewportX + (availableWidth - pageWidth) / 2,
        y: viewportY + slotY + (slotHeight - pageHeight) / 2,
        width: pageWidth,
        height: pageHeight,
      };
    });
  }, [dimensions.height, dimensions.width, exhibitionInfo.height, exhibitionInfo.width, visiblePages, zoom]);

  const stageLayout = useMemo(() => {
    if (zoom < 1 || pageFrames.length === 0) {
      return { width: dimensions.width, height: dimensions.height, frames: pageFrames };
    }

    const minX = Math.min(...pageFrames.map((frame) => frame.x));
    const minY = Math.min(...pageFrames.map((frame) => frame.y));
    const maxX = Math.max(...pageFrames.map((frame) => frame.x + frame.width));
    const maxY = Math.max(...pageFrames.map((frame) => frame.y + frame.height));
    const offsetX = Math.max(HORIZONTAL_MARGIN - minX, 0);
    const offsetY = Math.max(VERTICAL_MARGIN - minY, 0);

    return {
      width: Math.max(dimensions.width, maxX + offsetX + HORIZONTAL_MARGIN),
      height: Math.max(dimensions.height, maxY + offsetY + VERTICAL_MARGIN + CONTROL_HEIGHT),
      frames: pageFrames.map((frame) => ({ ...frame, x: frame.x + offsetX, y: frame.y + offsetY })),
    };
  }, [dimensions.height, dimensions.width, pageFrames, zoom]);

  const lastVisiblePage = Math.min(currentPage + visiblePages.length, exhibitionInfo.totalPages);
  const displayRangeLabel =
    visiblePages.length > 1 ? `${currentPage + 1}-${lastVisiblePage} / ${exhibitionInfo.totalPages}` : `${currentPage + 1} / ${exhibitionInfo.totalPages}`;

  const saveCurrentSettings = useCallback(
    (scrollLeft?: number, scrollTop?: number) => {
      const container = scrollContainerRef.current;
      writeSettings(eventAccessKey, {
        currentPage,
        visiblePageCount,
        zoom,
        scrollLeft: scrollLeft ?? container?.scrollLeft ?? 0,
        scrollTop: scrollTop ?? container?.scrollTop ?? 0,
        isToolbarVisible,
      });
    },
    [currentPage, eventAccessKey, isToolbarVisible, visiblePageCount, zoom],
  );

  const handleScroll = useCallback(() => {
    if (!hasRestoredScrollRef.current) return;
    if (scrollSaveTimeoutRef.current != null) window.clearTimeout(scrollSaveTimeoutRef.current);
    scrollSaveTimeoutRef.current = window.setTimeout(() => saveCurrentSettings(), 150);
  }, [saveCurrentSettings]);

  const handleSaveSettings = useCallback(() => {
    saveCurrentSettings();
    setSettingsSaveMessage('위치 저장됨');
    if (settingsSaveMessageTimeoutRef.current != null) window.clearTimeout(settingsSaveMessageTimeoutRef.current);
    settingsSaveMessageTimeoutRef.current = window.setTimeout(() => setSettingsSaveMessage(''), 1800);
  }, [saveCurrentSettings]);

  const fetchContext = useCallback(async () => {
    if (!eventAccessKey) return;
    const res = await fetch(`${API_BASE}/${eventAccessKey}`).then((r) => r.json());
    if (res.code !== 'SUCCESS') {
      setError(res.message ?? '행사 정보를 불러오지 못했습니다.');
      return;
    }
    const data = res.data as ProjectorContext;
    setContext(data);
    if (data.exhibition) {
      setCurrentPage((page) => Math.min(page, Math.max(0, data.exhibition!.pageCount - visiblePageCount)));
    }
  }, [eventAccessKey, visiblePageCount]);

  const fetchStrokes = useCallback(async () => {
    if (!eventAccessKey) return;
    const res = await fetch(`${API_BASE}/${eventAccessKey}/strokes`).then((r) => r.json());
    if (res.code === 'SUCCESS') {
      setStrokes(mergeStrokes([], res.data as StrokeSummary[]));
    }
  }, [eventAccessKey]);

  useEffect(() => {
    if (!eventAccessKey) return;
    let cancelled = false;

    (async () => {
      try {
        await Promise.all([fetchContext(), fetchStrokes()]);
      } catch {
        if (!cancelled) setError('행사 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventAccessKey]);

  // WebSocket 실시간 구독 — 스트로크/서명지우기/재서명/상태변경을 전부 받는다.
  useEffect(() => {
    if (!context?.eventId || !eventAccessKey) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const client = new Client({
      brokerURL: `${wsProtocol}://${window.location.hostname}:8080/ws-signstage`,
      reconnectDelay: 5000,
      onConnect: () => {
        setIsRealtimeConnected(true);
        // 재연결 시 끊긴 동안 놓친 이벤트를 따라잡는다(legacy `onReconnect: fetchData`와 같은 목적).
        fetchContext().catch(() => undefined);
        fetchStrokes().catch(() => undefined);

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
            } else if (event.type === 'EVENT_STATUS_CHANGED') {
              const payload = event.payload as { newStatus: CeremonyEventStatus };
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

  // 실시간 연결이 끊겼을 때의 폴백 — 5초마다 스트로크/상태를 다시 읽는다.
  useEffect(() => {
    if (!context?.eventId || isRealtimeConnected) return;
    const interval = window.setInterval(() => {
      fetchStrokes().catch(() => undefined);
      fetchContext().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [context?.eventId, isRealtimeConnected, fetchContext, fetchStrokes]);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(
    () => () => {
      if (scrollSaveTimeoutRef.current != null) window.clearTimeout(scrollSaveTimeoutRef.current);
      if (settingsSaveMessageTimeoutRef.current != null) window.clearTimeout(settingsSaveMessageTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (hasRestoredScrollRef.current) return;
    if (isLoading) return;
    if (!initialSettings) {
      hasRestoredScrollRef.current = true;
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) return;

    const frame = window.requestAnimationFrame(() => {
      container.scrollLeft = initialSettings.scrollLeft;
      container.scrollTop = initialSettings.scrollTop;
      hasRestoredScrollRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialSettings, isLoading, stageLayout.height, stageLayout.width]);

  useEffect(() => {
    if (!hasRestoredScrollRef.current) return;
    saveCurrentSettings();
  }, [saveCurrentSettings]);

  useEffect(() => {
    const previousStatus = previousEventStatusRef.current;
    const currentStatus = context?.eventStatus ?? null;
    previousEventStatusRef.current = currentStatus;

    if (currentStatus !== 'STARTED' || previousStatus !== 'READY') {
      setShowStartedNotice(false);
      return;
    }

    setShowStartedNotice(true);
    const timeout = window.setTimeout(() => setShowStartedNotice(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [context?.eventStatus]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  };

  const goPrevious = () => setCurrentPage((page) => Math.max(0, page - visiblePageCount));
  const goNext = () => setCurrentPage((page) => Math.min(maxStartPage, page + visiblePageCount));
  const changeVisiblePageCount = (count: VisiblePageCount) => {
    setVisiblePageCount(count);
    setCurrentPage((page) => Math.min(page, Math.max(0, exhibitionInfo.totalPages - count)));
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="animate-spin mr-2" /> 로딩 중...
      </div>
    );
  }

  if (error || !context) {
    return <div className="w-screen h-screen bg-black flex items-center justify-center text-white">{error ?? '행사를 찾을 수 없습니다.'}</div>;
  }

  const notice =
    context.eventStatus === 'READY'
      ? { message: '행사 시작 대기 중', className: 'border-white/15 bg-black/70 text-white' }
      : context.eventStatus === 'FINISHED'
        ? { message: '행사가 종료되었습니다', className: 'border-red-300/40 bg-red-600/90 text-white' }
        : context.eventStatus === 'STARTED' && showStartedNotice
          ? { message: '행사가 시작되었습니다', className: 'border-emerald-300/40 bg-emerald-500/90 text-white' }
          : null;

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      {notice && (
        <div
          className={`pointer-events-none absolute left-1/2 top-1/2 z-30 w-[min(86vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border px-10 py-8 text-center shadow-[0_0_60px_rgba(0,0,0,0.45)] backdrop-blur-md transition-opacity duration-300 ${notice.className}`}
        >
          <div className="truncate text-2xl font-black">{context.eventName}</div>
          <div className="mt-3 text-5xl font-black leading-tight">{notice.message}</div>
        </div>
      )}

      <div className={`absolute inset-0 transition-[filter,opacity] duration-500 ${context.eventStatus === 'FINISHED' ? 'blur-[2px] brightness-75' : ''}`}>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className={`h-full w-full overscroll-contain ${zoom >= 1 ? 'overflow-auto' : 'overflow-hidden'}`}
        >
          <Stage width={stageLayout.width} height={stageLayout.height}>
            <Layer>
              {context.exhibition &&
                stageLayout.frames.map((frame) => (
                  <ProjectorPageLayer
                    key={frame.pageIndex}
                    eventAccessKey={eventAccessKey!}
                    frame={frame}
                    fieldById={fieldById}
                    strokes={strokesByPage.get(frame.pageIndex) ?? []}
                  />
                ))}
              {!context.exhibition && (
                <Text
                  x={0}
                  y={stageLayout.height / 2 - 14}
                  width={stageLayout.width}
                  align="center"
                  fill="#ffffff"
                  fontSize={20}
                  fontStyle="bold"
                  text="전시용 문서가 설정되지 않았습니다."
                />
              )}
            </Layer>
          </Stage>
        </div>
      </div>

      {!isToolbarVisible && (
        <button
          type="button"
          onClick={() => setIsToolbarVisible(true)}
          className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-white/70 shadow-lg backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
          title="도구모음 보이기"
        >
          <ChevronUp size={12} />
          <span className="text-[10px] font-black tracking-wide">도구모음</span>
        </button>
      )}

      {isToolbarVisible && (
        <div className="absolute bottom-4 left-4 right-4 z-40 flex min-h-16 flex-nowrap items-center justify-center gap-2 overflow-x-auto rounded-xl border border-white/10 bg-black/65 px-3 py-3 text-white shadow-2xl backdrop-blur-md">
          {context.eventStatus === 'STARTED' && (
            <div className="flex h-9 min-w-20 shrink-0 items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-500/90 px-3 text-xs font-black text-white shadow-lg">
              행사중
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goPrevious}
              disabled={currentPage === 0}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-black transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft size={16} />
              이전
            </button>
            <span className="min-w-20 text-center text-xs font-black text-white/85">{displayRangeLabel}</span>
            <button
              type="button"
              onClick={goNext}
              disabled={currentPage >= maxStartPage}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-black transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
            >
              다음
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="h-6 w-px shrink-0 bg-white/15" />

          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 p-1">
            {([1, 2, 3] as VisiblePageCount[]).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => changeVisiblePageCount(count)}
                className={`rounded-md px-3 py-1.5 text-xs font-black transition-colors ${
                  visiblePageCount === count ? 'bg-white text-gray-950' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                {count}장
              </button>
            ))}
          </div>

          <div className="h-6 w-px shrink-0 bg-white/15" />

          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - ZOOM_STEP).toFixed(2))))}
              disabled={zoom <= MIN_ZOOM}
              className="rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              title="축소"
            >
              <ZoomOut size={16} />
            </button>
            <span className="min-w-12 text-center text-xs font-black text-white/85">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2))))}
              disabled={zoom >= MAX_ZOOM}
              className="rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              title="확대"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-black text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              title="전체 맞춤"
            >
              <Maximize2 size={14} />
              전체
            </button>
          </div>

          <div className="h-6 w-px shrink-0 bg-white/15" />

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-white/20"
            title={isFullscreen ? '전체화면 해제' : '전체화면 시작'}
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            {isFullscreen ? '창 모드' : '전체화면'}
          </button>

          <div className="h-6 w-px shrink-0 bg-white/15" />

          <button
            type="button"
            onClick={handleSaveSettings}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-black text-gray-950 transition-colors hover:bg-white/85"
            title="현재 화면 설정 저장"
          >
            <Save size={15} />
            설정 저장
          </button>
          {settingsSaveMessage && <span className="min-w-16 shrink-0 text-center text-xs font-black text-emerald-300">{settingsSaveMessage}</span>}

          <div className="h-6 w-px shrink-0 bg-white/15" />

          <button
            type="button"
            onClick={() => setIsToolbarVisible(false)}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-white/20"
            title="도구모음 숨기기"
          >
            <ChevronDown size={15} />
            숨기기
          </button>
        </div>
      )}
    </div>
  );
};
