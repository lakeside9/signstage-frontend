import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import {
  ArrowLeft,
  History,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  PlayCircle,
  Radio,
  RotateCcw,
  Sparkles,
  SquareCheckBig,
} from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  CeremonyEventLogSummary,
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyEventType,
  CeremonyTemplateSummary,
  OptionalFeatureSummary,
  RealtimeEventMessage,
  SignerSummary,
  TemplateDocumentRole,
  TemplateSummary,
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

const EVENT_TYPE_LABEL: Record<CeremonyEventType, string> = { TEST: '테스트', MAIN: '본행사' };

const EVENT_ACTION_LABEL: Record<string, string> = {
  START_EVENT: '시작',
  FINISH_EVENT: '종료',
  SIGNATURE_COMPLETE: '서명 완료',
  SIGNATURE_CLEAR: '서명 지우기',
  SIGNATURE_REPLACE: '재서명 요청',
  GENERATE_RESULTS: '결과물 생성',
};

const DOCUMENT_ROLE_LABEL: Record<TemplateDocumentRole, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };

/**
 * 하위 행사(CeremonyEvent) 상세. 상태 배지 + 전이 버튼(DRAFT→READY→STARTED→FINISHED, 역행
 * 없음) + 문서 매핑 + 적용 선택옵션 토글 + 재서명(REPLACE) + 감사 로그를 한 화면에 담는다.
 *
 * 5라운드부터 WebSocket(STOMP, `/topic/events/{eventId}/state`)으로 실시간 동기화한다 —
 * 구독 인가는 JWT가 아니라 이 이벤트의 `accessKey`로 한다(포털과 같은 원리, 4.5절 결정).
 * 상태 전이/서명 완료/지우기/재서명을 다른 세션에서 하면 새로고침 없이 스낵바 + 감사 로그
 * 재조회로 반영된다.
 *
 * 적용 옵션 토글은 "이 행사 마스터가 구매한 옵션 중" 이라고 제한해 보여줘야 이상적이지만,
 * 백엔드에 선택옵션 구매 이력 조회 API가 아직 없어(1라운드 시점) 전체 카탈로그를 그대로
 * 보여준다 — 구매하지 않은 옵션을 켜면 백엔드가 `OPTIONAL_FEATURE_NOT_PURCHASED`로 막고 그
 * 메시지를 그대로 스낵바에 띄운다.
 *
 * 3라운드부터 문서 매핑을 실제로 할 수 있어 READY/START 전이가 실제로 통과한다. FINISH는
 * 필수 서명자 전원이 서명자 포털(`SignerPortalView`, `/portal/:eventAccessKey/:signerAccessKey`,
 * 4라운드)에서 서명을 완료해야 통과한다 — 완료 전 시도하면 `CEREMONY_EVENT_FINISH_CONDITION_NOT_MET`.
 */
