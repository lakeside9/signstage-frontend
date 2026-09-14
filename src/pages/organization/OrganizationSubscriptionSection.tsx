import { Fragment, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { ListContainer } from '../../components/ListContainer';
import { Modal } from '../../components/Modal';
import { SearchBar, SearchField } from '../../components/SearchBar';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/internationalization';
import { PeriodStatusBadge } from '../billingCatalog/components';
import type { BillingPlanSummary, MemberRole, OrganizationSubscriptionStatus, OrganizationSubscriptionSummary, PageResponse } from '../../types';

const PAGE_SIZE = 20;

const STATUS_BADGE_CLASS: Record<OrganizationSubscriptionStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLATION_REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  EXPIRED: 'bg-gray-50 text-gray-500 border-gray-200',
  EXHAUSTED: 'bg-gray-50 text-gray-500 border-gray-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
  SUPERSEDED: 'bg-gray-50 text-gray-500 border-gray-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABEL: Record<OrganizationSubscriptionStatus, string> = {
  PENDING: '승인 대기',
  ACTIVE: '사용 중',
  CANCELLATION_REQUESTED: '해지 심사 중',
  EXPIRED: '기간 만료',
  EXHAUSTED: '횟수 소진',
  CANCELLED: '해지됨',
  SUPERSEDED: '재계약으로 대체됨',
  REJECTED: '반려됨',
};

const STATUS_OPTIONS: Array<{ value: OrganizationSubscriptionStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  ...(Object.keys(STATUS_LABEL) as OrganizationSubscriptionStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] })),
];

/** PENDING이거나 해지 심사 중이면 새 신청을 서버가 거부한다(`OrganizationSubscriptionService#requestSubscription`,
 * `SUBSCRIPTION_ALREADY_IN_PROGRESS`) — ACTIVE는 재계약으로 취급돼 막지 않는다. */
const BLOCKS_NEW_REQUEST: OrganizationSubscriptionStatus[] = ['PENDING', 'CANCELLATION_REQUESTED'];

interface SearchParams {
  status: OrganizationSubscriptionStatus | 'ALL';
}

const EMPTY_SEARCH: SearchParams = { status: 'ALL' };

/**
 * 조직 상세(`UserOrganizationDetail`) 안에 얹는 "구독" 섹션 — signstage-docs
 * business/organization-event-discount-pricing-review.md 8장 결정(2026-09-10). 신청/중도해지
 * 요청은 OWNER만 할 수 있다(서버가 강제하지만, 여기서도 미리 숨겨서 헛수고를 막는다).
 *
 * <p>목록을 검색 영역/목록/페이지네비게이션 3단 구조로 바꿨다(2026-09-14, 사용자 요청 —
 * "구독 화면은 목록형태로 만들고, 검색영역/목록/페이지 네비게이션을 적용해주세요",
 * signstage-docs frontend/list-screen-convention.md). `SearchBar`/`SearchField`/
 * `ListContainer`를 그대로 재사용하고, 상태 필터는 관리자 콘솔의 "구독 요청
 * 관리"(`AdminSubscriptionRequestList.tsx`)와 같은 패턴이다 — draft(`formValues`)/applied
 * (`searchParams`) 분리, 검색 제출 시 페이지 0으로 리셋, 초기화는 조건을 비우고 즉시
 * 재조회한다.
 *
 * <p>목록은 처음엔 카드(`<ul>`/`<li>`)였다가, 같은 날 다시 "구독 목록에는 타이틀을
 * 상태/플랜명/유형/잔여횟수/시작일(or 구매일)/종료일을 보여주고 클릭했을 때 상세내용을
 * 보여주도록 해주세요" 요청으로 표로 바꿨다 — 관리자 콘솔의 "구독 요청
 * 관리"(`AdminSubscriptionRequestList.tsx`)와 같은 `<table>` + `Fragment` 클릭-확장 패턴이다.
 * 요약 행 6열(상태/플랜명/유형/잔여횟수/시작일·구매일/종료일)은 상태와 무관하게 항상 값이
 * 있거나 "-"로 채워지고, 신청일·기간(개월)·구매 비용·상태별 안내 문구·(ACTIVE라면) 중도
 * 해지 요청 폼은 그 행을 클릭해 펼쳐야 보이는 상세 행으로 옮겼다. 요약 행의 `onClick`과
 * 상세 행 안의 해지 버튼/폼은 서로 다른 `<tr>`라 `stopPropagation`이 필요 없다.
 *
 * <p>백엔드도 이 후속에서 `List` 반환이던 이력 조회를
 * `OrganizationSubscriptionService#findSubscriptions`(페이지네이션+상태 필터, 관리자
 * `findRequests`와 같은 모양)로 바꿨다. "새 신청" 버튼을 보여줄지 판단하려면 목록과 무관하게
 * "이 조직에 지금 PENDING/CANCELLATION_REQUESTED 구독이 있는가"를 전역으로 알아야 하는데,
 * 목록 화면이 상태 필터가 걸려 있거나 다른 페이지를 보고 있으면 그 정보가 현재 화면에 없을
 * 수 있다 — 그래서 목록과는 별개로 가벼운 `/subscriptions/current` 조회를 하나 더 둬서 그
 * 판단에만 쓴다(목록 자체를 렌더링하는 데는 쓰지 않는다).
 *
 * <p>플랜 신청 폼은 공용 `Modal`로 띄운다 — 플랜 선택은 판매중(`ON_SALE`)이 아닌 플랜은
 * 선택을 막는 카드형 목록이다(그 결정 배경은 이 문서의 앞선 후속 기록 참고). 중도 해지
 * 요청은 ACTIVE 행 아래 인라인 확장 폼으로 남겼다. 버튼은 전부 공용 `Button`
 * 컴포넌트(`size="sm"`)로 통일하고 우측 정렬했으며, 신청 모달·해지 폼 둘 다 "닫기" +
 * 제출 버튼 쌍을 우측 정렬로 둔다(이 문서의 앞선 두 후속에서 이미 정리됨).
 */
