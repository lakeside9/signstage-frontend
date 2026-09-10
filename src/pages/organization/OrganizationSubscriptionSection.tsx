import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/internationalization';
import type { BillingPlanSummary, MemberRole, OrganizationSubscriptionSummary } from '../../types';

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLATION_REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  EXPIRED: 'bg-gray-50 text-gray-500 border-gray-200',
  EXHAUSTED: 'bg-gray-50 text-gray-500 border-gray-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
  SUPERSEDED: 'bg-gray-50 text-gray-500 border-gray-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기',
  ACTIVE: '사용 중',
  CANCELLATION_REQUESTED: '해지 심사 중',
  EXPIRED: '기간 만료',
  EXHAUSTED: '횟수 소진',
  CANCELLED: '해지됨',
  SUPERSEDED: '재계약으로 대체됨',
  REJECTED: '반려됨',
};

/**
 * 조직 상세(`UserOrganizationDetail`) 안에 얹는 "구독" 섹션 — signstage-docs
 * business/organization-event-discount-pricing-review.md 8장 결정(2026-09-10). 신청/중도해지
 * 요청은 OWNER만 할 수 있다(서버가 강제하지만, 여기서도 미리 숨겨서 헛수고를 막는다). 진행
 * 중이거나 사용 중인 구독이 없으면 "구독형 플랜 신청" 버튼을, 있으면 그 상태를 보여준다.
 */
export const OrganizationSubscriptionSection: FC<{ organizationId: string; myRole: MemberRole }> = ({
  organizationId,
  myRole,
}) => {
  const [subscription, setSubscription] = useState<OrganizationSubscriptionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const [isCancelFormOpen, setIsCancelFormOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const isOwner = myRole === 'OWNER';

  const fetchSubscription = async () => {
    const response = await api.get(`/organizations/${organizationId}/subscriptions/current`);
    return response.data as OrganizationSubscriptionSummary | null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSubscription();
        if (!cancelled) setSubscription(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '구독 상태를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const openRequestForm = async () => {
    setIsRequestFormOpen(true);
    try {
      const response = await api.get('/billing-plans');
      const subscriptionPlans = (response.data as BillingPlanSummary[]).filter((plan) => plan.subscription);
      setPlans(subscriptionPlans);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '구독형 플랜 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    setIsSubmittingRequest(true);
    try {
      const response = await api.post(`/organizations/${organizationId}/subscriptions`, { billingPlanId: selectedPlanId });
      setSubscription(response.data as OrganizationSubscriptionSummary);
      setIsRequestFormOpen(false);
      setSelectedPlanId('');
      showSnackbar('구독을 신청했습니다. 관리자 승인을 기다려주세요.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '구독 신청에 실패했습니다.', 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleSubmitCancellation = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancellationReason.trim()) return;
    setIsSubmittingCancellation(true);
    try {
      const response = await api.post(`/organizations/${organizationId}/subscriptions/cancellation-request`, {
        cancellationReason: cancellationReason.trim(),
      });
      setSubscription(response.data as OrganizationSubscriptionSummary);
      setIsCancelFormOpen(false);
      setCancellationReason('');
      showSnackbar('중도 해지를 요청했습니다. 관리자 승인을 기다려주세요.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '중도 해지 요청에 실패했습니다.', 'error');
    } finally {
      setIsSubmittingCancellation(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-center text-gray-400">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  const canRequestCancellation = isOwner && subscription?.status === 'ACTIVE';

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <CalendarClock size={14} />
          구독
        </h2>
        {!subscription && isOwner && (
          <button
            onClick={openRequestForm}
            className="text-xs font-medium text-gray-600 hover:text-gray-950 border border-gray-200 hover:border-gray-400 rounded-md px-2.5 py-1 transition-colors"
          >
            구독형 플랜 신청
          </button>
        )}
      </div>

      {!subscription ? (
        <p className="text-sm text-gray-500">
          {isOwner ? '신청한 구독이 없습니다.' : '신청한 구독이 없습니다. 구독 신청은 OWNER만 할 수 있습니다.'}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[subscription.status]}`}>
              {STATUS_LABEL[subscription.status] ?? subscription.status}
            </span>
            <span className="text-sm font-medium text-gray-950">{subscription.billingPlanName}</span>
          </div>

          {subscription.status === 'PENDING' && (
            <p className="text-xs text-gray-500">관리자 승인을 기다리는 중입니다.</p>
          )}

          {subscription.status !== 'PENDING' && subscription.status !== 'REJECTED' && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between col-span-2 sm:col-span-1">
                <dt className="text-gray-400">유형</dt>
                <dd>{subscription.subscriptionTypeSnapshot === 'PERIOD_AND_COUNT' ? '기간+횟수' : '횟수제'}</dd>
              </div>
              {subscription.periodMonthsSnapshot !== null && (
                <div className="flex justify-between col-span-2 sm:col-span-1">
                  <dt className="text-gray-400">기간</dt>
                  <dd>{subscription.periodMonthsSnapshot}개월</dd>
                </div>
              )}
              <div className="flex justify-between col-span-2 sm:col-span-1">
                <dt className="text-gray-400">잔여 횟수</dt>
                <dd>
                  {subscription.remainingCount} / {subscription.allowedCountSnapshot}건
                </dd>
              </div>
              {subscription.startDate && (
                <div className="flex justify-between col-span-2 sm:col-span-1">
                  <dt className="text-gray-400">시작일</dt>
                  <dd>{formatDate(subscription.startDate)}</dd>
                </div>
              )}
              {subscription.endDate && (
                <div className="flex justify-between col-span-2 sm:col-span-1">
                  <dt className="text-gray-400">종료일</dt>
                  <dd>{formatDate(subscription.endDate)}</dd>
                </div>
              )}
            </dl>
          )}

          {subscription.status === 'CANCELLATION_REQUESTED' && (
            <p className="text-xs text-amber-700">해지 심사 중입니다 — 승인 전까지는 계속 사용할 수 있습니다.</p>
          )}

          {canRequestCancellation && (
            <button
              onClick={() => setIsCancelFormOpen(true)}
              className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-md px-2.5 py-1 transition-colors"
            >
              중도 해지 요청
            </button>
          )}
        </div>
      )}

      {isRequestFormOpen && (
        <form onSubmit={handleSubmitRequest} className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500">신청할 구독형 플랜</label>
            <button type="button" onClick={() => setIsRequestFormOpen(false)} className="text-gray-400 hover:text-gray-950">
              <X size={14} />
            </button>
          </div>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          >
            <option value="">선택해주세요</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.subscriptionType === 'PERIOD_AND_COUNT' ? `${plan.subscriptionPeriodMonths}개월 ` : ''}
                {plan.subscriptionAllowedCount}회)
              </option>
            ))}
          </select>
          {plans.length === 0 && <p className="text-xs text-gray-400">신청할 수 있는 구독형 플랜이 없습니다.</p>}
          <button
            type="submit"
            disabled={!selectedPlanId || isSubmittingRequest}
            className="w-full py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {isSubmittingRequest ? '신청 중...' : '신청하기'}
          </button>
        </form>
      )}

      {isCancelFormOpen && (
        <form onSubmit={handleSubmitCancellation} className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500">해지 사유</label>
            <button type="button" onClick={() => setIsCancelFormOpen(false)} className="text-gray-400 hover:text-gray-950">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            rows={3}
            placeholder="해지 사유를 입력해주세요."
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!cancellationReason.trim() || isSubmittingCancellation}
            className="w-full py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isSubmittingCancellation ? '요청 중...' : '해지 요청하기'}
          </button>
        </form>
      )}
    </div>
  );
};
