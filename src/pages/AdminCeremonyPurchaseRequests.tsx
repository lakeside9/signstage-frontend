import { Fragment, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, ShoppingCart, X } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type {
  CapacityAddOnSummary,
  CapacityType,
  OptionalFeatureSummary,
  PageResponse,
  PlatformAdminCapacityPurchaseRequestSummary,
  PlatformAdminOptionalFeaturePurchaseRequestSummary,
  PurchaseStatus,
} from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: PurchaseStatus | 'ALL'; label: string }> = [
  { value: 'PENDING', label: '승인 대기' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'REJECTED', label: '반려됨' },
  { value: 'ALL', label: '전체' },
];

const STATUS_BADGE_CLASS: Record<PurchaseStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const CAPACITY_TYPE_LABEL: Record<CapacityType, string> = {
  SIGNERS: '서명자',
  TEMPLATES: '템플릿',
  TEST_EVENTS: '테스트 행사',
  REHEARSAL_EVENTS: '리허설 행사',
  MAIN_EVENTS: '본행사',
  TABLETS: '태블릿',
};

/** 처리할 게 남은 요청부터 보이는 게 자연스러운 승인 큐라서, 다른 목록과 달리 기본값을 PENDING으로 둔다. */
const EMPTY_SEARCH: { status: PurchaseStatus | 'ALL' } = { status: 'PENDING' };

/**
 * 플랫폼 관리자의 행사 용량/선택옵션 추가구매 요청 승인/반려 화면 — signstage-docs
 * business/ceremony-billing-options-review.md. 조회는 PLATFORM_SUPPORT 이상, 승인/반려는
 * PLATFORM_OPS 이상만 가능하다({@link AdminOrganizationRequestList}와 같은 등급 규칙).
 *
 * 승인은 입력할 값이 없어(이미 존재하는 PENDING 행의 상태만 바꾼다) 조직 생성 요청 승인처럼
 * 펼침 입력폼을 열지 않고 버튼 한 번으로 바로 확정한다. 반려는 사유가 필요해 펼침 입력폼을 쓴다.
 */
export const AdminCeremonyPurchaseRequests: FC = () => {
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <ShoppingCart size={20} className="text-gray-400" />
          추가구매 요청
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          행사의 용량/선택옵션 추가구매 요청입니다. 승인해야 조직이 실제로 사용할 수 있습니다.
        </p>
      </div>

      <CapacityPurchaseRequestSection canManage={canManage} showSnackbar={showSnackbar} />
      <OptionalFeaturePurchaseRequestSection canManage={canManage} showSnackbar={showSnackbar} />
    </div>
  );
};

interface SectionProps {
  canManage: boolean;
  showSnackbar: (message: string, variant: 'success' | 'error') => void;
}

const CapacityPurchaseRequestSection: FC<SectionProps> = ({ canManage, showSnackbar }) => {
  const [formValues, setFormValues] = useState(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminCapacityPurchaseRequestSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

  const addOnLabel = (id: number) => {
    const addOn = addOns.find((a) => a.id === id);
    if (!addOn) return `#${id}`;
    const primary = `${CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType} +${addOn.unitAmount}`;
    if (!addOn.secondaryCapacityType) return primary;
    return `${primary} · ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType} +${addOn.secondaryUnitAmount}`;
  };

  const fetchRequests = async () => {
    const query = new URLSearchParams();
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));

    const [requestsResponse, addOnsResponse] = await Promise.all([
      api.get(`/platform-admin/capacity-purchases?${query.toString()}`),
      api.get('/capacity-addons'),
    ]);
    return {
      requests: requestsResponse.data as PageResponse<PlatformAdminCapacityPurchaseRequestSummary>,
      addOns: addOnsResponse.data as CapacityAddOnSummary[],
    };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRequests();
        if (!cancelled) {
          setPageData(data.requests);
          setAddOns(data.addOns);
        }
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '용량 추가구매 요청 목록을 불러오지 못했습니다.', 'error');
        }
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

  const refresh = async () => {
    setPageData((await fetchRequests()).requests);
  };

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      await api.post(`/platform-admin/capacity-purchases/${requestId}/approve`, {});
      showSnackbar('요청을 승인했습니다.', 'success');
      await refresh();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '승인에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const openReject = (requestId: number) => {
    setRejectingId(requestId);
    setReasonDraft('');
  };

  const handleReject = async (requestId: number) => {
    if (!reasonDraft.trim()) {
      showSnackbar('반려 사유를 입력해주세요.', 'error');
      return;
    }
    setProcessingId(requestId);
    try {
      await api.put(`/platform-admin/capacity-purchases/${requestId}/reject`, { rejectionReason: reasonDraft.trim() });
      showSnackbar('요청을 반려했습니다.', 'success');
      setRejectingId(null);
      await refresh();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '반려에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const requests = pageData?.content ?? [];
  const columnCount = canManage ? 6 : 5;

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-950 mb-3">용량 추가구매 요청</h2>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={formValues.status}
            onChange={(e) => setFormValues({ status: e.target.value as PurchaseStatus | 'ALL' })}
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
        emptyMessage="해당 조건의 용량 추가구매 요청이 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: (nextPage) => {
                  setIsLoading(true);
                  setPage(nextPage);
                },
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">요청자</th>
              <th className="text-left px-4 py-3 font-medium">조직/행사</th>
              <th className="text-left px-4 py-3 font-medium">용량</th>
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
                    <Link
                      to={`/admin/organizations/${request.organizationId}`}
                      className="inline-flex items-center gap-1.5 text-gray-950 hover:underline"
                    >
                      <Building2 size={14} className="text-gray-400" />
                      {request.ceremonyTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {addOnLabel(request.capacityAddOnId)} × {request.quantity}
                  </td>
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
                        {request.reviewerLoginId} · {new Date(request.reviewedAt).toLocaleString('ko-KR')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(request.createdAt).toLocaleString('ko-KR')}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {request.status === 'PENDING' &&
                        (rejectingId === request.id ? (
                          <button
                            onClick={() => setRejectingId(null)}
                            disabled={processingId === request.id}
                            className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                          >
                            취소
                          </button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={processingId === request.id}
                              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                            >
                              <Check size={12} />
                              승인
                            </button>
                            <button
                              onClick={() => openReject(request.id)}
                              disabled={processingId === request.id}
                              className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                            >
                              반려
                            </button>
                          </div>
                        ))}
                    </td>
                  )}
                </tr>
                {canManage && rejectingId === request.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={columnCount} className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-md">
                        <input
                          type="text"
                          value={reasonDraft}
                          onChange={(e) => setReasonDraft(e.target.value)}
                          disabled={processingId === request.id}
                          placeholder="반려 사유"
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
                        />
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={processingId === request.id}
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
    </section>
  );
};

