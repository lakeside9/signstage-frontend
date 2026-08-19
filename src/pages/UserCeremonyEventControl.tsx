import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FilePlus,
  Loader2,
  Monitor,
  PackageCheck,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Square,
  Users,
  X,
} from 'lucide-react';
import { MappedDocumentPreview } from '../components/MappedDocumentPreview';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyResultSummary,
  CeremonyResultType,
  CeremonyTemplateSummary,
  RealtimeEventMessage,
  SignerSummary,
  StrokeSummary,
  TemplateFieldSummary,
} from '../types';

const STATUS_LABEL: Record<CeremonyEventStatus, string> = {
  DRAFT: '준비 중',
  READY: '시작 대기',
  STARTED: '진행 중',
  FINISHED: '종료',
};

const STATUS_COLOR: Record<CeremonyEventStatus, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  READY: 'bg-blue-50 text-blue-700 border-blue-200',
  STARTED: 'bg-amber-50 text-amber-700 border-amber-200',
  FINISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const RESULT_TYPE_LABEL: Record<CeremonyResultType, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };

const PortalQrCode: FC<{ value: string }> = ({ value }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: 176, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className="w-36 h-36 bg-gray-100 rounded-lg animate-pulse" />;
  }
  return <img src={dataUrl} alt="서명자 입장 QR 코드" className="w-36 h-36" />;
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
 * 자체를 지우고 남은 상태전이(READY→START/START→FINISH)·재서명을 이 화면으로 옮겼다
 * (DRAFT→READY 전이는 문서매핑 화면의 "행사 제어" 버튼이 이미 처리한다 — legacy도
 * 문서매핑을 마쳐야 이 화면에 들어오는 흐름과 같다). 행사 기본 정보/감사로그 섹션은 한 차례
 * 옮겨왔다가 화면이 번잡하다는 피드백으로 다시 뺐다 — 필요하면 각각 API로 직접 조회한다
 * (`GET .../events/{eventId}`, `GET .../events/{eventId}/logs`).
 *
 * "매핑된 서명자"는 legacy처럼 별도 매핑 테이블이 없어(4절 참고) CONTRACT/EXHIBITION 매핑된
 * 템플릿의 필수 서명란이 참조하는 signerId 집합으로 도출한다. 완료 여부도 별도 컬럼이
 * 없어(레거시와 같은 한계) "그 서명자의 필수 서명란 전부에 스트로크가 있는가"로 판정한다 —
 * 서명자 포털의 `completeSignature` 검증과 같은 조건이다.
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
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [confirmingReplaceSignerId, setConfirmingReplaceSignerId] = useState<number | null>(null);
  const [processingReplaceSignerId, setProcessingReplaceSignerId] = useState<number | null>(null);

  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [mappedTemplates, setMappedTemplates] = useState<CeremonyTemplateSummary[]>([]);
  const [contractFields, setContractFields] = useState<TemplateFieldSummary[]>([]);
  const [exhibitionFields, setExhibitionFields] = useState<TemplateFieldSummary[]>([]);
  const [contractPageCount, setContractPageCount] = useState(0);
  const [exhibitionPageCount, setExhibitionPageCount] = useState(0);

  const [strokes, setStrokes] = useState<StrokeSummary[]>([]);

  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [results, setResults] = useState<CeremonyResultSummary[]>([]);
  const [isGeneratingResults, setIsGeneratingResults] = useState(false);

  const basePath = `/org/ceremonies/${organizationId}/${ceremonyId}`;
  const apiBasePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}`;

  const fetchEvent = async () => {
    const response = await api.get(apiBasePath);
    return response.data as CeremonyEventSummary;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [eventData, mappedRes, signersRes, strokesRes] = await Promise.all([
          fetchEvent(),
          api.get(`${apiBasePath}/templates`),
          api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/signers`),
          api.get(`${apiBasePath}/strokes`),
        ]);
        if (cancelled) return;

        setEvent(eventData);
        setSigners(signersRes.data as SignerSummary[]);
        setStrokes(strokesRes.data as StrokeSummary[]);
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
        setIsRealtimeConnected(true);
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
            } else if (realtimeEvent.type === 'SIGNATURE_REPLACED' || realtimeEvent.type === 'EVENT_STATUS_CHANGED') {
              fetchEvent()
                .then(setEvent)
                .catch(() => {
                  // 실시간 알림은 왔는데 재조회만 실패한 것 — 새로고침하면 되므로 무시한다.
                });
            }
          },
          { eventAccessKey: event.accessKey },
        );
      },
      onWebSocketClose: () => setIsRealtimeConnected(false),
      onStompError: () => setIsRealtimeConnected(false),
    });

    client.activate();

    return () => {
      client.deactivate();
      setIsRealtimeConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, event?.accessKey]);

  useEffect(() => {
    if (!event?.actualStartAt || event.status !== 'STARTED') return;

    const start = new Date(event.actualStartAt).getTime();
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [event?.actualStartAt, event?.status]);

  const handleTransition = async (action: 'start' | 'finish') => {
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
    }
  };

  const handleReplaceSignature = async (signerId: number) => {
    setProcessingReplaceSignerId(signerId);
    try {
      await api.post(`${apiBasePath}/signers/${signerId}/replace-signature`);
      showSnackbar('재서명을 요청했습니다. 서명자가 다시 서명해야 완료 처리됩니다.', 'success');
      setConfirmingReplaceSignerId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '재서명 요청에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingReplaceSignerId(null);
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

  const copyPortalUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showSnackbar('링크를 복사했습니다.', 'success');
    } catch {
      showSnackbar('링크 복사에 실패했습니다.', 'error');
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

  // 매핑된 CONTRACT/EXHIBITION 필수 서명란이 참조하는 signerId 집합 — legacy처럼 별도
  // 매핑 테이블이 없어 필드에서 직접 도출한다(4절 결정).
  const allMappedFields = [...contractFields, ...exhibitionFields];
  const mappedSignerIds = new Set(
    allMappedFields.filter((f) => f.isRequired && f.signerId != null).map((f) => f.signerId as number),
  );
  const mappedSigners = signers.filter((s) => mappedSignerIds.has(s.id));
  const strokedFieldIds = new Set(strokes.map((s) => s.templateFieldId));
  const isSignerComplete = (signerId: number) =>
    allMappedFields
      .filter((f) => f.isRequired && f.signerId === signerId)
      .every((f) => strokedFieldIds.has(f.id));
  const completedCount = mappedSigners.filter((s) => isSignerComplete(s.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to={basePath} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-950">{event.name}</h1>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLOR[event.status]}`}>
                {STATUS_LABEL[event.status]}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${isRealtimeConnected ? 'text-emerald-600' : 'text-gray-400'}`}
              >
                <Radio size={12} />
                {isRealtimeConnected ? '실시간 연결됨' : '연결 끊김'}
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
                      completedCount === mappedSigners.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    서명 {completedCount}/{mappedSigners.length}
                  </span>
                  <button
                    onClick={() => handleTransition('finish')}
                    disabled={isTransitioning || completedCount !== mappedSigners.length}
                    title={
                      completedCount === mappedSigners.length
                        ? '행사 종료'
                        : `서명 완료 ${completedCount}/${mappedSigners.length} - 모든 서명자가 서명해야 종료할 수 있습니다.`
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm text-xs disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
                  >
                    <Square size={12} fill="currentColor" />
                    행사 종료
                  </button>
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
            onClick={() => setIsQrModalOpen(true)}
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
                {completedCount} / {mappedSigners.length}
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
                      {complete ? (
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                      )}
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
              행사 종료 후 결과 PDF를 생성하고 다운로드할 수 있습니다.
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
                    <button
                      onClick={() => handleDownloadResult(result)}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 font-bold"
                    >
                      <Download size={11} />
                      다운로드
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {event.status === 'STARTED' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                <RotateCcw size={16} className="text-indigo-500" />
                재서명 요청
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                서명자가 이 하위 행사에서 진행한 서명을 전부 초기화하고 다시 서명하게 합니다. 완료 여부와 무관하게
                가능하며, 되돌릴 수 없습니다.
              </p>
              {signers.length === 0 ? (
                <p className="text-xs text-gray-400">등록된 서명자가 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {signers.map((signer) => (
                    <li key={signer.id} className="flex items-center justify-between py-2">
                      <span className="text-xs font-bold text-gray-900">{signer.name}</span>
                      {confirmingReplaceSignerId === signer.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleReplaceSignature(signer.id)}
                            disabled={processingReplaceSignerId === signer.id}
                            className="px-2 py-1 rounded-md bg-red-600 text-white text-[10px] font-bold hover:bg-red-700 disabled:opacity-50"
                          >
                            확인
                          </button>
                          <button
                            onClick={() => setConfirmingReplaceSignerId(null)}
                            disabled={processingReplaceSignerId === signer.id}
                            className="px-2 py-1 rounded-md border border-gray-200 text-gray-600 text-[10px] font-bold hover:border-gray-400 disabled:opacity-50"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingReplaceSignerId(signer.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-600 text-[10px] font-bold hover:border-gray-400"
                        >
                          <RotateCcw size={10} />
                          재서명 요청
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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

      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">서명자 입장 포탈 — {event.name}</h2>
                <p className="text-xs text-gray-500 mt-1">QR 코드를 스캔하면 서명자 포털로 바로 이동합니다.</p>
              </div>
              <button onClick={() => setIsQrModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                <X size={22} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {mappedSigners.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-12">매핑된 서명자가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                  {mappedSigners.map((signer) => {
                    const portalUrl = `${window.location.origin}/portal/${event.accessKey}/${signer.accessKey}`;
                    return (
                      <div
                        key={signer.id}
                        className="flex flex-col items-center p-4 border border-gray-100 rounded-xl hover:shadow-md"
                      >
                        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                          <PortalQrCode value={portalUrl} />
                        </div>
                        <div className="text-sm font-bold text-gray-900">{signer.name}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => copyPortalUrl(portalUrl)}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded"
                          >
                            <Copy size={11} />
                            링크 복사
                          </button>
                          <button
                            onClick={() => window.open(portalUrl, '_blank')}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded"
                          >
                            <ExternalLink size={11} />
                            열기
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
