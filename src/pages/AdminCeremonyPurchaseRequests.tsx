import { Fragment, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, ChevronDown, ShoppingCart, X } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/internationalization';
import { canManagePlatform } from '../utils/permissions';
import type {
  CeremonyEventType,
  PageResponse,
  PlatformAdminCeremonyEventStatusSummary,
  PlatformAdminUnitProductPurchaseRequestSummary,
  PurchaseStatus,
} from '../types';

const PAGE_SIZE = 20;

/**
 * 자가-체크아웃 도입 이후 대부분의 구매가 승인 단계 자체를 거치지 않고 즉시 APPROVED로
 * 생겨서(2026-09-11), "승인 대기"/"승인됨" 같은 승인 큐 어감의 한글 라벨이 실제와 안 맞는다
 * (2026-09-12 사용자 지적 — "승인의 단계가 없어졌으므로 상태코드로 변경이 필요합니다").
 * 상태 배지 자체도 원래 코드값을 그대로 보여주므로(아래 status 셀), 필터 목록도 같은
 * 코드값으로 통일한다.
 */
const STATUS_OPTIONS: Array<{ value: PurchaseStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'APPROVED', label: 'APPROVED' },
  { value: 'REJECTED', label: 'REJECTED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
];

const STATUS_BADGE_CLASS: Record<PurchaseStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const EVENT_TYPE_LABEL: Record<CeremonyEventType, string> = {
  TEST: '테스트',
  REHEARSAL: '리허설',
  MAIN: '본행사',
};

const EVENT_TYPE_ORDER: CeremonyEventType[] = ['TEST', 'REHEARSAL', 'MAIN'];

/**
 * 하위 행사를 타입별로 압축한다 — signstage-docs
 * business/ceremony-unit-product-purchase-cancellation-review.md 3.6절(2026-09-12) 표시
 * 규칙. 개별 행사를 전부 나열하지 않고 타입당 한 칩만 두며, 그 타입에 `STARTED`인 게
 * 하나라도 있으면 그것만 강조한다(그 외 상태는 세분화하지 않는다) — 취소 시 이벤트 효과
 * 자동 해제를 STARTED만 예외로 두는 하이브리드 판단에 필요한 정보가 이것뿐이기 때문이다.
 */
const summarizeCeremonyEventsByType = (
  events: PlatformAdminCeremonyEventStatusSummary[],
): Array<{ eventType: CeremonyEventType; events: PlatformAdminCeremonyEventStatusSummary[]; startedCount: number }> =>
  EVENT_TYPE_ORDER.map((eventType) => {
    const eventsOfType = events.filter((event) => event.eventType === eventType);
    return {
      eventType,
      events: eventsOfType,
      startedCount: eventsOfType.filter((event) => event.status === 'STARTED').length,
    };
  }).filter((group) => group.events.length > 0);

interface SearchValues {
  status: PurchaseStatus | 'ALL';
  requesterKeyword: string;
  ceremonyTitle: string;
}

/**
 * 이 화면이 더 이상 "처리할 게 남은 요청부터 보이는 승인 큐"가 아니라 이력 조회 중심이라
 * (자가-체크아웃 도입, 위 STATUS_OPTIONS 주석 참고) 기본값을 "전체"로 둔다(2026-09-12 사용자
 * 요청) — 예전엔 PENDING 기본이었다.
 */
const EMPTY_SEARCH: SearchValues = { status: 'ALL', requesterKeyword: '', ceremonyTitle: '' };
/** 임베드 모드("행사 이력" 화면)도 원래부터 "전체" 기본이라 EMPTY_SEARCH와 이제 값이 같지만, 의도를 분명히 하려고 별도로 둔다. */
const EMPTY_SEARCH_FOR_CEREMONY: SearchValues = { status: 'ALL', requesterKeyword: '', ceremonyTitle: '' };