const OptionalFeaturePurchaseRequestSection: FC<SectionProps> = ({ canManage, showSnackbar }) => {
  const [formValues, setFormValues] = useState(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminOptionalFeaturePurchaseRequestSummary> | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

  const featureName = (id: number) => features.find((f) => f.id === id)?.name ?? `#${id}`;

  const fetchRequests = async () => {
    const query = new URLSearchParams();
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));

    const [requestsResponse, featuresResponse] = await Promise.all([
      api.get(`/platform-admin/optional-feature-purchases?${query.toString()}`),
      api.get('/optional-features'),
    ]);
    return {
      requests: requestsResponse.data as PageResponse<PlatformAdminOptionalFeaturePurchaseRequestSummary>,
      features: featuresResponse.data as OptionalFeatureSummary[],
    };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRequests();
        if (!cancelled) {
          setPageData(data.requests);
          setFeatures(data.features);
        }
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '선택옵션 추가구매 요청 목록을 불러오지 못했습니다.', 'error');
        }
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

  const refresh = async () => {
    setPageData((await fetchRequests()).requests);
  };

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      await api.post(`/platform-admin/optional-feature-purchases/${requestId}/approve`, {});
      showSnackbar('요청을 승인했습니다.', 'success');
      await refresh();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '승인에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const openReject = (requestId: number) => {
    setRejectingId(requestId);
    setReasonDraft('');
  };

  const handleReject = async (requestId: number) => {
    if (!reasonDraft.trim()) {
      showSnackbar('반려 사유를 입력해주세요.', 'error');
      return;
    }
    setProcessingId(requestId);
    try {
      await api.put(`/platform-admin/optional-feature-purchases/${requestId}/reject`, {
        rejectionReason: reasonDraft.trim(),
      });
      showSnackbar('요청을 반려했습니다.', 'success');
      setRejectingId(null);
      await refresh();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '반려에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const requests = pageData?.content ?? [];
  const columnCount = canManage ? 6 : 5;

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-950 mb-3">선택옵션 추가구매 요청</h2>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={formValues.status}
            onChange={(e) => setFormValues({ status: e.target.value as PurchaseStatus | 'ALL' })}
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
        emptyMessage="해당 조건의 선택옵션 추가구매 요청이 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: (nextPage) => {
                  setIsLoading(true);
                  setPage(nextPage);
                },
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">요청자</th>
              <th className="text-left px-4 py-3 font-medium">조직/행사</th>
              <th className="text-left px-4 py-3 font-medium">선택옵션</th>
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
                    <Link
                      to={`/admin/organizations/${request.organizationId}`}
                      className="inline-flex items-center gap-1.5 text-gray-950 hover:underline"
                    >
                      <Building2 size={14} className="text-gray-400" />
                      {request.ceremonyTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{featureName(request.optionalFeatureId)}</td>
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
                        {request.reviewerLoginId} · {new Date(request.reviewedAt).toLocaleString('ko-KR')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(request.createdAt).toLocaleString('ko-KR')}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {request.status === 'PENDING' &&
                        (rejectingId === request.id ? (
                          <button
                            onClick={() => setRejectingId(null)}
                            disabled={processingId === request.id}
                            className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                          >
                            취소
                          </button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={processingId === request.id}
                              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                            >
                              <Check size={12} />
                              승인
                            </button>
                            <button
                              onClick={() => openReject(request.id)}
                              disabled={processingId === request.id}
                              className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                            >
                              반려
                            </button>
                          </div>
                        ))}
                    </td>
                  )}
                </tr>
                {canManage && rejectingId === request.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={columnCount} className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-md">
                        <input
                          type="text"
                          value={reasonDraft}
                          onChange={(e) => setReasonDraft(e.target.value)}
                          disabled={processingId === request.id}
                          placeholder="반려 사유"
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
                        />
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={processingId === request.id}
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
    </section>
  );
};
