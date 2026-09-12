import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { HtmlEditor } from '../components/HtmlEditor';
import { isHtmlContentEmpty } from '../utils/htmlContent';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CreateFaqRequest } from '../types';

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/**
 * FAQ 등록(`/admin/faqs/new`) — signstage-docs business/partner-support-center-review.md 4장.
 * "답변"은 HTML 리치 텍스트 에디터(`HtmlEditor.tsx`)로 입력받는다(2026-09-12 사용자 요청) —
 * 저장 값은 `editor.getHTML()`이 그대로 들어간 HTML 문자열이고, 파트너 화면
 * (`UserFaqList.tsx`)이 그 HTML을 그대로 렌더링한다.
 */
export const AdminFaqCreate: FC = () => {
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isHtmlContentEmpty(answer)) return;
    setIsSaving(true);
    try {
      await api.post('/platform-admin/faqs', {
        category: category.trim() || null,
        question: question.trim(),
        answer: answer.trim(),
      } satisfies CreateFaqRequest);
      showSnackbar('FAQ를 등록했습니다.', 'success');
      navigate('/admin/faqs');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'FAQ 등록에 실패했습니다.', 'error');
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
        <h1 className="text-xl font-bold text-gray-950">FAQ 등록</h1>
        <p className="mt-1 text-sm text-gray-500">파트너 화면에 노출됩니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
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
          <HtmlEditor value={answer} onChange={setAnswer} disabled={isSaving} placeholder="답변 내용을 입력하세요" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button to="/admin/faqs" variant="secondary">
            취소
          </Button>
          <Button type="submit" disabled={isSaving || !question.trim() || isHtmlContentEmpty(answer)}>
            {isSaving ? '등록 중...' : '등록'}
          </Button>
        </div>
      </form>
    </div>
  );
};