export const OrganizationSubscriptionSection: FC<{ organizationId: string; myRole: MemberRole }> = ({
  organizationId,
  myRole,
}) => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<OrganizationSubscriptionSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** 목록과 별개로, "새 신청" 버튼 노출 판단에만 쓰는 가벼운 상태 조회(위 클래스 주석 참고). */
  const [current, setCurrent] = useState<OrganizationSubscriptionSummary | null>(null);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  /** 클릭해서 펼친 행(상세 정보 표시) — 표 클릭-확장 패턴(위 클래스 주석 참고). */
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const isOwner = myRole === 'OWNER';

  const fetchSubscriptions = async (search: SearchParams, pageNumber: number) => {
    const query = new URLSearchParams();
    if (search.status !== 'ALL') query.set('status', search.status);
    query.set('page', String(pageNumber));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/organizations/${organizationId}/subscriptions?${query.toString()}`);
    return response.data as PageResponse<OrganizationSubscriptionSummary>;
  };

  const fetchCurrent = async () => {
    const response = await api.get(`/organizations/${organizationId}/subscriptions/current`);
    return response.data as OrganizationSubscriptionSummary | null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSubscriptions(searchParams, page);
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '구독 이력을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, searchParams, page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCurrent();
        if (!cancelled) setCurrent(data);
      } catch {
        // "새 신청" 버튼 노출 판단용 보조 조회라, 실패해도 목록 자체는 정상 동작해야 한다 —
        // 버튼만 안전하게(보수적으로 숨긴 채) 두고 별도 오류 토스트는 띄우지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const refresh = async () => {
    const [subscriptions, currentData] = await Promise.all([fetchSubscriptions(searchParams, page), fetchCurrent()]);
    setPageData(subscriptions);
    setCurrent(currentData);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setSearchParams({ ...formValues });
  };

  const handleReset = () => {
    setIsLoading(true);
    setFormValues(EMPTY_SEARCH);
    setPage(0);
    setSearchParams({ ...EMPTY_SEARCH });
  };

  const handlePageChange = (nextPage: number) => {
    setIsLoading(true);
    setPage(nextPage);
  };

  const canRequestNew = isOwner && !(current && BLOCKS_NEW_REQUEST.includes(current.status));

  const openRequestModal = async () => {
    setIsRequestModalOpen(true);
    setSelectedPlanId('');
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
      await api.post(`/organizations/${organizationId}/subscriptions`, { billingPlanId: selectedPlanId });
      setIsRequestModalOpen(false);
      setSelectedPlanId('');
      await refresh();
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
      await api.post(`/organizations/${organizationId}/subscriptions/cancellation-request`, {
        cancellationReason: cancellationReason.trim(),
      });
      setCancelTargetId(null);
      setCancellationReason('');
      await refresh();
      showSnackbar('중도 해지를 요청했습니다. 관리자 승인을 기다려주세요.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '중도 해지 요청에 실패했습니다.', 'error');
    } finally {
      setIsSubmittingCancellation(false);
    }
  };

  const subscriptions = pageData?.content ?? [];

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <CalendarClock size={14} />
          구독
        </h2>
        {canRequestNew && (
          <Button variant="secondary" size="sm" onClick={openRequestModal}>
            구독형 플랜 신청
          </Button>
        )}
      </div>

      {!isOwner && (
        <p className="mb-3 text-xs text-gray-400">구독 신청·중도 해지는 OWNER만 할 수 있습니다.</p>
      )}

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={formValues.status}
            onChange={(e) => setFormValues({ status: e.target.value as OrganizationSubscriptionStatus | 'ALL' })}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={subscriptions.length === 0}
        emptyMessage="해당 조건의 구독 신청 이력이 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: handlePageChange,
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-left px-4 py-3 font-medium">플랜명</th>
              <th className="text-left px-4 py-3 font-medium">유형</th>
              <th className="text-left px-4 py-3 font-medium">잔여 횟수</th>
              <th className="text-left px-4 py-3 font-medium">시작일/구매일</th>
              <th className="text-left px-4 py-3 font-medium">종료일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subscriptions.map((subscription) => {
              const isExpanded = expandedId === subscription.id;
              const isPeriodAndCount = subscription.subscriptionTypeSnapshot === 'PERIOD_AND_COUNT';
              return (
                <Fragment key={subscription.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : subscription.id)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[subscription.status]}`}>
                        {STATUS_LABEL[subscription.status] ?? subscription.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-950 font-medium">{subscription.billingPlanName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {subscription.subscriptionTypeSnapshot === null ? '-' : isPeriodAndCount ? '기간+횟수' : '횟수제'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {subscription.remainingCount !== null ? `${subscription.remainingCount} / ${subscription.allowedCountSnapshot}건` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {subscription.startDate ? formatDate(subscription.startDate) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {isPeriodAndCount && subscription.endDate ? formatDate(subscription.endDate) : '-'}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-3 space-y-2">
                        <div className="flex justify-end">
                          <span className="text-xs text-gray-400">신청일 {formatDateTime(subscription.createdAt)}</span>
                        </div>

                        {subscription.status === 'PENDING' && (
                          <p className="text-xs text-gray-500">관리자 승인을 기다리는 중입니다.</p>
                        )}
                        {subscription.status === 'REJECTED' && subscription.rejectionReason && (
                          <p className="text-xs text-red-600">반려 사유: {subscription.rejectionReason}</p>
                        )}
                        {subscription.status === 'CANCELLATION_REQUESTED' && (
                          <p className="text-xs text-amber-700">해지 심사 중입니다 — 승인 전까지는 계속 사용할 수 있습니다.</p>
                        )}

                        {(subscription.periodMonthsSnapshot !== null || subscription.purchaseAmountSnapshot !== null) && (
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600">
                            {subscription.periodMonthsSnapshot !== null && (
                              <div className="flex justify-between col-span-2 sm:col-span-1">
                                <dt className="text-gray-400">기간</dt>
                                <dd>{subscription.periodMonthsSnapshot}개월</dd>
                              </div>
                            )}
                            {subscription.purchaseAmountSnapshot !== null && (
                              <div className="flex justify-between col-span-2 sm:col-span-1">
                                <dt className="text-gray-400">구매 비용</dt>
                                <dd>{formatCurrency(subscription.purchaseAmountSnapshot, subscription.currencyCodeSnapshot ?? undefined)}</dd>
                              </div>
                            )}
                          </dl>
                        )}

                        {subscription.status === 'CANCELLED' && subscription.cancellationReason && (
                          <p className="text-xs text-gray-400">해지 사유: {subscription.cancellationReason}</p>
                        )}

                        {isOwner && subscription.status === 'ACTIVE' && (
                          <>
                            <div className="flex justify-end">
                              <Button
                                variant="danger-outline"
                                size="sm"
                                onClick={() => setCancelTargetId(cancelTargetId === subscription.id ? null : subscription.id)}
                              >
                                중도 해지 요청
                              </Button>
                            </div>

                            {cancelTargetId === subscription.id && (
                              <form onSubmit={handleSubmitCancellation} className="mt-2 border-t border-gray-200 pt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-gray-500">해지 사유</label>
                                  <button type="button" onClick={() => setCancelTargetId(null)} className="text-gray-400 hover:text-gray-950">
                                    <X size={14} />
                                  </button>
                                </div>
                                <textarea
                                  value={cancellationReason}
                                  onChange={(e) => setCancellationReason(e.target.value)}
                                  rows={3}
                                  placeholder="해지 사유를 입력해주세요."
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="secondary" size="sm" onClick={() => setCancelTargetId(null)} disabled={isSubmittingCancellation}>
                                    닫기
                                  </Button>
                                  <Button variant="danger" size="sm" type="submit" disabled={!cancellationReason.trim() || isSubmittingCancellation}>
                                    {isSubmittingCancellation ? '요청 중...' : '해지 요청하기'}
                                  </Button>
                                </div>
                              </form>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </ListContainer>

      <Modal open={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="구독형 플랜 신청" widthClassName="max-w-lg">
        <form onSubmit={handleSubmitRequest} className="space-y-3">
          <label className="block text-xs font-medium text-gray-500">신청할 구독형 플랜</label>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {plans.map((plan) => {
              const isSelectable = plan.periodStatus === 'ON_SALE';
              const isSelected = selectedPlanId === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={!isSelectable}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                    !isSelectable
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'border-gray-950 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-950">{plan.name}</span>
                    <PeriodStatusBadge status={plan.periodStatus} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {plan.subscriptionType === 'PERIOD_AND_COUNT' ? '기간+횟수' : '횟수제'}
                    {plan.subscriptionPeriodMonths ? ` · ${plan.subscriptionPeriodMonths}개월` : ''}
                    {` · ${plan.subscriptionAllowedCount}회`}
                  </p>
                </button>
              );
            })}
          </div>
          {plans.length === 0 && <p className="text-xs text-gray-400">신청할 수 있는 구독형 플랜이 없습니다.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsRequestModalOpen(false)} disabled={isSubmittingRequest}>
              닫기
            </Button>
            <Button size="sm" type="submit" disabled={!selectedPlanId || isSubmittingRequest}>
              {isSubmittingRequest ? '신청 중...' : '신청하기'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
