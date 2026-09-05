import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Eraser,
  Eye,
  FilePlus,
  Loader2,
  Monitor,
  PackageCheck,
  Play,
  QrCode,
  Square,
  Users,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MappedDocumentPreview } from '../components/MappedDocumentPreview';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { parseUtcDate } from '../utils/internationalization';
import type {
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyEventType,
  CeremonyResultSummary,
  CeremonyResultType,
  CeremonyTemplateSummary,
  RealtimeEventMessage,
  SignerCompletionStatus,
  SignerSummary,
  StrokeSummary,
  TemplateFieldSummary,
} from '../types';

const STATUS_LABEL: Record<CeremonyEventStatus, string> = {
  DRAFT: '준비 중',
  READY: '시작 대기',
  STARTED: '진행 중',
  FINISHED: '종료',
  FORCE_FINISHED: '강제종료',
};

const STATUS_COLOR: Record<CeremonyEventStatus, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  READY: 'bg-blue-50 text-blue-700 border-blue-200',
  STARTED: 'bg-amber-50 text-amber-700 border-amber-200',
  FINISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FORCE_FINISHED: 'bg-red-50 text-red-700 border-red-200',
};

const RESULT_TYPE_LABEL: Record<CeremonyResultType, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };

/** 헤더 영역 배경/뱃지 색상 — 테스트/리허설/본행사를 한눈에 구분하기 위한 것(2026-08-27 legacy 포팅). */
const EVENT_TYPE_CONTROL_META: Record<CeremonyEventType, { label: string; headerClassName: string; badgeClassName: string }> = {
  TEST: {
    label: '테스트',
    headerClassName: 'bg-gray-100 border-gray-300',
    badgeClassName: 'border-gray-300 bg-white/85 text-gray-800',
  },
  REHEARSAL: {
    label: '리허설',
    headerClassName: 'bg-sky-100 border-sky-300',
    badgeClassName: 'border-sky-300 bg-white/90 text-sky-900',
  },
  MAIN: {
    label: '본행사',
    headerClassName: 'bg-indigo-100 border-indigo-300',
    badgeClassName: 'border-indigo-300 bg-white/90 text-indigo-900',
  },
};

/**
 * 행사제어(현장 실시간 운영 콘솔). legacy(~/Works/eform/source/signstage/signstage-frontend)
 * `CeremonyControl.tsx`(sub/10/control)와 같은 모양으로 만들었다 — 실시간 모니터링(서명자
 * 현황 + 문서 라이브 미리보기 + QR 포털 + 경과시간)과 결과물 관리, 그리고 legacy가 실제로
 * 헤더에 두는 상태전이 버튼("행사 시작"/"행사 종료")까지 담당한다.
 *
 * 이전에는 별도 `UserCeremonyEventDetail.tsx`("설정" 화면)가 상태전이/문서매핑/적용옵션/
 * 재서명/로그를 담당했지만, 문서매핑은 전용 화면(`UserCeremonyEventMapping.tsx`)으로,
 * 적용옵션은 등록/수정 화면으로 이미 옮겨가 그 화면의 존재 이유가 사라졌다 — Detail 화면
 * 자체를 지우고 남은 상태전이(READY→START/START→FINISH)를 이 화면으로 옮겼다(DRAFT→READY
 * 전이는 문서매핑 화면의 "행사 제어" 버튼이 이미 처리한다 — legacy도 문서매핑을 마쳐야 이
 * 화면에 들어오는 흐름과 같다). 행사 기본 정보/감사로그 섹션, 재서명 요청 섹션은 한 차례
 * 옮겨왔다가 화면이 번잡하다는 피드백으로 다시 뺐다 — 재서명은
 * `POST .../events/{eventId}/signers/{signerId}/replace-signature`로 직접 호출할 수 있다.
 *
 * "매핑된 서명자"/완료 여부는 `GET .../events/{eventId}/signature-status`로 조회한다 —
 * `POST .../finish`가 실제로 검사하는 것과 정확히 같은 기준(감사 로그의 최신
 * SIGNATURE_COMPLETE 여부, `CeremonyEventService.isSignerSignatureComplete`)이다. 예전엔
 * 이 화면이 "서명란에 스트로크가 있는가"로 자체 근사 판정을 했는데, 서명자 포털의 자동
 * `/complete` 호출이 실패해도 스트로크는 이미 저장된 뒤라 화면엔 '완료'로 보이는 반면
 * 실제 종료 조건은 감사 로그 기준이라 어긋나는 경우가 있었다 — "서명이 완료되었으나 행사
 * 종료 시 완료되지 않은 서명자가 있다는 메시지가 뜨는" 버그였다. 이 화면과 백엔드 종료
 * 판정이 같은 데이터를 보게 해서 근본적으로 없앴다.
 *
 * 실시간 펜 궤적은 `/topic/events/{eventId}/state`의 `SIGNATURE_STROKE_SUBMITTED` 메시지를
 * 누적해서 그린다(백엔드가 "확정 이벤트만 전파"하던 정책을 뒤집었다). 화면 진입 시
 * `GET .../events/{eventId}/strokes`로 이미 그려진 획을 먼저 캐치업한다.
 */
