import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { CheckCircle2, Loader2, MapPin, Plus, XCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatCurrency, formatDateTime } from '../../utils/internationalization';
import type { CeremonyOnsiteSupportRequestSummary, OnsiteSupportRequestStatus } from '../../types';

const STATUS_BADGE_CLASS: Record<OnsiteSupportRequestStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  QUOTED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABEL: Record<OnsiteSupportRequestStatus, string> = {
  REQUESTED: '견적 대기',
  QUOTED: '견적 도착',
  ACCEPTED: '수락됨',
  DECLINED: '거부됨',
};

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/** LocalDateTime 문자열("2026-09-20T10:00:00")을 "2026-09-20 10:00"으로 자른다 — 타임존 변환 없이 그대로 보여준다(UserCeremonyDetail의 formatEventDateTime과 같은 원칙, 파트너가 입력한 그대로의 벽시계 시각이라 UTC 감사 시각이 아니다). */
const formatRequestedAt = (value: string) => `${value.slice(0, 10)} ${value.slice(11, 16)}`;

/**
 * 07:00~20:00 30분 단위 시각 목록("07:00", "07:30", ..., "20:00", 27개) — 현장지원
 * 요청 가능 시간대(사용자 요청, 2026-09-12).
 */
const REQUEST_TIME_OPTIONS: string[] = Array.from({ length: 27 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

/**
 * 행사 수정 화면(`UserCeremonyEdit`)의 "현장지원 요청" 탭 — signstage-docs
 * business/onsite-support-negotiation-and-billing-classification-review.md 3.2절(2026-09-12).
 * 파트너가 일시·장소를 적어 현장지원을 요청하면(REQUESTED), 플랫폼 관리자가 거리 등을 보고
 * 실제 금액을 매기고(QUOTED), 파트너가 그 금액을 수락(ACCEPTED)/거부(DECLINED)한다 — "요청 →
 * 관리자가 값을 매김 → 요청자가 수락/거부" 협상 패턴. 수락 시 만들어지는 구매는 "플랫폼
 * 이용료" 탭 총계·구매 이력에 곧바로 반영된다(구매 원장은 카테고리와 무관하게 전량 집계).
 *
 * <p>희망 일시는 날짜(달력)와 시간(30분 단위 드롭다운, `REQUEST_TIME_OPTIONS`, 07:00~20:00)을
 * 따로 받아 합친다(사용자 요청, 2026-09-12) — `EventDateTimeInput.tsx`와 같은 원칙이지만
 * 시간대 범위가 달라(그 컴포넌트는 07:00~23:00) 재사용하지 않고 로컬에 따로 구현했다.
 */
export const OnsiteSupportRequestSection: FC<{ organizationId: string; ceremonyId: string }> = ({ organizationId, ceremonyId }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}/onsite-support-requests`;

  const [requests, setRequests] = useState<CeremonyOnsiteSupportRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [location, setLocation] = useState('');
  const [requesterNote, setRequesterNote] = useState('');

  const fetchRequests = async () => {
    const response = await api.get(basePath);
    setRequests(response.data as CeremonyOnsiteSupportRequestSummary[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(basePath);
        if (!cancelled) setRequests(response.data as CeremonyOnsiteSupportRequestSummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '현장지원 요청 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const openCreate = () => {
    setRequestedDate('');
    setRequestedTime('');
    setLocation('');
    setRequesterNote('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!requestedDate || !requestedTime || !location.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post(basePath, {
        requestedAt: `${requestedDate}T${requestedTime}:00`,
        location: location.trim(),
        requesterNote: requesterNote.trim() || undefined,
      });
      setIsCreateOpen(false);
      await fetchRequests();
      showSnackbar('현장지원을 요청했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '현장지원 요청에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async (requestId: number) => {
    setIsSubmitting(true);
    try {
      await api.put(`${basePath}/${requestId}/accept`, {});
      await fetchRequests();
      showSnackbar('견적을 수락했습니다 — 플랫폼 이용료에 반영됐습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '수락에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async (requestId: number) => {
    setIsSubmitting(true);
    try {
      await api.put(`${basePath}/${requestId}/decline`, {});
      await fetchRequests();
      showSnackbar('견적을 거부했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '거부에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          일시·장소를 적어 현장지원을 요청하면 플랫폼 관리자가 거리 등을 보고 금액을 매깁니다. 견적이 도착하면 수락/거부를 선택할 수 있습니다.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> 새 요청
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">등록된 현장지원 요청이 없습니다.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
          {requests.map((request) => (
            <div key={request.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-950 font-medium">
                  <MapPin size={14} className="text-gray-400" />
                  {request.location}
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[request.status]}`}>
                  {STATUS_LABEL[request.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">요청 일시: {formatRequestedAt(request.requestedAt)}</p>
              {request.requesterNote && <p className="mt-1 text-xs text-gray-500">{request.requesterNote}</p>}

              {request.status === 'QUOTED' && (
                <div className="mt-2 flex items-center justify-between rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-bold text-blue-900">{formatCurrency(request.quotedAmount ?? 0)}</p>
                    {request.quotedNote && <p className="mt-0.5 text-xs text-blue-700">{request.quotedNote}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleAccept(request.id)} disabled={isSubmitting}>
                      <CheckCircle2 size={12} /> 수락
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleDecline(request.id)} disabled={isSubmitting}>
                      <XCircle size={12} /> 거부
                    </Button>
                  </div>
                </div>
              )}

              {request.status === 'ACCEPTED' && request.quotedAmount !== null && (
                <p className="mt-2 text-xs text-emerald-600">
                  수락 완료 — {formatCurrency(request.quotedAmount)} (플랫폼 이용료 탭 구매 이력에서 확인할 수 있습니다)
                </p>
              )}

              {(request.quotedAt || request.respondedAt) && (
                <p className="mt-1 text-[11px] text-gray-400">
                  {request.quotedAt && `견적: ${formatDateTime(request.quotedAt)}`}
                  {request.quotedAt && request.respondedAt && ' · '}
                  {request.respondedAt && `응답: ${formatDateTime(request.respondedAt)}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="새 현장지원 요청" widthClassName="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">희망 일시</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                disabled={isSubmitting}
                className={`min-w-0 flex-1 ${inputClass}`}
              />
              <select
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                disabled={isSubmitting}
                className={`w-20 shrink-0 ${inputClass} bg-white`}
              >
                <option value="">시간</option>
                {REQUEST_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">장소</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isSubmitting}
              placeholder="예: 서울시청 다목적홀"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">요청 사항 (선택)</label>
            <textarea
              value={requesterNote}
              onChange={(e) => setRequesterNote(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm hover:border-gray-400">
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !requestedDate || !requestedTime || !location.trim()}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              {isSubmitting ? '요청 중...' : '요청'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
