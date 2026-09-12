import { Fragment, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronDown, MessageCircleQuestion, Send } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { canManagePlatform } from '../utils/permissions';
import type { InquiryStatus, PageResponse, PlatformAdminCeremonyInquiryDetail, PlatformAdminCeremonyInquirySummary } from '../types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: InquiryStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'OPEN', label: 'OPEN (답변 대기)' },
  { value: 'ANSWERED', label: 'ANSWERED' },
  { value: 'CLOSED', label: 'CLOSED' },
];

const STATUS_BADGE_CLASS: Record<InquiryStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  ANSWERED: 'bg-blue-50 text-blue-700 border-blue-200',
  CLOSED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const SENDER_LABEL: Record<string, string> = { PARTNER: '파트너', PLATFORM_ADMIN: '관리자' };

interface SearchValues {
  status: InquiryStatus | 'ALL';
  requesterKeyword: string;
  ceremonyTitle: string;
}

const EMPTY_SEARCH: SearchValues = { status: 'ALL', requesterKeyword: '', ceremonyTitle: '' };

/**
 * 플랫폼 관리자의 행사별 1:1 문의 관리 화면 — signstage-docs
 * business/partner-support-center-review.md 5.3/5.4절. "파트너사 구매 내역"과 같은 조직
 * 横단 검색·조회 패턴(organizationId/ceremonyId/status/requesterKeyword 전부 선택 필터).
 * 조회는 PLATFORM_SUPPORT 이상, 답변/종료는 ACTION_CEREMONY_INQUIRY_MANAGE가 허용된
 * 등급(PLATFORM_OPS 이상)만 가능하다.
 */
export const AdminCeremonyInquiries: FC = () => {
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [formValues, setFormValues] = useState(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PlatformAdminCeremonyInquirySummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PlatformAdminCeremonyInquiryDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInquiries = async () => {
    const query = new URLSearchParams();
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    if (searchParams.requesterKeyword.trim()) query.set('requesterKeyword', searchParams.requesterKeyword.trim());
    if (searchParams.ceremonyTitle.trim()) query.set('ceremonyTitle', searchParams.ceremonyTitle.trim());
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/platform-admin/ceremony-inquiries?${query.toString()}`);
    return response.data as PageResponse<PlatformAdminCeremonyInquirySummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInquiries();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '문의 목록을 불러오지 못했습니다.', 'error');
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
    setPageData(await fetchInquiries());
  };

  const loadDetail = async (inquiryId: number) => {
    setIsDetailLoading(true);
    try {
      const response = await api.get(`/platform-admin/ceremony-inquiries/${inquiryId}`);
      setDetail(response.data as PlatformAdminCeremonyInquiryDetail);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '문의 상세를 불러오지 못했습니다.', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const toggleExpand = (inquiryId: number) => {
    if (expandedId === inquiryId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(inquiryId);
    setReplyDraft('');
    void loadDetail(inquiryId);
  };

  const handleReply = async (inquiryId: number) => {
    if (!replyDraft.trim()) {
      showSnackbar('답변 내용을 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/platform-admin/ceremony-inquiries/${inquiryId}/messages`, { content: replyDraft.trim() });
      setReplyDraft('');
      await loadDetail(inquiryId);
      await refreshList();
      showSnackbar('답변을 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '답변 등록에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async (inquiryId: number) => {
    setIsSubmitting(true);
    try {
      await api.put(`/platform-admin/ceremony-inquiries/${inquiryId}/close`, {});
      await loadDetail(inquiryId);
      await refreshList();
      showSnackbar('문의를 종료했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '종료에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inquiries = pageData?.content ?? [];
  const columnCount = 6;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <MessageCircleQuestion size={20} className="text-gray-400" />
          행사 문의 관리
        </h1>
        <p className="mt-1 text-sm text-gray-500">파트너가 행사별로 남긴 1:1 문의 전체입니다. 조직·행사 구분 없이 한 화면에서 조회·답변합니다.</p>
      </div>

      <section>
        <SearchBar onSubmit={handleSearch} onReset={handleReset}>
          <SearchField label="상태">
            <select
              value={formValues.status}
              onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value as InquiryStatus | 'ALL' }))}
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
          isEmpty={inquiries.length === 0}
          emptyMessage="해당 조건의 문의가 없습니다."
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
                <th className="text-left px-4 py-3 font-medium">제목</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-left px-4 py-3 font-medium">최근 업데이트</th>
                <th className="text-right px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inquiries.map((inquiry) => {
                const isExpanded = expandedId === inquiry.id;
                return (
                  <Fragment key={inquiry.id}>
                    <tr>
                      <td className="px-4 py-3 text-gray-950 font-medium">
                        {inquiry.requesterLoginId ?? '-'}
                        <p className="text-xs text-gray-400 font-normal">{inquiry.requesterName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/organizations/${inquiry.organizationId}`} className="inline-flex items-center gap-1.5 text-gray-950 hover:underline">
                          <Building2 size={14} className="text-gray-400" />
                          {inquiry.organizationName}
                        </Link>
                        <p className="mt-0.5 text-xs text-gray-400">{inquiry.ceremonyTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{inquiry.title}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[inquiry.status]}`}>
                          {inquiry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(inquiry.lastMessageAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleExpand(inquiry.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                        >
                          {isExpanded ? '닫기' : '대화 보기'}
                          <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={columnCount} className="px-4 py-4">
                          {isDetailLoading || !detail ? (
                            <p className="text-xs text-gray-400">불러오는 중...</p>
                          ) : (
                            <div className="space-y-3">
                              <div className="space-y-2 max-h-72 overflow-y-auto">
                                {detail.messages.map((message) => (
                                  <div
                                    key={message.id}
                                    className={`max-w-lg rounded-lg px-3 py-2 text-sm ${
                                      message.senderType === 'PLATFORM_ADMIN'
                                        ? 'ml-auto bg-gray-950 text-white'
                                        : 'bg-white border border-gray-200 text-gray-700'
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                    <p
                                      className={`mt-1 text-[11px] ${
                                        message.senderType === 'PLATFORM_ADMIN' ? 'text-gray-300' : 'text-gray-400'
                                      }`}
                                    >
                                      {SENDER_LABEL[message.senderType]} · {formatDateTime(message.createdAt)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              {canManage && detail.status !== 'CLOSED' && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={replyDraft}
                                    onChange={(e) => setReplyDraft(e.target.value)}
                                    disabled={isSubmitting}
                                    placeholder="답변을 입력하세요"
                                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
                                  />
                                  <Button size="sm" onClick={() => handleReply(inquiry.id)} disabled={isSubmitting}>
                                    <Send size={12} />
                                    답변
                                  </Button>
                                  <Button variant="secondary" size="sm" onClick={() => handleClose(inquiry.id)} disabled={isSubmitting}>
                                    종료
                                  </Button>
                                </div>
                              )}
                              {detail.status === 'CLOSED' && <p className="text-xs text-gray-400">종료된 문의입니다.</p>}
                            </div>
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
