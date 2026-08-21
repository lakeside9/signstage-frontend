import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FC } from 'react';
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
import { resolveProjectorEffectActions } from './projectorEffects';

const API_BASE = '/api/projector/events';

// legacy(~/Works/eform/source/signstage/signstage-frontend) `ProjectorView.tsx`와 같은 상수.
const DEFAULT_PAGE_SIZE = { width: 1280, height: 720 };
const PAGE_RENDER_SCALE = 2;
const CONTROL_HEIGHT = 88;
const PAGE_GAP = 12;
const JOINED_PAGE_GAP = 6;
const HORIZONTAL_MARGIN = 48;
const VERTICAL_MARGIN = 12;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const SETTINGS_TTL_MS = 24 * 60 * 60 * 1000;
const SETTINGS_STORAGE_PREFIX = 'signstage.projector.settings';
const POLL_INTERVAL_MS = 5000;
// 페이지 이미지 로딩 실패 시 자동 재시도까지의 대기 시간 — 레이트리밋 윈도우(60초)보다 훨씬
// 짧게 잡아 "잠깐 실패했다가 스스로 복구"되는 게 보이게 한다.
const PAGE_IMAGE_RETRY_DELAY_MS = 3000;

// 서명 하이라이트(SIGNER_FIELD_ZOOM) 연출 — 총 노출 시간과, 꺼지기 직전 페이드아웃 구간.
const HIGHLIGHT_DURATION_MS = 4000;
const HIGHLIGHT_FADE_MS = 500;
// 펄스 애니메이션 재계산 주기 — 느린 "숨쉬듯" 빛나는 효과라 60fps까지는 필요 없다.
const HIGHLIGHT_TICK_MS = 60;

// 폭죽(ALL_SIGNED_FIREWORKS) 연출 — 종이 조각(confetti) 개수와 화면에 머무는 시간.
const FIREWORKS_PARTICLE_COUNT = 70;
const FIREWORKS_DURATION_MS = 5000;
const FIREWORKS_COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#facc15', '#ffffff'];

type VisiblePageCount = 1 | 2 | 3;
type PageSpacingMode = 'SPACED' | 'JOINED';

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
  pageSpacingMode: PageSpacingMode;
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
  isToolbarVisible: boolean;
  savedAt: number;
}

const toVisiblePageCount = (value: unknown): VisiblePageCount | null => (value === 1 || value === 2 || value === 3 ? value : null);

const toPageSpacingMode = (value: unknown): PageSpacingMode => (value === 'JOINED' ? 'JOINED' : 'SPACED');

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
      pageSpacingMode: toPageSpacingMode(parsed.pageSpacingMode),
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

/**
 * 서명 하이라이트(SIGNER_FIELD_ZOOM) 연출 상태 — 필드 id → 시작 시각(ms). `Map`을 새로
 * 만들지 않고 값만 바꾸면 React가 변경을 못 알아채므로, 갱신할 때는 항상 새 Map을 만든다.
 */
type FieldHighlights = Map<number, number>;

/**
 * 활성 하이라이트가 있는 동안에만 주기적으로 "지금 시각"을 갱신해 펄스 애니메이션을 재계산한다
 * — 하이라이트가 없을 땐 타이머 자체를 돌리지 않아 평소엔 렌더링 비용이 전혀 없다.
 */
const useHighlightClock = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), HIGHLIGHT_TICK_MS);
    return () => window.clearInterval(interval);
  }, [active]);
  return now;
};

interface FireworksParticle {
  id: number;
  leftPercent: number;
  delayMs: number;
  durationMs: number;
  color: string;
  size: number;
  rotateDeg: number;
}

/** 매번 새로 무작위 생성한다 — 같은 배치가 반복되면 폭죽이라기보다 슬라이드처럼 보인다. */
const createFireworksParticles = (): FireworksParticle[] =>
  Array.from({ length: FIREWORKS_PARTICLE_COUNT }, (_, id) => ({
    id,
    leftPercent: Math.random() * 100,
    delayMs: Math.random() * 700,
    durationMs: 2200 + Math.random() * 1600,
    color: FIREWORKS_COLORS[id % FIREWORKS_COLORS.length],
    size: 6 + Math.random() * 8,
    rotateDeg: Math.random() * 360,
  }));