export const UserCeremonyEventDetail: FC = () => {
  const { organizationId, ceremonyId, eventId } = useParams<{
    organizationId: string;
    ceremonyId: string;
    eventId: string;
  }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [event, setEvent] = useState<CeremonyEventSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [optionalFeatures, setOptionalFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isFeaturesLoading, setIsFeaturesLoading] = useState(true);
  const [appliedFeatureIds, setAppliedFeatureIds] = useState<number[]>([]);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);

  const [logs, setLogs] = useState<CeremonyEventLogSummary[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(true);

  const [allTemplates, setAllTemplates] = useState<TemplateSummary[]>([]);
  const [mappedTemplates, setMappedTemplates] = useState<CeremonyTemplateSummary[]>([]);
  const [isMappingLoading, setIsMappingLoading] = useState(true);
  const [selectedMapTemplateId, setSelectedMapTemplateId] = useState<number | ''>('');
  const [mapDocumentRole, setMapDocumentRole] = useState<TemplateDocumentRole>('CONTRACT');
  const [isMapping, setIsMapping] = useState(false);

  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [isSignersLoading, setIsSignersLoading] = useState(true);
  const [confirmingReplaceSignerId, setConfirmingReplaceSignerId] = useState<number | null>(null);
  const [processingReplaceSignerId, setProcessingReplaceSignerId] = useState<number | null>(null);

  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const basePath = `/org/ceremonies/${organizationId}/${ceremonyId}`;

  const fetchEvent = async () => {
    const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}`);
    return response.data as CeremonyEventSummary;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchEvent();
        if (!cancelled) {
          setEvent(data);
          setAppliedFeatureIds(data.optionalFeatureIds);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '하위 행사 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate(basePath, { replace: true });
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/optional-features');
        if (!cancelled) {
          setOptionalFeatures(response.data as OptionalFeatureSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '선택옵션을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsFeaturesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLogs = async () => {
    const response = await api.get(
      `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}/logs`,
    );
    return response.data as CeremonyEventLogSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchLogs();
        if (!cancelled) {
          setLogs(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '감사 로그를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLogsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, eventId]);

  const fetchMappedTemplates = async () => {
    const response = await api.get(
      `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}/templates`,
    );
    return response.data as CeremonyTemplateSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [templatesRes, mapped] = await Promise.all([
          api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/templates`),
          fetchMappedTemplates(),
        ]);
        if (!cancelled) {
          setAllTemplates(templatesRes.data as TemplateSummary[]);
          setMappedTemplates(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '문서 매핑 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsMappingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, eventId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/signers`);
        if (!cancelled) {
          setSigners(response.data as SignerSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '서명자 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsSignersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  // WebSocket(STOMP) 실시간 동기화. event.accessKey가 있어야 구독 인가를 받으므로 이벤트
  // 로드 이후에 연결한다. `event` 객체 전체가 아니라 id/accessKey 원시값에만 의존한다 —
  // EVENT_STATUS_CHANGED 수신 시 fetchEvent()로 event를 새로 set하는데, `event` 객체 자체를
  // 의존성으로 두면 매번 재연결되는 루프가 생긴다. Vite dev 프록시는 /api만 처리해 WS는
  // 백엔드 오리진을 직접 가리킨다(개발 환경 한정 8080 고정 — 운영 환경 분리는 범위 밖).
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

            if (realtimeEvent.type === 'EVENT_STATUS_CHANGED') {
              const previousStatus = realtimeEvent.payload.previousStatus as CeremonyEventStatus;
              const newStatus = realtimeEvent.payload.newStatus as CeremonyEventStatus;
              showSnackbar(
                `상태가 ${STATUS_LABEL[previousStatus] ?? previousStatus} → ${STATUS_LABEL[newStatus] ?? newStatus}(으)로 변경되었습니다.`,
                'info',
              );
              fetchEvent()
                .then((data) => {
                  setEvent(data);
                  setAppliedFeatureIds(data.optionalFeatureIds);
                })
                .catch(() => {
                  // 실시간 알림은 왔는데 재조회만 실패한 것 — 사용자가 새로고침하면 되므로
                  // 별도 에러 처리는 하지 않는다.
                });
            } else if (realtimeEvent.type === 'SIGNATURE_COMPLETED') {
              showSnackbar(`${realtimeEvent.payload.signerName}님이 서명을 완료했습니다.`, 'info');
            } else if (realtimeEvent.type === 'SIGNATURE_CLEARED') {
              showSnackbar('서명자가 서명란을 지웠습니다.', 'info');
            } else if (realtimeEvent.type === 'SIGNATURE_REPLACED') {
              showSnackbar(`${realtimeEvent.payload.signerName}님에게 재서명을 요청했습니다.`, 'info');
            }

            fetchLogs()
              .then(setLogs)
              .catch(() => {
                // 위와 같은 이유로 무시한다.
              });
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

  const handleTransition = async (action: 'ready' | 'start' | 'finish') => {
    setIsTransitioning(true);
    try {
      const response = await api.post(
        `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}/${action}`,
      );
      setEvent(response.data as CeremonyEventSummary);
      showSnackbar('상태를 변경했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsTransitioning(false);
    }
  };

  const toggleFeature = (featureId: number) => {
    setAppliedFeatureIds((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    );
  };

  const handleSaveFeatures = async () => {
    setIsSavingFeatures(true);
    try {
      const response = await api.put(
        `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}/optional-features`,
        { optionalFeatureIds: appliedFeatureIds },
      );
      const data = response.data as CeremonyEventSummary;
      setEvent(data);
      setAppliedFeatureIds(data.optionalFeatureIds);
      showSnackbar('적용 옵션을 저장했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '적용 옵션 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const unmappedTemplates = allTemplates.filter(
    (template) => !mappedTemplates.some((mapping) => mapping.templateId === template.id),
  );

  const handleSelectMapTemplate = (templateId: number | '') => {
    setSelectedMapTemplateId(templateId);
    const template = allTemplates.find((t) => t.id === templateId);
    if (template) {
      setMapDocumentRole(template.documentRole);
    }
  };

  const handleMapTemplate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMapTemplateId) {
      showSnackbar('매핑할 문서를 선택해주세요.', 'error');
      return;
    }

    setIsMapping(true);
    try {
      await api.post(`/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}/templates`, {
        templateId: selectedMapTemplateId,
        documentRole: mapDocumentRole,
      });
      showSnackbar('문서를 매핑했습니다.', 'success');
      setSelectedMapTemplateId('');
      setMappedTemplates(await fetchMappedTemplates());
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 매핑에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsMapping(false);
    }
  };

  const handleReplaceSignature = async (signerId: number) => {
    setProcessingReplaceSignerId(signerId);
    try {
      await api.post(
        `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}/signers/${signerId}/replace-signature`,
      );
      showSnackbar('재서명을 요청했습니다. 서명자가 다시 서명해야 완료 처리됩니다.', 'success');
      setConfirmingReplaceSignerId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '재서명 요청에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingReplaceSignerId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const nextAction: { action: 'ready' | 'start' | 'finish'; label: string } | null =
    event.status === 'DRAFT'
      ? { action: 'ready', label: '시작 대기(READY)로 전이' }
      : event.status === 'READY'
        ? { action: 'start', label: '진행 시작(STARTED)' }
        : event.status === 'STARTED'
          ? { action: 'finish', label: '종료(FINISHED)' }
          : null;

  return (
    <div>
      <Link to={basePath} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        행사 상세로
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950">{event.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{EVENT_TYPE_LABEL[event.eventType]}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${isRealtimeConnected ? 'text-emerald-600' : 'text-gray-400'}`}
          >
            <Radio size={12} />
            {isRealtimeConnected ? '실시간 연결됨' : '연결 끊김'}
          </span>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLOR[event.status]}`}>
            {STATUS_LABEL[event.status]}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        <DetailRow label="장소" value={event.venue ?? '-'} />
        <DetailRow label="예정 시작" value={event.scheduledStartAt ? new Date(event.scheduledStartAt).toLocaleString('ko-KR') : '-'} />
        <DetailRow label="예정 종료" value={event.scheduledEndAt ? new Date(event.scheduledEndAt).toLocaleString('ko-KR') : '-'} />
        <DetailRow label="실제 시작" value={event.actualStartAt ? new Date(event.actualStartAt).toLocaleString('ko-KR') : '-'} />
        <DetailRow label="실제 종료" value={event.actualEndAt ? new Date(event.actualEndAt).toLocaleString('ko-KR') : '-'} />
        <DetailRow icon={<KeyRound size={14} />} label="접속 키" value={event.accessKey} mono />
      </div>

      {nextAction && (
        <div className="mt-4">
          <button
            onClick={() => handleTransition(nextAction.action)}
            disabled={isTransitioning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            <PlayCircle size={16} />
            {isTransitioning ? '처리 중...' : nextAction.label}
          </button>
          {event.status === 'STARTED' && (
            <p className="mt-1.5 text-xs text-gray-400">
              필수 서명자 전원이 서명자 포털(accessKey 접속)에서 서명을 완료해야 종료할 수 있습니다.
            </p>
          )}
        </div>
      )}

      {/* 문서 매핑 */}
      <section className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-1">
          <Link2 size={14} />
          문서 매핑
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          시작 대기(READY) 조건 — CONTRACT/EXHIBITION 문서가 각각 1개 이상 매핑돼 있어야 합니다.
        </p>
        {isMappingLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            {mappedTemplates.length === 0 ? (
              <p className="text-sm text-gray-500 mb-3">아직 매핑된 문서가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-100 mb-3">
                {mappedTemplates.map((mapping) => {
                  const template = allTemplates.find((t) => t.id === mapping.templateId);
                  return (
                    <li key={mapping.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-950">{template?.title ?? `#${mapping.templateId}`}</span>
                      <span className="text-xs text-gray-500">{DOCUMENT_ROLE_LABEL[mapping.documentRole]}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {event.status === 'DRAFT' || event.status === 'READY' ? (
              unmappedTemplates.length === 0 ? (
                <p className="text-xs text-gray-400">매핑할 수 있는(아직 안 매핑된) 문서가 없습니다. 문서 양식 관리에서 먼저 업로드해주세요.</p>
              ) : (
                <form onSubmit={handleMapTemplate} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">문서</label>
                    <select
                      value={selectedMapTemplateId}
                      onChange={(e) => handleSelectMapTemplate(e.target.value ? Number(e.target.value) : '')}
                      disabled={isMapping}
                      className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                    >
                      <option value="">선택</option>
                      {unmappedTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">문서 유형</label>
                    <select
                      value={mapDocumentRole}
                      onChange={(e) => setMapDocumentRole(e.target.value as TemplateDocumentRole)}
                      disabled={isMapping}
                      className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                    >
                      <option value="CONTRACT">계약서</option>
                      <option value="EXHIBITION">전시문서</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isMapping}
                    className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isMapping ? '매핑 중...' : '매핑'}
                  </button>
                </form>
              )
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Lock size={12} />
                시작 이후에는 문서 매핑을 바꿀 수 없습니다.
              </p>
            )}
          </>
        )}
      </section>

      {/* 적용 선택옵션 */}
      <section className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-1">
          <Sparkles size={14} />
          적용 선택옵션
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          행사 마스터가 구매하지 않은 옵션을 켜면 저장 시 오류가 발생합니다. 구매는 행사 상세 화면에서 합니다.
        </p>
        {isFeaturesLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : optionalFeatures.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 선택옵션이 없습니다.</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {optionalFeatures.map((feature) => (
                <li key={feature.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleFeature(feature.id)}
                    disabled={isSavingFeatures}
                    className="shrink-0 text-gray-950"
                  >
                    <SquareCheckBig
                      size={18}
                      className={appliedFeatureIds.includes(feature.id) ? 'text-gray-950' : 'text-gray-300'}
                    />
                  </button>
                  <span className="text-sm text-gray-950">{feature.name}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={handleSaveFeatures}
              disabled={isSavingFeatures}
              className="mt-3 px-4 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {isSavingFeatures ? '저장 중...' : '적용 옵션 저장'}
            </button>
          </>
        )}
      </section>

      {/* 재서명(관리자) */}
      {event.status === 'STARTED' && (
        <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-1">
            <RotateCcw size={14} />
            재서명 요청
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            서명자가 이 하위 행사에서 진행한 서명을 전부 초기화하고 다시 서명하게 합니다. 완료 여부와 무관하게
            가능하며, 되돌릴 수 없습니다.
          </p>
          {isSignersLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : signers.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 서명자가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {signers.map((signer) => (
                <li key={signer.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-950">{signer.name}</span>
                  {confirmingReplaceSignerId === signer.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReplaceSignature(signer.id)}
                        disabled={processingReplaceSignerId === signer.id}
                        className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setConfirmingReplaceSignerId(null)}
                        disabled={processingReplaceSignerId === signer.id}
                        className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingReplaceSignerId(signer.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
                    >
                      <RotateCcw size={12} />
                      재서명 요청
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 감사 로그 */}
      <section className="mt-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <History size={14} />
          감사 로그
        </h2>
        <ListContainer isLoading={isLogsLoading} isEmpty={logs.length === 0} emptyMessage="아직 기록된 로그가 없습니다.">
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-2">시각</th>
                <th className="text-left font-medium px-4 py-2">행위 주체</th>
                <th className="text-left font-medium px-4 py-2">행위</th>
                <th className="text-left font-medium px-4 py-2">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-gray-500">{new Date(log.createdAt).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-2 text-gray-700">{log.actorType === 'ADMIN' ? '관리자' : '서명자'} #{log.actorId}</td>
                  <td className="px-4 py-2 text-gray-950">{EVENT_ACTION_LABEL[log.eventAction] ?? log.eventAction}</td>
                  <td className="px-4 py-2 text-gray-500">{log.message ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListContainer>
      </section>
    </div>
  );
};

const DetailRow: FC<{ icon?: ReactNode; label: string; value: string; mono?: boolean }> = ({
  icon,
  label,
  value,
  mono,
}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <span className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500">
      {icon}
      {label}
    </span>
    <span className={`text-sm text-gray-950 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);
