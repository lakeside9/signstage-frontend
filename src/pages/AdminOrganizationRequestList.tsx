import { Fragment, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, X } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { canManagePlatform } from '../utils/permissions';
import type {
  OrganizationCreationRequestStatus,
  PageResponse,
  PlatformAdminOrganizationRequestSummary,
} from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: OrganizationCreationRequestStatus | 'ALL'; label: string }> = [
  { value: 'PENDING', label: '승인 대기' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'REJECTED', label: '반려됨' },
  { value: 'CANCELLED', label: '취소됨' },
  { value: 'ALL', label: '전체' },
];

const STATUS_BADGE_CLASS: Record<OrganizationCreationRequestStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

interface SearchParams {
  status: OrganizationCreationRequestStatus | 'ALL';
}

/** 처리할 게 남은 요청부터 보이는 게 자연스러운 승인 큐라서, 다른 목록과 달리 기본값을 PENDING으로 둔다. */
const EMPTY_SEARCH: SearchParams = { status: 'PENDING' };

type ActionMode = 'approve' | 'reject';

/**
 * 플랫폼 관리자의 파트너 등록 요청 승인/반려 화면 — signstage-docs
 * business/organization-creation-approval-review.md. 조회는 PLATFORM_SUPPORT 이상,
 * 승인/반려는 PLATFORM_OPS 이상만 가능하다(파트너 등록·상태 변경과 같은 등급).
 *
 * 요청은 코드를 담지 않으므로 승인 시점에 관리자가 코드를 입력한다(3.3절). 승인되면
 * 관리자 대행 등록과 같은 저장 로직을 타고 organizations/organization_members가 만들어진다.
 */
export const AdminOrganizationRequestList: FC = () => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminOrganizationRequestSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [actioningId, setActioningId] = useState<number | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [codeDraft, setCodeDraft] = useState('');
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

    const response = await api.get(`/platform-admin/organization-requests?${query.toString()}`);
    return response.data as PageResponse<PlatformAdminOrganizationRequestSummary>;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchRequests();
        if (!cancelled) {
          setPageData(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '파트너 등록 요청 목록을 불러오지 못했습니다.';
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
  }, [searchParams, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    // 새 객체로 복사해서 넣는다 — formValues가 searchParams와 참조가 같으면(예: 아무 것도
    // 안 건드리고 바로 "검색"을 누르거나, 검색 조건을 안 바꾸고 다시 누르는 경우) React가
    // 같은 참조는 상태 변경으로 안 치고 넘어가 아래 useEffect가 다시 안 돌고, 방금 켠
    // isLoading만 true로 영원히 남는다(2026-08-25 발견 — 검색 화면 공통 버그).
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

  const openAction = (requestId: number, mode: ActionMode) => {
    setActioningId(requestId);
    setActionMode(mode);
    setCodeDraft('');
    setReasonDraft('');
  };

  const closeAction = () => {
    setActioningId(null);
    setActionMode(null);
  };

  const refresh = async () => {
    setPageData(await fetchRequests());
  };

  const handleApprove = async (requestId: number) => {
    if (!codeDraft.trim()) {
      showSnackbar('파트너 코드를 입력해주세요.', 'error');
      return;
    }
    setIsSubmittingAction(true);
    try {
      await api.post(`/platform-admin/organization-requests/${requestId}/approve`, { code: codeDraft.trim() });
      showSnackbar('요청을 승인했습니다.', 'success');
      closeAction();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '승인에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReject = async (requestId: number) => {
    if (!reasonDraft.trim()) {
      showSnackbar('반려 사유를 입력해주세요.', 'error');
      return;
    }
    setIsSubmittingAction(true);
    try {
      await api.put(`/platform-admin/organization-requests/${requestId}/reject`, { rejectionReason: reasonDraft.trim() });
      showSnackbar('요청을 반려했습니다.', 'success');
      closeAction();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '반려에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const requests = pageData?.content ?? [];
  const columnCount = canManage ? 6 : 5;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">파트너등록요청관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          사용자가 제출한 파트너 등록 요청입니다. 승인하면 신청자가 새 파트너의 OWNER가 됩니다.
        </p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={formValues.status}
            onChange={(e) =>
              setFormValues({ status: e.target.value as OrganizationCreationRequestStatus | 'ALL' })
            }
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
        emptyMessage="해당 조건의 파트너 등록 요청이 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">요청자</th>
              <th className="text-left px-4 py-3 font-medium">파트너 이름</th>
              <th className="text-left px-4 py-3 font-medium">메모</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-left px-4 py-3 font-medium">요청일</th>
              {canManage && <th className="text-right px-4 py-3 font-medium">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((request) => (
              <Fragment key={request.id}>
                <tr>
                  <td className="px-4 py-3 text-gray-950 font-medium">
                    {request.requesterLoginId}
                    <Link
                      to={`/admin/users/${request.requesterId}`}
                      className="ml-1.5 text-xs text-gray-400 hover:text-gray-950 hover:underline"
                    >
                      상세
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {request.organizationId ? (
                      <Link
                        to={`/admin/organizations/${request.organizationId}`}
                        className="inline-flex items-center gap-1.5 text-gray-950 hover:underline"
                      >
                        <Building2 size={14} className="text-gray-400" />
                        {request.organizationName}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-950">
                        <Building2 size={14} className="text-gray-400" />
                        {request.organizationName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{request.note ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[request.status]}`}
                    >
                      {request.status}
                    </span>
                    {request.status === 'REJECTED' && request.rejectionReason && (
                      <p className="mt-1 text-xs text-red-600">{request.rejectionReason}</p>
                    )}
                    {request.status !== 'PENDING' && request.reviewerLoginId && request.reviewedAt && (
                      <p className="mt-1 text-xs text-gray-400">
                        {request.reviewerLoginId} · {formatDateTime(request.reviewedAt)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateTime(request.createdAt)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {request.status === 'PENDING' &&
                        (actioningId === request.id ? (
                          <button
                            onClick={closeAction}
                            disabled={isSubmittingAction}
                            className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                          >
                            취소
                          </button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openAction(request.id, 'approve')}
                              className="px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => openAction(request.id, 'reject')}
                              className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
                            >
                              반려
                            </button>
                          </div>
                        ))}
                    </td>
                  )}
                </tr>
                {canManage && actioningId === request.id && actionMode === 'approve' && (
                  <tr className="bg-gray-50">
                    <td colSpan={columnCount} className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-sm">
                        <input
                          type="text"
                          value={codeDraft}
                          onChange={(e) => setCodeDraft(e.target.value.toLowerCase())}
                          disabled={isSubmittingAction}
                          placeholder="파트너 코드 (영문 소문자, 숫자, '-')"
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
                        />
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={isSubmittingAction}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                        >
                          <Check size={12} />
                          승인 확정
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
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
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={isSubmittingAction}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          <X size={12} />
                          반려 확정
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </ListContainer>
      {!canManage && (
        <p className="mt-2 text-xs text-gray-400">승인/반려는 PLATFORM_OPS 이상만 가능합니다. (조회 전용 계정)</p>
      )}
    </div>
  );
};
