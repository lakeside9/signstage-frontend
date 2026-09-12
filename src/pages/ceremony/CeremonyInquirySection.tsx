import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Loader2, MessageCircleQuestion, Plus, Send } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatDateTime } from '../../utils/internationalization';
import type { CeremonyInquiryDetail, CeremonyInquirySummary, InquiryStatus } from '../../types';

const STATUS_BADGE_CLASS: Record<InquiryStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  ANSWERED: 'bg-blue-50 text-blue-700 border-blue-200',
  CLOSED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABEL: Record<InquiryStatus, string> = {
  OPEN: '답변 대기',
  ANSWERED: '답변 완료',
  CLOSED: '종료',
};

const SENDER_LABEL: Record<string, string> = { PARTNER: '파트너', PLATFORM_ADMIN: '관리자' };

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/**
 * 행사 수정 화면(`UserCeremonyEdit`)의 "문의" 탭 — signstage-docs
 * business/partner-support-center-review.md 5.4절. 이 행사에 대해 파트너가 플랫폼 관리자에게
 * 남기는 1:1 문의 목록(최근 갱신순)과 선택한 문의의 대화 스레드를 함께 보여준다. 종료(CLOSED)
 * 된 문의는 재오픈할 수 없다 — 계속 물어보려면 새 문의를 등록한다.
 */
export const CeremonyInquirySection: FC<{ organizationId: string; ceremonyId: string }> = ({ organizationId, ceremonyId }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}/inquiries`;

  const [inquiries, setInquiries] = useState<CeremonyInquirySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CeremonyInquiryDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');

  const fetchInquiries = async () => {
    const response = await api.get(basePath);
    setInquiries(response.data as CeremonyInquirySummary[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(basePath);
        if (!cancelled) setInquiries(response.data as CeremonyInquirySummary[]);
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
  }, [organizationId, ceremonyId]);

  const loadDetail = async (inquiryId: number) => {
    setIsDetailLoading(true);
    try {
      const response = await api.get(`${basePath}/${inquiryId}`);
      setDetail(response.data as CeremonyInquiryDetail);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '문의 상세를 불러오지 못했습니다.', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSelect = (inquiryId: number) => {
    setSelectedId(inquiryId);
    setReplyDraft('');
    void loadDetail(inquiryId);
  };

  const openCreate = () => {
    setCreateTitle('');
    setCreateContent('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createContent.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await api.post(basePath, { title: createTitle.trim(), content: createContent.trim() });
      const created = response.data as CeremonyInquiryDetail;
      setIsCreateOpen(false);
      await fetchInquiries();
      setSelectedId(created.id);
      setDetail(created);
      showSnackbar('문의를 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '문의 등록에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (selectedId === null || !replyDraft.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post(`${basePath}/${selectedId}/messages`, { content: replyDraft.trim() });
      setReplyDraft('');
      await loadDetail(selectedId);
      await fetchInquiries();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '메시지 등록에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (selectedId === null) return;
    setIsSubmitting(true);
    try {
      await api.put(`${basePath}/${selectedId}/close`);
      await loadDetail(selectedId);
      await fetchInquiries();
      showSnackbar('문의를 종료했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '종료에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">이 행사에 대해 플랫폼 관리자에게 문의할 수 있습니다.</p>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> 새 문의
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : inquiries.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">등록된 문의가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
            {inquiries.map((inquiry) => (
              <button
                key={inquiry.id}
                type="button"
                onClick={() => handleSelect(inquiry.id)}
                className={`w-full text-left px-3 py-2.5 text-sm ${selectedId === inquiry.id ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              >
                <p className="font-medium text-gray-950 truncate">{inquiry.title}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[inquiry.status]}`}>
                    {STATUS_LABEL[inquiry.status]}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateTime(inquiry.lastMessageAt)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="md:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
            {selectedId === null ? (
              <div className="flex items-center justify-center h-full py-12 text-sm text-gray-400">
                <MessageCircleQuestion size={16} className="mr-1.5" />
                왼쪽에서 문의를 선택하세요.
              </div>
            ) : isDetailLoading || !detail ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-950">{detail.title}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[detail.status]}`}>
                    {STATUS_LABEL[detail.status]}
                  </span>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-md rounded-lg px-3 py-2 text-sm ${
                        message.senderType === 'PARTNER' ? 'bg-gray-950 text-white' : 'ml-auto bg-blue-50 text-blue-900 border border-blue-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className={`mt-1 text-[11px] ${message.senderType === 'PARTNER' ? 'text-gray-300' : 'text-blue-400'}`}>
                        {SENDER_LABEL[message.senderType]} · {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
                {detail.status === 'CLOSED' ? (
                  <p className="text-xs text-gray-400">종료된 문의입니다 — 계속 문의하려면 새 문의를 등록해주세요.</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="답변을 기다리는 중이라도 추가로 물어볼 수 있습니다"
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
                    />
                    <Button size="sm" onClick={handleReply} disabled={isSubmitting || !replyDraft.trim()}>
                      <Send size={12} />
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleClose} disabled={isSubmitting}>
                      종료
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* widthClassName="max-w-lg" — 나란히 쓰는 "새 현장지원 요청" 팝업(OnsiteSupportRequestSection.tsx)과
          크기를 맞췄다(2026-09-12 사용자 요청). */}
      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="새 문의 등록" widthClassName="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
            <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} disabled={isSubmitting} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">문의 내용</label>
            <textarea
              value={createContent}
              onChange={(e) => setCreateContent(e.target.value)}
              disabled={isSubmitting}
              rows={5}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm hover:border-gray-400">
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !createTitle.trim() || !createContent.trim()}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