/**
 * 플랫폼 관리자의 단위 상품 "추가구매 내역" 화면(2026-09-12 개명 — 옛 "추가구매 요청") —
 * signstage-docs business/billing-catalog-unit-product-model-redesign-review.md 결정
 * (2026-09-10) 옛 용량/선택옵션 2종 승인 큐를 하나로 합쳤다(장바구니형 요청이라 승인/반려/
 * 취소도 요청 전체 단위다). 조회는 PLATFORM_SUPPORT 이상, 승인/반려/취소는 PLATFORM_OPS
 * 이상만 가능하다({@link AdminOrganizationRequestList}와 같은 등급 규칙).
 *
 * <p><b>개명 배경(2026-09-12 사용자 요청)</b> — 자가-체크아웃 도입(signstage-docs
 * business/unit-product-purchase-self-checkout-review.md 결정, 2026-09-11)으로 시스템
 * 사용료 추가구매는 대부분 승인 단계 없이 즉시 APPROVED로 생긴다. "요청"이라는 이름과
 * 기본 상태 필터 PENDING이 "관리자가 처리해야 할 대기열"이라는 옛 그림을 계속 암시해서
 * 실제(이력 조회가 대부분, 승인/반려가 필요한 PENDING은 배포 전 레거시 정도만 남음)와
 * 어긋났다 — 화면 제목을 "추가구매 내역"으로, 기본 상태 필터를 "전체"로, 상태 라벨을
 * 승인 큐 어감의 한글(승인 대기/승인됨) 대신 원래 코드값(PENDING/APPROVED/...)으로 바꿔
 * 이 실제 모습에 맞췄다. 검색에 요청자·행사명 키워드를 추가하고 목록에 금액·요청자 실명도
 * 보여준다(같은 요청).
 *
 * <p>승인은 입력할 값이 없어(이미 존재하는 PENDING 행의 상태만 바꾼다) 조직 생성 요청 승인처럼
 * 펼침 입력폼을 열지 않고 버튼 한 번으로 바로 확정한다. 반려/취소는 사유가 필요해 펼침
 * 입력폼을 쓴다(취소는 이미 승인(APPROVED)된 구매를 관리자가 나중에 되돌리는 것 —
 * signstage-docs business/ceremony-unit-product-purchase-cancellation-review.md 결정,
 * 2026-09-12).
 *
 * <p>`ceremonyId` prop을 넘기면 그 행사로 좁힌 "임베드" 모드로 동작한다(제목 숨김, "행사 이력"
 * 화면이 플랜 이력과 나란히 보여줄 때 쓴다, 8.6절 결정).
 */
