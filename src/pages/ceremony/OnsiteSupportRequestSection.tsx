import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { CheckCircle2, Loader2, MapPin, Plus, XCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
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

/** 폭을 뺀 공통 필드 스타일 — 폭은 쓰는 자리마다 다르게 줄 수 있게 따로 뺐다(희망 일시의
 * 날짜/시간처럼 한 줄에 폭이 다른 필드 두 개를 나란히 둘 때, `inputClass`의 `w-full`이
 * 뒤에 붙는 `w-20` 등과 유틸리티 클래스 우선순위가 부딪혀 무시되는 문제가 있었다). */
const inputBaseClass =
  'px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';
const inputClass = `w-full ${inputBaseClass}`;

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
 * 행사 수정 화면(`UserCeremonyEdit`)의 "플랫폼 운영사 현장지원 요청" 탭 — signstage-docs
 * business/onsite-support-negotiation-and-billing-classification-review.md 3.2절(2026-09-12).
 * 파트너가 일시·장소를 적어 현장지원을 요청하면(REQUESTED), 플랫폼 관리자가 거리 등을 보고
 * 실제 금액을 매기고(QUOTED), 파트너가 그 금액을 수락(ACCEPTED)/거부(DECLINED)한다 — "요청 →
 * 관리자가 값을 매김 → 요청자가 수락/거부" 협상 패턴. 수락 시 만들어지는 구매는 "플랫폼
 * 이용료" 탭 총계·구매 이력에 곧바로 반영된다(구매 원장은 카테고리와 무관하게 전량 집계).
 *
 * <p>탭 라벨 "현장지원 요청" → "현장지원 출장비 요청"(2026-09-14 정정) — "고객 견적" 탭의
 * 정액 카탈로그 품목(현장지원(수도권) 등)과 이름이 겹쳐 파트너가 혼동할 수 있다는 지적으로,
 * 이 거리 기준 협상형 비용을 이미 부르던 도메인 용어 "출장비"(business/
 * ceremony-support-services-billing-review.md)를 화면 문구 전체에 반영했다 — signstage-docs
 * business/platform-admin-partner-ux-confusion-review.md 2.1절/6장 결정. 같은 날 다시
 * "플랫폼 운영사 현장지원 요청"으로 재정정 — 같은 결정 항목.
 *
 * <p>"수락" 버튼에 확인 절차 추가(2026-09-14, 같은 문서 2.2절/6장 결정) — 클릭 즉시
 * `purchase.approve()`를 타는 단방향 확정 액션인데 확인 없이 한 번의 클릭으로 끝나던
 * 것을, 같은 화면군(`CustomerQuoteSection.tsx` 삭제 확인 등)이 이미 쓰던 공용
 * `ConfirmDialog`로 통일했다 — 금액과 "되돌릴 수 없다"는 문구를 확인 팝업에 명시한다.
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

  /** "수락" 확인 팝업 대상 — id만이 아니라 요청 전체를 들고 있어야 팝업 문구에 금액을
   * 보여줄 수 있다(2026-09-14, 2.2절 결정). */
  const [acceptTarget, setAcceptTarget] = useState<CeremonyOnsiteSupportRequestSummary | null>(null);

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
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '플랫폼 운영사 현장지원 요청 목록을 불러오지 못했습니다.', 'error');
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
      showSnackbar('현장지원 출장비를 요청했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '플랫폼 운영사 현장지원 요청에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!acceptTarget) return;
    setIsSubmitting(true);
    try {
      await api.put(`${basePath}/${acceptTarget.id}/accept`, {});
      setAcceptTarget(null);
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
          일시·장소를 적어 현장지원 출장비를 요청하면 플랫폼 관리자가 거리 등을 보고 금액을 매깁니다. 견적이 도착하면 수락/거부를 선택할 수 있습니다 — 수락하면 즉시 "플랫폼 이용료"에 반영됩니다.
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
        <p className="py-12 text-center text-sm text-gray-500">등록된 플랫폼 운영사 현장지원 요청이 없습니다.</p>
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
                    <Button size="sm" onClick={() => setAcceptTarget(request)} disabled={isSubmitting}>
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

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="새 플랫폼 운영사 현장지원 요청" widthClassName="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">희망 일시</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                disabled={isSubmitting}
                className={`min-w-[160px] flex-1 ${inputBaseClass}`}
              />
              <select
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                disabled={isSubmitting}
                className={`w-24 shrink-0 ${inputBaseClass} bg-white`}
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

      <ConfirmDialog
        open={acceptTarget !== null}
        title="플랫폼 운영사 현장지원 요청 수락"
        message={
          acceptTarget
            ? `${formatCurrency(acceptTarget.quotedAmount ?? 0)}을 수락하면 즉시 "플랫폼 이용료"에 반영되며 되돌릴 수 없습니다(취소하려면 관리자에게 문의해야 합니다). 수락하시겠습니까?`
            : ''
        }
        confirmLabel="수락"
        isSubmitting={isSubmitting}
        onConfirm={handleAccept}
        onCancel={() => setAcceptTarget(null)}
      />
    </div>
  );
};
