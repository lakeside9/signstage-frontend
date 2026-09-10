import { Fragment, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { canManagePlatform } from '../utils/permissions';
import type { OrganizationSubscriptionStatus, OrganizationSubscriptionSummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: OrganizationSubscriptionStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING', label: '신청 승인 대기' },
  { value: 'ACTIVE', label: '사용 중' },
  { value: 'CANCELLATION_REQUESTED', label: '해지 승인 대기' },
  { value: 'EXPIRED', label: '기간 만료' },
  { value: 'EXHAUSTED', label: '횟수 소진' },
  { value: 'CANCELLED', label: '해지됨' },
  { value: 'SUPERSEDED', label: '재계약 대체됨' },
  { value: 'REJECTED', label: '반려됨' },
];

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
  PENDING: '신청 승인 대기',
  ACTIVE: '사용 중',
  CANCELLATION_REQUESTED: '해지 승인 대기',
  EXPIRED: '기간 만료',
  EXHAUSTED: '횟수 소진',
  CANCELLED: '해지됨',
  SUPERSEDED: '재계약 대체됨',
  REJECTED: '반려됨',
};

interface SearchParams {
  status: OrganizationSubscriptionStatus | 'ALL';
}

const EMPTY_SEARCH: SearchParams = { status: 'ALL' };

type ActionMode = 'approve' | 'reject' | 'approveCancellation' | 'rejectCancellation';

/**
 * 플랫폼 관리자의 조직 구독/계약 승인 큐 — signstage-docs
 * business/organization-event-discount-pricing-review.md 8장 결정(2026-09-10).
 * `AdminOrganizationRequestList`와 같은 구조지만, 이 화면은 두 종류의 대기 상태(신청
 * PENDING, 중도해지 CANCELLATION_REQUESTED)를 함께 다룬다 — 상태별로 승인/반려 액션이
 * 다르다. 조회는 PLATFORM_SUPPORT 이상, 승인/반려는 PLATFORM_OPS 이상만 가능하다.
 */