export const UserCeremonyEventControl: FC = () => {
  const { organizationId, ceremonyId, eventId } = useParams<{
    organizationId: string;
    ceremonyId: string;
    eventId: string;
  }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [event, setEvent] = useState<CeremonyEventSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isForceFinishConfirmOpen, setIsForceFinishConfirmOpen] = useState(false);
  const [isBulkResetConfirmOpen, setIsBulkResetConfirmOpen] = useState(false);
  const [isBulkResetting, setIsBulkResetting] = useState(false);
  const [signerToReset, setSignerToReset] = useState<SignerSummary | null>(null);
  const [isSignerResetting, setIsSignerResetting] = useState(false);

  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [mappedTemplates, setMappedTemplates] = useState<CeremonyTemplateSummary[]>([]);
  const [contractFields, setContractFields] = useState<TemplateFieldSummary[]>([]);
  const [exhibitionFields, setExhibitionFields] = useState<TemplateFieldSummary[]>([]);
  const [contractPageCount, setContractPageCount] = useState(0);
  const [exhibitionPageCount, setExhibitionPageCount] = useState(0);

  const [strokes, setStrokes] = useState<StrokeSummary[]>([]);
  const [signatureStatuses, setSignatureStatuses] = useState<SignerCompletionStatus[]>([]);

  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  const [results, setResults] = useState<CeremonyResultSummary[]>([]);
  const [isGeneratingResults, setIsGeneratingResults] = useState(false);

  const basePath = `/ceremonies/${organizationId}/${ceremonyId}`;
  const apiBasePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}`;

  const fetchEvent = async () => {
    const response = await api.get(apiBasePath);
    return response.data as CeremonyEventSummary;
  };

  const fetchSignatureStatus = async () => {
    const response = await api.get(`${apiBasePath}/signature-status`);
    return response.data as SignerCompletionStatus[];
  };

  const fetchSigners = async () => {
    const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/signers`);
    return response.data as SignerSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [eventData, mappedRes, signersData, strokesRes, signatureStatusData] = await Promise.all([
          fetchEvent(),
          api.get(`${apiBasePath}/templates`),
          fetchSigners(),
          api.get(`${apiBasePath}/strokes`),
          fetchSignatureStatus(),
        ]);
        if (cancelled) return;

        setEvent(eventData);
        setSigners(signersData);
        setStrokes(strokesRes.data as StrokeSummary[]);
        setSignatureStatuses(signatureStatusData);
        const mapped = mappedRes.data as CeremonyTemplateSummary[];
        setMappedTemplates(mapped);

        const contractMapping = mapped.find((m) => m.documentRole === 'CONTRACT');
        const exhibitionMapping = mapped.find((m) => m.documentRole === 'EXHIBITION');

        if (contractMapping) {
          const [fieldsRes, infoRes] = await Promise.all([
            api.get(
              `/organizations/${organizationId}/ceremonies/${ceremonyId}/templates/${contractMapping.templateId}/fields`,
            ),
            api.get(
              `/organizations/${organizationId}/ceremonies/${ceremonyId}/templates/${contractMapping.templateId}/info`,
            ),
          ]);
          if (!cancelled) {
            setContractFields(fieldsRes.data as TemplateFieldSummary[]);
            setContractPageCount((infoRes.data as { pageCount: number }).pageCount);
          }
        }
        if (exhibitionMapping) {
          const [fieldsRes, infoRes] = await Promise.all([
            api.get(
              `/organizations/${organizationId}/ceremonies/${ceremonyId}/templates/${exhibitionMapping.templateId}/fields`,
            ),
            api.get(
              `/organizations/${organizationId}/ceremonies/${ceremonyId}/templates/${exhibitionMapping.templateId}/info`,
            ),
          ]);
          if (!cancelled) {
            setExhibitionFields(fieldsRes.data as TemplateFieldSummary[]);
            setExhibitionPageCount((infoRes.data as { pageCount: number }).pageCount);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '행사제어 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
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
  }, [organizationId, ceremonyId, eventId]);

  const fetchResults = async () => {
    const response = await api.get(`${apiBasePath}/results`);
    return response.data as CeremonyResultSummary[];
  };

  useEffect(() => {
    if (event?.status !== 'FINISHED') return;

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchResults();
        if (!cancelled) setResults(data);
      } catch {
        // 조회 실패는 조용히 넘어간다 — "결과물 생성" 버튼이 여전히 동작한다.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.status]);

  // WebSocket(STOMP) 실시간 동기화 — UserCeremonyEventDetail과 같은 연결 패턴이지만, 여기서는
  // SIGNATURE_STROKE_SUBMITTED도 처리해 실시간으로 펜 궤적을 그린다.
  useEffect(() => {
    if (!event?.id || !event.accessKey) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const client = new Client({
      brokerURL: `${wsProtocol}://${window.location.hostname}:8080/ws-signstage`,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(
          `/topic/events/${event.id}/state`,
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
            } else if (realtimeEvent.type === 'SIGNATURE_REPLACED') {
              // 관리자가 서명 초기화(개별/일괄)를 실행한 경우 — 라이브 미리보기에 남아있는
              // 이 서명자의 스트로크를 지워야 지운 서명이 화면에서도 즉시 사라진다.
              const payload = realtimeEvent.payload as { signerId: number };
              setStrokes((prev) => prev.filter((s) => s.signerId !== payload.signerId));
              fetchEvent()
                .then(setEvent)
                .catch(() => {
                  // 실시간 알림은 왔는데 재조회만 실패한 것 — 새로고침하면 되므로 무시한다.
                });
            } else if (realtimeEvent.type === 'EVENT_STATUS_CHANGED') {
              fetchEvent()
                .then(setEvent)
                .catch(() => {
                  // 실시간 알림은 왔는데 재조회만 실패한 것 — 새로고침하면 되므로 무시한다.
                });
            }

            // 완료 상태에 영향을 줄 수 있는 이벤트가 오면 행사 종료 판정과 같은 기준으로
            // 다시 조회한다 — 스트로크 존재만으로 자체 근사하지 않는다(문서 상단 주석 참고).
            if (
              realtimeEvent.type === 'SIGNATURE_COMPLETED' ||
              realtimeEvent.type === 'SIGNATURE_CLEARED' ||
              realtimeEvent.type === 'SIGNATURE_REPLACED'
            ) {
              fetchSignatureStatus()
                .then(setSignatureStatuses)
                .catch(() => {
                  // 위와 같은 이유로 무시한다.
                });
              // signers는 마운트 시 한 번만 불러온 스냅샷이라, 화면을 연 뒤 새로 등록된
              // 서명자가 있으면 여기서도 갱신해야 서명자 모니터링 목록/QR 목록에 나타난다
              // (완료 판정 자체는 signatureStatuses만으로 정확하니 버튼 활성화에는 영향 없다).
              fetchSigners()
                .then(setSigners)
                .catch(() => {
                  // 위와 같은 이유로 무시한다.
                });
            }
          },
          { eventAccessKey: event.accessKey },
        );
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, event?.accessKey]);

  useEffect(() => {
    if (!event?.actualStartAt || event.status !== 'STARTED') return;

    const start = parseUtcDate(event.actualStartAt).getTime();
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [event?.actualStartAt, event?.status]);

  const handleTransition = async (action: 'start' | 'finish' | 'force-finish') => {
    setIsTransitioning(true);
    try {
      const response = await api.post(`${apiBasePath}/${action}`);
      setEvent(response.data as CeremonyEventSummary);
      showSnackbar('상태를 변경했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsTransitioning(false);
      setIsForceFinishConfirmOpen(false);
    }
  };

  const handleBulkReset = async () => {
    setIsBulkResetting(true);
    try {
      await api.post(`${apiBasePath}/reset-signatures`);
      showSnackbar('모든 서명자의 서명을 초기화했습니다.', 'success');
      setStrokes([]);
      setSignatureStatuses(await fetchSignatureStatus());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명 일괄 초기화에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsBulkResetting(false);
      setIsBulkResetConfirmOpen(false);
    }
  };

  const handleSignatureMappingCheck = async () => {
    try {
      await api.post(`${apiBasePath}/signature-mapping-check`);
      showSnackbar('서명매핑확인을 실행했습니다. 프로젝터·서명자 화면에서 소속명이 맞는 위치에 표시되는지 확인해주세요.', 'success');
      // 새로 생긴 스트로크는 SIGNATURE_STROKE_SUBMITTED 실시간 알림으로 반영된다.
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명매핑확인에 실패했습니다.';
      showSnackbar(message, 'error');
    }
  };

  const handleResetSigner = async () => {
    if (!signerToReset) return;
    setIsSignerResetting(true);
    try {
      await api.post(`${apiBasePath}/signers/${signerToReset.id}/replace-signature`);
      showSnackbar(`${signerToReset.name}님의 서명을 초기화했습니다.`, 'success');
      setStrokes((prev) => prev.filter((s) => s.signerId !== signerToReset.id));
      setSignatureStatuses(await fetchSignatureStatus());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명 초기화에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSignerResetting(false);
      setSignerToReset(null);
    }
  };

  const handleGenerateResults = async () => {
    setIsGeneratingResults(true);
    try {
      await api.post(`${apiBasePath}/results`);
      showSnackbar('결과물을 생성했습니다.', 'success');
      setResults(await fetchResults());
    } catch (err) {
      const message = err instanceof Error ? err.message : '결과물 생성에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsGeneratingResults(false);
    }
  };

  const handleDownloadResult = async (result: CeremonyResultSummary) => {
    try {
      const blob = await api.getBlob(`${apiBasePath}/results/${result.id}/file`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.originalFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '파일 다운로드에 실패했습니다.';
      showSnackbar(message, 'error');
    }
  };

  /**
   * 다운로드 없이 새 탭에서 바로 확인 — 서버 응답의 `Content-Disposition: attachment`는
   * 브라우저가 그 URL로 직접 이동할 때만 강제 다운로드를 일으킨다. blob으로 받아 새
   * object URL을 만들어 여니 그 헤더와 무관하게 브라우저 내장 PDF 뷰어로 열린다. object URL은
   * 새 탭이 다 불러올 시간을 준 뒤 넉넉하게(60초) 정리한다 — 너무 빨리 지우면 새 탭에서 못
   * 열릴 수 있다.
   */
  const handlePreviewResult = async (result: CeremonyResultSummary) => {
    try {
      const blob = await api.getBlob(`${apiBasePath}/results/${result.id}/file`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서를 불러오지 못했습니다.';
      showSnackbar(message, 'error');
    }
  };

  if (isLoading || !event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="animate-spin mb-3" size={32} />
        행사 제어 시스템을 로드 중입니다...
      </div>
    );
  }

  // "매핑된 서명자"/완료 여부는 signature-status 응답(POST .../finish와 같은 기준)을 그대로
  // 쓴다 — 문서 상단 주석 참고. 스트로크 존재로 자체 근사하지 않는다.
  const mappedSignerIds = new Set(signatureStatuses.map((s) => s.signerId));
  const mappedSigners = signers.filter((s) => mappedSignerIds.has(s.id));
  const isSignerComplete = (signerId: number) => signatureStatuses.find((s) => s.signerId === signerId)?.completed ?? false;
  const completedCount = signatureStatuses.filter((s) => s.completed).length;
  const eventTypeMeta = EVENT_TYPE_CONTROL_META[event.eventType];

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex items-center justify-between p-4 rounded-xl border shadow-sm ${eventTypeMeta.headerClassName}`}>
        <div className="flex items-center gap-3">
          <Link to={basePath} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black ${eventTypeMeta.badgeClassName}`}>
                {eventTypeMeta.label}
              </span>
              <h1 className="text-lg font-bold text-gray-950">{event.name}</h1>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLOR[event.status]}`}>
                {STATUS_LABEL[event.status]}
              </span>

              <div className="h-4 w-px bg-gray-200 mx-1" />

              {event.status === 'READY' && (
                <button
                  onClick={() => handleTransition('start')}
                  disabled={isTransitioning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm text-xs disabled:opacity-50"
                >
                  <Play size={12} fill="currentColor" />
                  행사 시작
                </button>
              )}
              {event.status === 'STARTED' && (
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-black ${
                      completedCount === signatureStatuses.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    서명 {completedCount}/{signatureStatuses.length}
                  </span>
                  <button
                    onClick={() => handleTransition('finish')}
                    disabled={isTransitioning || completedCount !== signatureStatuses.length}
                    title={
                      completedCount === signatureStatuses.length
                        ? '행사 종료'
                        : `서명 완료 ${completedCount}/${signatureStatuses.length} - 모든 서명자가 서명해야 종료할 수 있습니다.`
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm text-xs disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
                  >
                    <Square size={12} fill="currentColor" />
                    행사 종료
                  </button>
                  {(event.eventType === 'TEST' || event.eventType === 'REHEARSAL') && (
                    <button
                      onClick={() => setIsForceFinishConfirmOpen(true)}
                      disabled={isTransitioning}
                      title="테스트 또는 리허설 행사를 서명 완료 여부와 관계없이 강제종료합니다."
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg font-bold shadow-sm text-xs disabled:opacity-50"
                    >
                      <Square size={12} />
                      강제종료
                    </button>
                  )}
                  {(event.eventType === 'TEST' || event.eventType === 'REHEARSAL') && (
                    <button
                      onClick={() => setIsBulkResetConfirmOpen(true)}
                      disabled={isTransitioning}
                      title="테스트 또는 리허설 행사의 모든 서명자 서명을 일괄 초기화합니다."
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg font-bold shadow-sm text-xs disabled:opacity-50"
                    >
                      <Eraser size={12} />
                      서명 초기화
                    </button>
                  )}
                  {(event.eventType === 'TEST' || event.eventType === 'REHEARSAL') && (
                    <button
                      onClick={handleSignatureMappingCheck}
                      disabled={isTransitioning}
                      title="테스트 또는 리허설 행사의 모든 서명란에 배정된 서명자의 소속명(5자)을 자동으로 채워, 프로젝터·서명자 화면에서 매핑이 맞는지 확인합니다. 이미 서명된 서명란은 건드리지 않습니다."
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg font-bold shadow-sm text-xs disabled:opacity-50"
                    >
                      <ClipboardCheck size={12} />
                      서명매핑확인
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">행사 실시간 제어 및 모니터링</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => window.open(`/projector/${event.accessKey}`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-indigo-500 text-gray-700 hover:text-indigo-600 rounded-lg font-bold text-xs"
          >
            <Monitor size={14} />
            전시용 화면
          </button>
          <button
            onClick={() => window.open(`${basePath}/events/${eventId}/signer-portal-qrs`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-emerald-500 text-gray-700 hover:text-emerald-600 rounded-lg font-bold text-xs"
          >
            <QrCode size={14} />
            서명자 포털 (QR)
          </button>
          <div className="h-8 w-px bg-gray-100" />
          <div className="flex flex-col items-end min-w-[80px]">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">Elapsed Time</span>
            <div className="flex items-center gap-1.5 text-lg font-mono font-bold text-gray-900 leading-none">
              <Clock size={14} className="text-indigo-500" />
              {elapsedTime}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                <Users size={16} className="text-indigo-500" />
                서명자 모니터링
              </div>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                {completedCount} / {signatureStatuses.length}
              </span>
            </div>
            <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
              {mappedSigners.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">매핑된 서명자가 없습니다.</p>
              ) : (
                mappedSigners.map((signer) => {
                  const complete = isSignerComplete(signer.id);
                  return (
                    <div key={signer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            complete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {signer.name.substring(0, 1)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{signer.name}</div>
                          <div className="text-[10px] text-gray-500">
                            {signer.affiliation ?? ''} {signer.position ?? ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.status === 'STARTED' && (
                          <button
                            type="button"
                            onClick={() => setSignerToReset(signer)}
                            title={`${signer.name}님의 서명을 초기화합니다.`}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Eraser size={14} />
                          </button>
                        )}
                        {complete ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
              <PackageCheck size={16} className="text-indigo-500" />
              결과물 관리
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              행사 종료 후 결과 PDF를 생성하고, 다운로드 전에 웹에서 먼저 확인할 수 있습니다.
            </p>
            <button
              onClick={handleGenerateResults}
              disabled={event.status !== 'FINISHED' || isGeneratingResults}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-gray-50"
            >
              <FilePlus size={14} />
              {isGeneratingResults ? '생성 중...' : 'PDF 생성'}
            </button>
            {results.length > 0 && (
              <ul className="space-y-1.5">
                {results.map((result) => (
                  <li key={result.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate">{RESULT_TYPE_LABEL[result.resultType]}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePreviewResult(result)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 font-bold"
                      >
                        <Eye size={11} />
                        미리보기
                      </button>
                      <button
                        onClick={() => handleDownloadResult(result)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 font-bold"
                      >
                        <Download size={11} />
                        다운로드
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        <div className="col-span-12 lg:col-span-9 flex flex-col gap-4">
          <MappedDocumentPreview
            label="전시용 문서 (EXHIBITION)"
            fields={exhibitionFields}
            signerNameById={new Map(signers.map((s) => [s.id, s.name]))}
            fetchPage={(pageIndex, scale) => {
              const mapping = mappedTemplates.find((m) => m.documentRole === 'EXHIBITION');
              return api.getBlob(
                `/organizations/${organizationId}/ceremonies/${ceremonyId}/templates/${mapping?.templateId}/pages/${pageIndex}?scale=${scale}`,
              );
            }}
            pageCount={exhibitionPageCount}
            strokes={strokes}
            emptyMessage="전시용 문서가 매핑되지 않았습니다."
          />
          <MappedDocumentPreview
            label="서명용 문서 (CONTRACT)"
            fields={contractFields}
            signerNameById={new Map(signers.map((s) => [s.id, s.name]))}
            fetchPage={(pageIndex, scale) => {
              const mapping = mappedTemplates.find((m) => m.documentRole === 'CONTRACT');
              return api.getBlob(
                `/organizations/${organizationId}/ceremonies/${ceremonyId}/templates/${mapping?.templateId}/pages/${pageIndex}?scale=${scale}`,
              );
            }}
            pageCount={contractPageCount}
            strokes={strokes}
            emptyMessage="서명용 문서가 매핑되지 않았습니다."
          />
        </div>
      </div>

      <ConfirmDialog
        open={isForceFinishConfirmOpen}
        title="행사 강제종료"
        message="테스트와 리허설 행사에서만 가능하며, 강제종료 후에는 서명을 수정할 수 없습니다. 강제종료하시겠습니까?"
        confirmLabel="강제종료"
        isSubmitting={isTransitioning}
        onConfirm={() => handleTransition('force-finish')}
        onCancel={() => setIsForceFinishConfirmOpen(false)}
      />
      <ConfirmDialog
        open={isBulkResetConfirmOpen}
        title="서명 일괄 초기화"
        message="모든 서명자의 서명을 초기화하시겠습니까? 초기화 후에는 복구할 수 없습니다."
        confirmLabel="초기화"
        isSubmitting={isBulkResetting}
        onConfirm={handleBulkReset}
        onCancel={() => setIsBulkResetConfirmOpen(false)}
      />
      <ConfirmDialog
        open={signerToReset != null}
        title="서명 초기화"
        message={`${signerToReset?.name ?? ''}님의 서명을 초기화하시겠습니까? 초기화 후에는 복구할 수 없습니다.`}
        confirmLabel="초기화"
        isSubmitting={isSignerResetting}
        onConfirm={handleResetSigner}
        onCancel={() => setSignerToReset(null)}
      />
    </div>
  );
};