const ProjectorPageLayer = ({
  eventAccessKey,
  frame,
  fieldById,
  fieldBySignerId,
  strokes,
  highlightedFields,
  highlightNow,
}: {
  eventAccessKey: string;
  frame: PageFrame;
  fieldById: Map<number, TemplateFieldSummary>;
  fieldBySignerId: Map<number, TemplateFieldSummary>;
  strokes: StrokeSummary[];
  /** 이 페이지에 실제로 걸려 있는 하이라이트만 걸러서 받는다(pageIndex 필터는 호출부 책임). */
  highlightedFields: { field: TemplateFieldSummary; startedAt: number }[];
  highlightNow: number;
}) => {
  // 실패해도 이 화면은 보통 행사 내내 켜져 있는 키오스크성 화면이라, 새로고침 없이도 스스로
  // 복구되게 한다 — 레이트리밋(포털/프로젝터/WS SUBSCRIBE가 IP당 예산을 공유한다) 순간 초과나
  // 일시적 네트워크 오류로 페이지 이미지 하나가 실패해도, 잠시 뒤 같은 URL을 다시 시도하면
  // 대개 정상으로 돌아온다. retryCount를 쿼리에 얹어야 useImage가 "새 URL"로 인식해 재시도한다.
  const [retryCount, setRetryCount] = useState(0);
  const imageSrc = `${API_BASE}/${eventAccessKey}/pages/${frame.pageIndex}?scale=${PAGE_RENDER_SCALE}${
    retryCount > 0 ? `&retry=${retryCount}` : ''
  }`;
  const [img, status] = useImage(imageSrc, 'anonymous');

  useEffect(() => {
    if (status !== 'failed') return;
    const timeout = window.setTimeout(() => setRetryCount((count) => count + 1), PAGE_IMAGE_RETRY_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [status]);

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
        // 스트로크는 서명자가 실제로 그린 문서(대개 CONTRACT)의 필드 id를 그대로 갖고 있다 —
        // 전시용 문서에 그 id의 필드가 없으면(별도 업로드라 필드 id가 다르다) 같은 서명자의
        // 전시용 문서 필드로 대신 그린다. legacy `ProjectorView.tsx`의
        // `fieldById.get(stroke.fieldId) ?? fieldBySignerId.get(stroke.signerId)`와 같은 방식 —
        // 획의 모양(필드 박스 기준 0~1 상대좌표)은 그대로 두고 앉힐 박스만 바꾼다.
        const field = fieldById.get(stroke.templateFieldId) ?? fieldBySignerId.get(stroke.signerId);
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

      {highlightedFields.map(({ field, startedAt }) => {
        const elapsed = highlightNow - startedAt;
        if (elapsed > HIGHLIGHT_DURATION_MS) return null;

        const remaining = HIGHLIGHT_DURATION_MS - elapsed;
        const fadeOpacity = remaining < HIGHLIGHT_FADE_MS ? remaining / HIGHLIGHT_FADE_MS : 1;
        const pulse = 0.55 + 0.45 * Math.sin(elapsed / 220);
        const scaleFactor = frame.width / DEFAULT_PAGE_SIZE.width;
        const pad = Math.max(3, 4 * scaleFactor);

        return (
          <Rect
            key={`highlight-${field.id}`}
            x={frame.x + field.xRatio * frame.width - pad}
            y={frame.y + field.yRatio * frame.height - pad}
            width={field.widthRatio * frame.width + pad * 2}
            height={field.heightRatio * frame.height + pad * 2}
            cornerRadius={6}
            stroke="#facc15"
            strokeWidth={Math.max(2, 3 * scaleFactor)}
            shadowColor="#facc15"
            shadowBlur={16 * pulse}
            shadowOpacity={0.9 * pulse * fadeOpacity}
            opacity={fadeOpacity}
            listening={false}
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
 * - 선택옵션 연출 효과(서명 하이라이트 등)는 `./projectorEffects.ts`의 레지스트리가 실시간 이벤트를
 *   `{ kind, ... }` 액션으로 바꿔주고, 이 컴포넌트는 그 액션을 상태에 반영하기만 한다 — 새 옵션의
 *   효과가 추가돼도 여기 WebSocket 구독/디스패치 코드는 그대로 두고 그 파일에만 항목을 늘리면
 *   된다. `MappedDocumentPreview`(행사 제어 화면이 씀)에는 이 효과 코드를 절대 넣지 않는다 —
 *   연출 효과는 "전시화면에만" 적용하기로 결정했다(관리자 콘솔 화면에는 안 보여야 한다).
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
  // 서명 하이라이트(SIGNER_FIELD_ZOOM) — 필드 id → 시작 시각. 다른 옵션 효과가 추가되면
  // 여기 상태도 그 효과 전용으로 하나씩 늘어난다(projectorEffects.ts의 kind별로 매핑).
  const [highlightedFields, setHighlightedFields] = useState<FieldHighlights>(new Map());
  // 폭죽(ALL_SIGNED_FIREWORKS) — null이면 꺼진 상태, 값이 있으면 그 시각에 생성된 조각들을
  // 표시 중이다. 매번 새로 생성해야 반복 재생 시 CSS 애니메이션이 재시작된다.
  const [fireworksParticles, setFireworksParticles] = useState<FireworksParticle[] | null>(null);

  const [currentPage, setCurrentPage] = useState(() => initialSettings?.currentPage ?? 0);
  const [visiblePageCount, setVisiblePageCount] = useState<VisiblePageCount>(() => {
    if (initialSettings?.visiblePageCount) return initialSettings.visiblePageCount;
    const pages = Number(new URLSearchParams(window.location.search).get('pages'));
    return pages === 2 || pages === 3 ? pages : 1;
  });
  const [zoom, setZoom] = useState(() => initialSettings?.zoom ?? 1);
  const [pageSpacingMode, setPageSpacingMode] = useState<PageSpacingMode>(() => initialSettings?.pageSpacingMode ?? 'SPACED');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(() => initialSettings?.isToolbarVisible ?? true);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredScrollRef = useRef(false);
  const scrollSaveTimeoutRef = useRef<number | null>(null);
  const settingsSaveMessageTimeoutRef = useRef<number | null>(null);
  const previousEventStatusRef = useRef<CeremonyEventStatus | null>(null);
  const fireworksTimeoutRef = useRef<number | null>(null);
  // WebSocket 구독은 eventId가 바뀔 때만 다시 걸리므로(재연결마다 끊었다 잇지 않기 위해), 메시지
  // 핸들러 안에서 최신 context(적용된 옵션 코드/전시 필드 목록)를 읽으려면 ref로 따라가야 한다 —
  // 그냥 context를 참조하면 구독 시점의 값에 클로저로 갇혀 이후 갱신을 못 본다.
  const contextRef = useRef<ProjectorContext | null>(null);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

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
  // 서명자가 CONTRACT 등 다른 문서에 그린 스트로크도 전시용 문서의 같은 서명자 필드로 대신
  // 그리기 위한 조회용 — ProjectorPageLayer의 문서 주석 참고.
  const fieldBySignerId = useMemo(() => {
    const map = new Map<number, TemplateFieldSummary>();
    (context?.exhibition?.fields ?? []).forEach((field) => {
      if (field.signerId != null && !map.has(field.signerId)) {
        map.set(field.signerId, field);
      }
    });
    return map;
  }, [context?.exhibition?.fields]);
  const strokesByPage = useMemo(() => {
    const map = new Map<number, StrokeSummary[]>();
    strokes.forEach((stroke) => {
      const field = fieldById.get(stroke.templateFieldId) ?? fieldBySignerId.get(stroke.signerId);
      if (!field) return;
      const pageStrokes = map.get(field.pageIndex) ?? [];
      pageStrokes.push(stroke);
      map.set(field.pageIndex, pageStrokes);
    });
    return map;
  }, [fieldById, fieldBySignerId, strokes]);

  const highlightNow = useHighlightClock(highlightedFields.size > 0);
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, { field: TemplateFieldSummary; startedAt: number }[]>();
    highlightedFields.forEach((startedAt, fieldId) => {
      const field = fieldById.get(fieldId);
      if (!field) return;
      const pageHighlights = map.get(field.pageIndex) ?? [];
      pageHighlights.push({ field, startedAt });
      map.set(field.pageIndex, pageHighlights);
    });
    return map;
  }, [fieldById, highlightedFields]);

  // 만료된 하이라이트를 주기적으로 걷어낸다 — ProjectorPageLayer는 만료된 항목을 그냥 안
  // 그리기만 할 뿐이라, 여기서 안 지우면 하이라이트가 누적되면서(재서명 등으로 계속 발생) 상태가
  // 무한정 커진다.
  useEffect(() => {
    if (highlightedFields.size === 0) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setHighlightedFields((prev) => {
        const next = new Map([...prev].filter(([, startedAt]) => now - startedAt <= HIGHLIGHT_DURATION_MS));
        return next.size === prev.size ? prev : next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [highlightedFields]);

  const pageFrames = useMemo<PageFrame[]>(() => {
    if (visiblePages.length === 0) return [];

    const availableWidth = Math.max(1, dimensions.width - HORIZONTAL_MARGIN * 2);
    const availableHeight = Math.max(1, dimensions.height - CONTROL_HEIGHT - VERTICAL_MARGIN * 2);
    const viewportX = HORIZONTAL_MARGIN;
    const viewportY = VERTICAL_MARGIN;
    const isLandscapeViewport = availableWidth >= availableHeight;
    const layoutDirection = isLandscapeViewport ? 'row' : 'column';

    // 붙임(JOINED) 모드는 슬롯을 나누지 않고 페이지 묶음 전체를 하나의 그룹으로 다뤄, 페이지
    // 사이에 6px 간격만 남기고 뷰포트 중앙에 배치한다 — 여백(SPACED) 모드처럼 페이지별 슬롯
    // 중앙 정렬을 하면 줌 배율에 따라 페이지 사이 간격이 늘어나 버린다.
    if (pageSpacingMode === 'JOINED') {
      const joinedGapTotal = JOINED_PAGE_GAP * Math.max(0, visiblePages.length - 1);
      const scaleAvailableWidth = layoutDirection === 'row' ? Math.max(1, availableWidth - joinedGapTotal) : availableWidth;
      const scaleAvailableHeight = layoutDirection === 'column' ? Math.max(1, availableHeight - joinedGapTotal) : availableHeight;
      const groupBaseWidth = layoutDirection === 'row' ? exhibitionInfo.width * visiblePages.length : exhibitionInfo.width;
      const groupBaseHeight = layoutDirection === 'column' ? exhibitionInfo.height * visiblePages.length : exhibitionInfo.height;
      const joinedBaseScale = Math.min(scaleAvailableWidth / groupBaseWidth, scaleAvailableHeight / groupBaseHeight);
      const joinedScale = joinedBaseScale * zoom;
      const joinedPageWidth = exhibitionInfo.width * joinedScale;
      const joinedPageHeight = exhibitionInfo.height * joinedScale;
      const groupWidth = layoutDirection === 'row' ? joinedPageWidth * visiblePages.length + joinedGapTotal : joinedPageWidth;
      const groupHeight = layoutDirection === 'column' ? joinedPageHeight * visiblePages.length + joinedGapTotal : joinedPageHeight;
      const groupX = viewportX + (availableWidth - groupWidth) / 2;
      const groupY = viewportY + (availableHeight - groupHeight) / 2;

      return visiblePages.map((pageIndex, index) => ({
        pageIndex,
        x: groupX + (layoutDirection === 'row' ? index * (joinedPageWidth + JOINED_PAGE_GAP) : 0),
        y: groupY + (layoutDirection === 'column' ? index * (joinedPageHeight + JOINED_PAGE_GAP) : 0),
        width: joinedPageWidth,
        height: joinedPageHeight,
      }));
    }

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
  }, [dimensions.height, dimensions.width, exhibitionInfo.height, exhibitionInfo.width, pageSpacingMode, visiblePages, zoom]);

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
        pageSpacingMode,
        zoom,
        scrollLeft: scrollLeft ?? container?.scrollLeft ?? 0,
        scrollTop: scrollTop ?? container?.scrollTop ?? 0,
        isToolbarVisible,
      });
    },
    [currentPage, eventAccessKey, isToolbarVisible, pageSpacingMode, visiblePageCount, zoom],
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

  // 성공하면 context를 반영하고, 실패하면(네트워크 단절/서버 오류/잘못된 accessKey 전부) 그냥
  // 던진다 — 호출부가 "최초 로딩"인지 "이미 떠 있는 화면의 백그라운드 캐치업"인지에 따라 실패를
  // 다르게 다뤄야 해서다(최초 로딩 실패는 전체 화면 에러로, 캐치업 실패는 조용히 다음 기회를
  // 기다리는 쪽으로 — 안 그러면 정상적으로 떠 있던 화면이 일시적인 캐치업 실패 한 번에 통째로
  // 에러 화면으로 바뀌어버린다).
  const fetchContext = useCallback(async () => {
    if (!eventAccessKey) return;
    const res = await fetch(`${API_BASE}/${eventAccessKey}`).then((r) => r.json());
    if (res.code !== 'SUCCESS') {
      throw new Error(res.message ?? '행사 정보를 불러오지 못했습니다.');
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

  // 최초 로딩 자체가 네트워크 단절 중에 실패했을 때의 자동 복구. WebSocket 재연결(아래
  // effect)과 5초 폴링 폴백은 둘 다 context가 이미 있어야 켜지는 조건이라, 최초 로딩이
  // 실패하면(=context가 계속 null) 아무 것도 재시도되지 않고 에러 화면에 영원히 머문다 —
  // 그래서 error가 남아 있는 동안만 별도로 'online' 이벤트(네트워크 복귀 즉시)와 5초
  // 폴링(브라우저가 online 이벤트를 놓치는 경우 대비)으로 최초 로딩을 다시 시도한다.
  useEffect(() => {
    if (!eventAccessKey || !error) return;
    let cancelled = false;

    const retry = async () => {
      try {
        await Promise.all([fetchContext(), fetchStrokes()]);
        if (!cancelled) setError(null);
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
  }, [eventAccessKey, error, fetchContext, fetchStrokes]);

  // WebSocket 실시간 구독 — 스트로크/서명지우기/재서명/상태변경을 전부 받는다.
  useEffect(() => {
    if (!context?.eventId || !eventAccessKey) return;

    // 최초 연결인지 재연결인지 구분한다 — 이 effect가 다시 걸릴 때(이벤트가 바뀌거나 컴포넌트가
    // 다시 마운트될 때)마다 새로 false로 시작한다. 최초 연결에서까지 캐치업(context/strokes
    // 재조회)을 하면, 마운트 시 이미 한 번 불러온 것과 거의 동시에 또 불러오는 셈이라 요청이
    // 불필요하게 배로 늘고, IP당 요청 수를 제한하는 RateLimiter(포털/프로젝터/WS SUBSCRIBE가
    // 예산을 공유한다)에 부담을 더해 화면을 여는 바로 그 순간(페이지 이미지 로딩과 겹치는
    // 시점)에 "N페이지를 불러오지 못했습니다"가 뜰 확률을 높였다 — 실제로 놓친 이벤트를
    // 따라잡아야 하는 건 "재"연결(끊겼다 다시 붙는 경우)뿐이다.
    let hasConnectedOnce = false;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const client = new Client({
      brokerURL: `${wsProtocol}://${window.location.hostname}:8080/ws-signstage`,
      reconnectDelay: 5000,
      onConnect: () => {
        setIsRealtimeConnected(true);
        if (hasConnectedOnce) {
          // 재연결 시 끊긴 동안 놓친 이벤트를 따라잡는다(legacy `onReconnect: fetchData`와 같은 목적).
          fetchContext().catch(() => undefined);
          fetchStrokes().catch(() => undefined);
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
            } else if (event.type === 'EVENT_STATUS_CHANGED') {
              const payload = event.payload as { newStatus: CeremonyEventStatus };
              setContext((prev) => (prev ? { ...prev, eventStatus: payload.newStatus } : prev));
            }

            // 선택옵션 연출 효과(서명 하이라이트 등) — 위 스트로크/상태 처리와 독립적으로, 이 하위
            // 행사에 적용된 옵션이 이 이벤트 타입에 반응하도록 등록돼 있으면 액션을 낸다.
            // projectorEffects.ts 문서 참고.
            const latestContext = contextRef.current;
            if (latestContext) {
              resolveProjectorEffectActions(event, latestContext.appliedOptionalFeatureCodes, {
                fields: latestContext.exhibition?.fields ?? [],
              }).forEach((action) => {
                if (action.kind === 'highlightFields') {
                  const startedAt = Date.now();
                  setHighlightedFields((prev) => {
                    const next = new Map(prev);
                    action.fieldIds.forEach((fieldId) => next.set(fieldId, startedAt));
                    return next;
                  });
                } else if (action.kind === 'fireworks') {
                  // 이미 재생 중이어도 새로 온 신호마다 다시 처음부터 재생한다 — 백엔드가
                  // "전원 완료로 막 전환된 순간"에만 정확히 한 번 보내므로 실제로 겹쳐 올
                  // 일은 없지만, 혹시 겹쳐도 재생 시간만 연장될 뿐 자연스럽다.
                  if (fireworksTimeoutRef.current != null) window.clearTimeout(fireworksTimeoutRef.current);
                  setFireworksParticles(createFireworksParticles());
                  fireworksTimeoutRef.current = window.setTimeout(() => setFireworksParticles(null), FIREWORKS_DURATION_MS);
                }
              });
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
      if (fireworksTimeoutRef.current != null) window.clearTimeout(fireworksTimeoutRef.current);
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

      {/* 폭죽(ALL_SIGNED_FIREWORKS) — 문서 좌표계와 무관한 화면 전체 연출이라 Konva Stage
          밖에, 순수 CSS 애니메이션으로 그린다. 클릭을 막지 않도록 pointer-events-none. */}
      {fireworksParticles && (
        <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
          {fireworksParticles.map((particle) => (
            <span
              key={particle.id}
              className="absolute top-[-8%] rounded-sm"
              style={
                {
                  left: `${particle.leftPercent}%`,
                  width: particle.size,
                  height: particle.size * 1.6,
                  backgroundColor: particle.color,
                  animation: `signstage-confetti-fall ${particle.durationMs}ms ${particle.delayMs}ms ease-in forwards`,
                  // CSS 커스텀 프로퍼티 — index.css의 keyframe이 조각마다 다른 시작 회전각을
                  // 쓸 수 있게 넘긴다(React CSSProperties 타입엔 없어 캐스팅 필요).
                  '--signstage-confetti-start-rotate': `${particle.rotateDeg}deg`,
                } as CSSProperties
              }
            />
          ))}
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
                    fieldBySignerId={fieldBySignerId}
                    strokes={strokesByPage.get(frame.pageIndex) ?? []}
                    highlightedFields={highlightsByPage.get(frame.pageIndex) ?? []}
                    highlightNow={highlightNow}
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
            {([
              ['SPACED', '여백'],
              ['JOINED', '붙임'],
            ] as [PageSpacingMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPageSpacingMode(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-black transition-colors ${
                  pageSpacingMode === mode ? 'bg-white text-gray-950' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
                title={mode === 'SPACED' ? '페이지 사이에 여백을 두고 표시' : '페이지 사이 여백 없이 붙여 표시'}
              >
                {label}
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
