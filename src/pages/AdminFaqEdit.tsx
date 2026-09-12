import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { FaqSummary, UpdateFaqRequest } from '../types';

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/**
 * FAQ 수정(`/admin/faqs/:faqId/edit`) — signstage-docs
 * business/partner-support-center-review.md 4장. 관리자 상세 조회(`GET .../faqs/{id}`)는
 * 활성 여부와 무관하게 반환한다 — 비활성 FAQ도 여기서 다시 활성화할 수 있어야 한다.
 */
export const AdminFaqEdit: FC = () => {
  const { faqId } = useParams<{ faqId: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/platform-admin/faqs/${faqId}`);
        if (cancelled) return;
        const data = response.data as FaqSummary;
        setCategory(data.category ?? '');
        setQuestion(data.question);
        setAnswer(data.answer);
        setActive(data.active);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : 'FAQ를 불러오지 못했습니다.', 'error');
          navigate('/admin/faqs', { replace: true });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faqId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/faqs/${faqId}`, {
        category: category.trim() || null,
        question: question.trim(),
        answer: answer.trim(),
        active,
      } satisfies UpdateFaqRequest);
      showSnackbar('FAQ를 수정했습니다.', 'success');
      navigate('/admin/faqs');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'FAQ 수정에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link to="/admin/faqs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} /> FAQ 관리로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">FAQ 수정</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isSaving}
              placeholder="선택 입력, 예: 결제/행사 운영"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">질문</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} disabled={isSaving} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">답변</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isSaving}
              rows={6}
              className={`${inputClass} resize-none`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={isSaving} />
            사용
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button to="/admin/faqs" variant="secondary">
              취소
            </Button>
            <Button type="submit" disabled={isSaving || !question.trim() || !answer.trim()}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