export const AdminSubscriptionRequestList: FC = () => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<OrganizationSubscriptionSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [actioningId, setActioningId] = useState<number | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchRequests = async () => {
    const query = new URLSearchParams();
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));

    const response = await api.get(`/platform-admin/subscriptions?${query.toString()}`);
    return response.data as PageResponse<OrganizationSubscriptionSummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRequests();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '구독 요청 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, page]);

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

  const openAction = (subscriptionId: number, mode: ActionMode) => {
    setActioningId(subscriptionId);
    setActionMode(mode);
    setReasonDraft('');
  };

  const closeAction = () => {
    setActioningId(null);
    setActionMode(null);
  };

  const refresh = async () => {
    setPageData(await fetchRequests());
  };

  const runAction = async (path: string, body: Record<string, string> | undefined, successMessage: string) => {
    setIsSubmittingAction(true);
    try {
      await api.post(path, body);
      showSnackbar(successMessage, 'success');
      closeAction();
      await refresh();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '처리에 실패했습니다.', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleApprove = (id: number) => runAction(`/platform-admin/subscriptions/${id}/approve`, undefined, '구독 신청을 승인했습니다.');
  const handleReject = (id: number) => {
    if (!reasonDraft.trim()) return showSnackbar('반려 사유를 입력해주세요.', 'error');
    return runAction(`/platform-admin/subscriptions/${id}/reject`, { rejectionReason: reasonDraft.trim() }, '구독 신청을 반려했습니다.');
  };
  const handleApproveCancellation = (id: number) =>
    runAction(`/platform-admin/subscriptions/${id}/cancellation/approve`, undefined, '중도 해지를 승인했습니다.');
  const handleRejectCancellation = (id: number) => {
    if (!reasonDraft.trim()) return showSnackbar('반려 사유를 입력해주세요.', 'error');
    return runAction(
      `/platform-admin/subscriptions/${id}/cancellation/reject`,
      { rejectionReason: reasonDraft.trim() },
      '중도 해지 요청을 반려했습니다.',
    );
  };

  const requests = pageData?.content ?? [];
  const columnCount = canManage ? 7 : 6;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">구독 요청 관리</h1>
        <p className="mt-1 text-sm text-gray-500">조직의 구독형 플랜 신청/중도해지 요청입니다. 승인해야 실제로 적용됩니다.</p>
      </div>

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
        isEmpty={requests.length === 0}
        emptyMessage="해당 조건의 구독 요청이 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">조직</th>
              <th className="text-left px-4 py-3 font-medium">플랜</th>
              <th className="text-left px-4 py-3 font-medium">신청자</th>
              <th className="text-left px-4 py-3 font-medium">잔여 횟수</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-left px-4 py-3 font-medium">신청일</th>
              {canManage && <th className="text-right px-4 py-3 font-medium">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((request) => (
              <Fragment key={request.id}>
                <tr>
                  <td className="px-4 py-3 text-gray-950 font-medium">{request.organizationName}</td>
                  <td className="px-4 py-3 text-gray-600">{request.billingPlanName}</td>
                  <td className="px-4 py-3 text-gray-500">{request.requesterLoginId}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {request.remainingCount !== null ? `${request.remainingCount} / ${request.allowedCountSnapshot}건` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[request.status]}`}>
                      {STATUS_LABEL[request.status]}
                    </span>
                    {request.rejectionReason && <p className="mt-1 text-xs text-red-600">{request.rejectionReason}</p>}
                    {request.status === 'CANCELLATION_REQUESTED' && request.cancellationReason && (
                      <p className="mt-1 text-xs text-amber-700">해지 사유: {request.cancellationReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(request.createdAt)}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {request.status === 'PENDING' &&
                        (actioningId === request.id ? (
                          <Button variant="secondary" size="sm" onClick={closeAction} disabled={isSubmittingAction}>
                            취소
                          </Button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleApprove(request.id)} disabled={isSubmittingAction}>
                              승인
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => openAction(request.id, 'reject')}>
                              반려
                            </Button>
                          </div>
                        ))}
                      {request.status === 'CANCELLATION_REQUESTED' &&
                        (actioningId === request.id ? (
                          <Button variant="secondary" size="sm" onClick={closeAction} disabled={isSubmittingAction}>
                            취소
                          </Button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleApproveCancellation(request.id)} disabled={isSubmittingAction}>
                              해지 승인
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => openAction(request.id, 'rejectCancellation')}>
                              해지 반려
                            </Button>
                          </div>
                        ))}
                    </td>
                  )}
                </tr>
                {canManage && actioningId === request.id && actionMode === 'reject' && (
                  <tr className="bg-gray-50">
                    <td colSpan={columnCount} className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-md">
                        <input
                          type="text"
                          value={reasonDraft}
                          onChange={(e) => setReasonDraft(e.target.value)}
                          disabled={isSubmittingAction}
                          placeholder="반려 사유"
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
                        />
                        <Button variant="danger" size="sm" onClick={() => handleReject(request.id)} disabled={isSubmittingAction}>
                          <X size={12} />
                          반려 확정
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {canManage && actioningId === request.id && actionMode === 'rejectCancellation' && (
                  <tr className="bg-gray-50">
                    <td colSpan={columnCount} className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-md">
                        <input
                          type="text"
                          value={reasonDraft}
                          onChange={(e) => setReasonDraft(e.target.value)}
                          disabled={isSubmittingAction}
                          placeholder="해지 반려 사유"
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
                        />
                        <Button variant="danger" size="sm" onClick={() => handleRejectCancellation(request.id)} disabled={isSubmittingAction}>
                          <Check size={12} />
                          해지 반려 확정
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </ListContainer>
      {!canManage && <p className="mt-2 text-xs text-gray-400">승인/반려는 PLATFORM_OPS 이상만 가능합니다. (조회 전용 계정)</p>}
    </div>
  );
};