export const AdminCeremonyPurchaseRequests: FC<{ ceremonyId?: number }> = ({ ceremonyId }) => {
  const embedded = ceremonyId !== undefined;
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const defaultSearch = embedded ? EMPTY_SEARCH_FOR_CEREMONY : EMPTY_SEARCH;
  const [formValues, setFormValues] = useState(defaultSearch);
  const [searchParams, setSearchParams] = useState(defaultSearch);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminUnitProductPurchaseRequestSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  /** 하위 행사 칩을 펼친 (요청 id, eventType) 키 — 한 번에 여러 개를 펼쳐둘 수 있다. */
  const [expandedEventChip, setExpandedEventChip] = useState<string | null>(null);

  const fetchRequests = async () => {
    const query = new URLSearchParams();
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    if (ceremonyId !== undefined) query.set('ceremonyId', String(ceremonyId));
    if (searchParams.requesterKeyword.trim()) query.set('requesterKeyword', searchParams.requesterKeyword.trim());
    if (searchParams.ceremonyTitle.trim()) query.set('ceremonyTitle', searchParams.ceremonyTitle.trim());
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));

    const response = await api.get(`/platform-admin/unit-product-purchases?${query.toString()}`);
    return response.data as PageResponse<PlatformAdminUnitProductPurchaseRequestSummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRequests();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '단위 상품 추가구매 내역을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, page, ceremonyId]);

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
    setPageData(await fetchRequests());
  };

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      await api.post(`/platform-admin/unit-product-purchases/${requestId}/approve`, {});
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
      await api.put(`/platform-admin/unit-product-purchases/${requestId}/reject`, { rejectionReason: reasonDraft.trim() });
      showSnackbar('요청을 반려했습니다.', 'success');
      setRejectingId(null);
      await refresh();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '반려에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const openCancel = (requestId: number) => {
    setCancellingId(requestId);
    setCancelReasonDraft('');
  };

  const handleCancel = async (requestId: number) => {
    if (!cancelReasonDraft.trim()) {
      showSnackbar('취소 사유를 입력해주세요.', 'error');
      return;
    }
    setProcessingId(requestId);
    try {
      await api.put(`/platform-admin/unit-product-purchases/${requestId}/cancel`, { cancellationReason: cancelReasonDraft.trim() });
      showSnackbar('구매를 취소했습니다.', 'success');
      setCancellingId(null);
      await refresh();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '취소에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const requests = pageData?.content ?? [];
  const columnCount = canManage ? 7 : 6;

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <ShoppingCart size={20} className="text-gray-400" />
            추가구매 내역
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            행사의 단위 상품 추가구매 내역입니다(장바구니형 — 한 건에 여러 줄이 담길 수 있습니다). 자가-체크아웃
            도입 이후 시스템 사용료 구매는 대부분 승인 단계 없이 즉시 APPROVED로 반영되고, 여기서는 그 이력을
            조회하거나 필요하면 승인된 구매를 취소합니다 — PENDING(승인/반려가 필요한 요청)은 배포 전 레거시 정도만
            남아 있습니다.
          </p>
        </div>
      )}

      <section>
        <SearchBar onSubmit={handleSearch} onReset={handleReset}>
          <SearchField label="상태">
            <select
              value={formValues.status}
              onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value as PurchaseStatus | 'ALL' }))}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SearchField>
          <SearchField label="요청자" className="w-48">
            <input
              type="text"
              value={formValues.requesterKeyword}
              onChange={(e) => setFormValues((prev) => ({ ...prev, requesterKeyword: e.target.value }))}
              placeholder="아이디 또는 이름"
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
            />
          </SearchField>
          <SearchField label="행사명" className="w-48">
            <input
              type="text"
              value={formValues.ceremonyTitle}
              onChange={(e) => setFormValues((prev) => ({ ...prev, ceremonyTitle: e.target.value }))}
              placeholder="행사 제목"
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
            />
          </SearchField>
        </SearchBar>

        <ListContainer
          isLoading={isLoading}
          isEmpty={requests.length === 0}
          emptyMessage="해당 조건의 추가구매 내역이 없습니다."
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
                <th className="text-left px-4 py-3 font-medium">파트너/행사</th>
                <th className="text-left px-4 py-3 font-medium">단위 상품</th>
                <th className="text-right px-4 py-3 font-medium">금액</th>
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
                      <p className="text-xs text-gray-400 font-normal">{request.requesterName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/organizations/${request.organizationId}`}
                        className="inline-flex items-center gap-1.5 text-gray-950 hover:underline"
                      >
                        <Building2 size={14} className="text-gray-400" />
                        {request.ceremonyTitle}
                      </Link>
                      {(() => {
                        const groups = summarizeCeremonyEventsByType(request.ceremonyEvents);
                        if (groups.length === 0) {
                          return <p className="mt-1 text-xs text-gray-400">하위 행사 없음</p>;
                        }
                        return (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {groups.map((group) => {
                              const chipKey = `${request.id}-${group.eventType}`;
                              const isExpanded = expandedEventChip === chipKey;
                              return (
                                <button
                                  key={group.eventType}
                                  type="button"
                                  onClick={() => setExpandedEventChip(isExpanded ? null : chipKey)}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border ${
                                    group.startedCount > 0
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-gray-50 text-gray-500 border-gray-200'
                                  }`}
                                >
                                  {EVENT_TYPE_LABEL[group.eventType]} {group.events.length}건
                                  {group.startedCount > 0 && ` · 진행중 ${group.startedCount}건`}
                                  <ChevronDown size={10} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {request.lines.map((line) => `${line.purchasedName} × ${line.quantity}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-950 font-medium whitespace-nowrap">
                      {formatCurrency(
                        request.lines.reduce((sum, line) => sum + line.purchasedSalePrice * line.quantity, 0),
                        request.lines[0]?.currencyCode ?? 'KRW',
                      )}
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
                      {request.status === 'CANCELLED' && request.cancellationReason && (
                        <p className="mt-1 text-xs text-gray-600">{request.cancellationReason}</p>
                      )}
                      {request.status !== 'PENDING' && request.status !== 'CANCELLED' && request.reviewerLoginId && request.reviewedAt && (
                        <p className="mt-1 text-xs text-gray-400">
                          {request.reviewerLoginId} · {formatDateTime(request.reviewedAt)}
                        </p>
                      )}
                      {request.status === 'CANCELLED' && request.cancellerLoginId && request.cancelledAt && (
                        <p className="mt-1 text-xs text-gray-400">
                          {request.cancellerLoginId} · {formatDateTime(request.cancelledAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateTime(request.createdAt)}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {request.status === 'PENDING' &&
                          (rejectingId === request.id ? (
                            <Button variant="secondary" size="sm" onClick={() => setRejectingId(null)} disabled={processingId === request.id}>
                              닫기
                            </Button>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => handleApprove(request.id)} disabled={processingId === request.id}>
                                <Check size={12} />
                                승인
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => openReject(request.id)} disabled={processingId === request.id}>
                                반려
                              </Button>
                            </div>
                          ))}
                        {request.status === 'APPROVED' &&
                          (cancellingId === request.id ? (
                            <Button variant="secondary" size="sm" onClick={() => setCancellingId(null)} disabled={processingId === request.id}>
                              닫기
                            </Button>
                          ) : (
                            <Button variant="secondary" size="sm" onClick={() => openCancel(request.id)} disabled={processingId === request.id}>
                              구매 취소
                            </Button>
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
                          <Button variant="danger" size="sm" onClick={() => handleReject(request.id)} disabled={processingId === request.id}>
                            <X size={12} />
                            반려 확정
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {canManage && cancellingId === request.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={columnCount} className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-md">
                          <input
                            type="text"
                            value={cancelReasonDraft}
                            onChange={(e) => setCancelReasonDraft(e.target.value)}
                            disabled={processingId === request.id}
                            placeholder="취소 사유"
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
                          />
                          <Button variant="danger" size="sm" onClick={() => handleCancel(request.id)} disabled={processingId === request.id}>
                            <X size={12} />
                            취소 확정
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {summarizeCeremonyEventsByType(request.ceremonyEvents).map((group) => {
                    const chipKey = `${request.id}-${group.eventType}`;
                    if (expandedEventChip !== chipKey) return null;
                    return (
                      <tr key={chipKey} className="bg-gray-50">
                        <td colSpan={columnCount} className="px-4 py-3">
                          <p className="text-xs font-medium text-gray-500 mb-1.5">
                            {EVENT_TYPE_LABEL[group.eventType]} 하위 행사 {group.events.length}건
                          </p>
                          <ul className="space-y-1">
                            {group.events.map((event, index) => (
                              <li key={index} className="text-xs text-gray-600 flex items-center gap-2">
                                <span className="font-medium text-gray-950">{event.name}</span>
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded-full border ${
                                    event.status === 'STARTED'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-gray-100 text-gray-500 border-gray-200'
                                  }`}
                                >
                                  {event.status}
                                </span>
                                {event.scheduledStartAt && <span className="text-gray-400">예정 {formatDateTime(event.scheduledStartAt)}</span>}
                                {event.actualStartAt && <span className="text-gray-400">실제 {formatDateTime(event.actualStartAt)}</span>}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </ListContainer>
      </section>
    </div>
  );
};
