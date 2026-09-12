import { Fragment, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronDown, MapPin } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/internationalization';
import { canManagePlatform } from '../utils/permissions';
import type { OnsiteSupportRequestStatus, PageResponse, PlatformAdminOnsiteSupportRequestSummary } from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: OnsiteSupportRequestStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'REQUESTED', label: 'REQUESTED (견적 대기)' },
  { value: 'QUOTED', label: 'QUOTED (견적 도착)' },
  { value: 'ACCEPTED', label: 'ACCEPTED' },
  { value: 'DECLINED', label: 'DECLINED' },
];

const STATUS_BADGE_CLASS: Record<OnsiteSupportRequestStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  QUOTED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-gray-100 text-gray-500 border-gray-200',
};

/** LocalDateTime 문자열을 타임존 변환 없이 그대로 보여준다 — 파트너가 입력한 벽시계 시각이라 UTC 감사 시각이 아니다(UserCeremonyDetail의 formatEventDateTime과 같은 원칙). */
const formatRequestedAt = (value: string) => `${value.slice(0, 10)} ${value.slice(11, 16)}`;

interface SearchValues {
  status: OnsiteSupportRequestStatus | 'ALL';
  requesterKeyword: string;
}

const EMPTY_SEARCH: SearchValues = { status: 'ALL', requesterKeyword: '' };

/**
 * 플랫폼 관리자의 현장지원 요청(관리자 견적) 협상 관리 화면 — signstage-docs
 * business/onsite-support-negotiation-and-billing-classification-review.md 3.2절(2026-09-12).
 * `AdminCeremonyInquiries.tsx`와 같은 조직 横단 검색·조회 패턴. 조회는 PLATFORM_SUPPORT 이상,
 * 견적 입력(quote)은 ACTION_ONSITE_SUPPORT_REQUEST_MANAGE가 허용된 등급(PLATFORM_OPS 이상)만
 * 가능하다 — REQUESTED 상태에서만 견적을 입력할 수 있다(그 외 상태는 이미 종결/응답 대기중).
 */
export const AdminOnsiteSupportRequests: FC = () => {
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [formValues, setFormValues] = useState(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminOnsiteSupportRequestSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [quotedAmount, setQuotedAmount] = useState('');
  const [quotedNote, setQuotedNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = async () => {
    const query = new URLSearchParams();
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    if (searchParams.requesterKeyword.trim()) query.set('requesterKeyword', searchParams.requesterKeyword.trim());
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/platform-admin/onsite-support-requests?${query.toString()}`);
    return response.data as PageResponse<PlatformAdminOnsiteSupportRequestSummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRequests();
        if (!cancelled) setPageData(data);
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

  const refreshList = async () => {
    setPageData(await fetchRequests());
  };

  const toggleExpand = (requestId: number) => {
    if (expandedId === requestId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(requestId);
    setQuotedAmount('');
    setQuotedNote('');
  };

  const handleQuote = async (requestId: number) => {
    if (!quotedAmount.trim()) {
      showSnackbar('견적 금액을 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/platform-admin/onsite-support-requests/${requestId}/quote`, {
        quotedAmount: Number(quotedAmount),
        quotedNote: quotedNote.trim() || undefined,
      });
      setExpandedId(null);
      await refreshList();
      showSnackbar('견적을 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '견적 등록에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requests = pageData?.content ?? [];
  const columnCount = 6;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <MapPin size={20} className="text-gray-400" />
          현장지원 요청 관리
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          파트너가 일시·장소를 적어 요청한 현장지원입니다. 거리 등을 보고 금액을 매기면 파트너가 수락/거부를 선택합니다.
        </p>
      </div>

      <section>
        <SearchBar onSubmit={handleSearch} onReset={handleReset}>
          <SearchField label="상태">
            <select
              value={formValues.status}
              onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value as OnsiteSupportRequestStatus | 'ALL' }))}
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
        </SearchBar>

        <ListContainer
          isLoading={isLoading}
          isEmpty={requests.length === 0}
          emptyMessage="해당 조건의 현장지원 요청이 없습니다."
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
                <th className="text-left px-4 py-3 font-medium">일시/장소</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-left px-4 py-3 font-medium">견적</th>
                <th className="text-right px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((request) => {
                const isExpanded = expandedId === request.id;
                return (
                  <Fragment key={request.id}>
                    <tr>
                      <td className="px-4 py-3 text-gray-950 font-medium">
                        {request.requesterLoginId ?? '-'}
                        <p className="text-xs text-gray-400 font-normal">{request.requesterName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/organizations/${request.organizationId}`} className="inline-flex items-center gap-1.5 text-gray-950 hover:underline">
                          <Building2 size={14} className="text-gray-400" />
                          {request.organizationName}
                        </Link>
                        <p className="mt-0.5 text-xs text-gray-400">{request.ceremonyTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatRequestedAt(request.requestedAt)}
                        <p className="mt-0.5 text-xs text-gray-400">{request.location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[request.status]}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {request.quotedAmount !== null ? formatCurrency(request.quotedAmount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleExpand(request.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                        >
                          {isExpanded ? '닫기' : '상세 보기'}
                          <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={columnCount} className="px-4 py-4">
                          <div className="space-y-2 text-xs text-gray-500">
                            {request.requesterNote && <p>요청 사항: {request.requesterNote}</p>}
                            {request.quotedNote && <p>견적 메모: {request.quotedNote}</p>}
                            {request.quotedAt && <p>견적 시각: {formatDateTime(request.quotedAt)}</p>}
                            {request.respondedAt && <p>응답 시각: {formatDateTime(request.respondedAt)}</p>}
                            {request.quotedByLoginId && <p>견적 담당: {request.quotedByLoginId}</p>}
                          </div>

                          {canManage && request.status === 'REQUESTED' && (
                            <div className="mt-3 flex items-end gap-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">견적 금액</label>
                                <FormattedNumberInput
                                  value={quotedAmount}
                                  onChange={setQuotedAmount}
                                  disabled={isSubmitting}
                                  placeholder="0"
                                  className="w-40 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">메모 (선택)</label>
                                <input
                                  type="text"
                                  value={quotedNote}
                                  onChange={(e) => setQuotedNote(e.target.value)}
                                  disabled={isSubmitting}
                                  placeholder="예: 근거리(50km 이내) 출장비"
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
                                />
                              </div>
                              <Button size="sm" onClick={() => handleQuote(request.id)} disabled={isSubmitting}>
                                견적 등록
                              </Button>
                            </div>
                          )}
                          {request.status !== 'REQUESTED' && (
                            <p className="mt-3 text-xs text-gray-400">
                              {request.status === 'QUOTED' ? '파트너의 수락/거부 응답을 기다리는 중입니다.' : '이미 종결된 요청입니다.'}
                            </p>
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
      </section>
    </div>
  );
};
