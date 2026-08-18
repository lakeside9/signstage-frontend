import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, History, KeyRound, Loader2, PlayCircle, Sparkles, SquareCheckBig } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  CeremonyEventLogSummary,
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyEventType,
  OptionalFeatureSummary,
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

/**
 * 하위 행사(CeremonyEvent) 상세. 상태 배지 + 전이 버튼(DRAFT→READY→STARTED→FINISHED, 역행
 * 없음) + 적용 선택옵션 토글 + 감사 로그를 한 화면에 담는다.
 *
 * 적용 옵션 토글은 "이 행사 마스터가 구매한 옵션 중" 이라고 제한해 보여줘야 이상적이지만,
 * 백엔드에 선택옵션 구매 이력 조회 API가 아직 없어(1라운드 시점) 전체 카탈로그를 그대로
 * 보여준다 — 구매하지 않은 옵션을 켜면 백엔드가 `OPTIONAL_FEATURE_NOT_PURCHASED`로 막고 그
 * 메시지를 그대로 스낵바에 띄운다.
 *
 * 이번 라운드는 문서 매핑/서명자 배정 화면이 없어(2·3라운드) READY 전이는 항상
 * `CEREMONY_EVENT_MISSING_DOCUMENT_ROLE` 등으로 실패하는 게 정상이다 — 버튼 자체는 미리 만들어
 * 둔다.
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(
          `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}/logs`,
        );
        if (!cancelled) {
          setLogs(response.data as CeremonyEventLogSummary[]);
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
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLOR[event.status]}`}>
          {STATUS_LABEL[event.status]}
        </span>
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
          {event.status === 'DRAFT' && (
            <p className="mt-1.5 text-xs text-gray-400">
              문서 매핑/서명자 배정 기능은 아직 없습니다(다음 라운드) — 지금은 시작 대기 조건 미충족 오류가 정상입니다.
            </p>
          )}
        </div>
      )}

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
