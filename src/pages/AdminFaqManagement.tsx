import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { ArrowDown, ArrowUp, HelpCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { FaqSummary, PageResponse } from '../types';

interface FormState {
  category: string;
  question: string;
  answer: string;
  active: boolean;
}

const EMPTY_FORM: FormState = { category: '', question: '', answer: '', active: true };

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/**
 * FAQ 관리(플랫폼 관리자) — signstage-docs business/partner-support-center-review.md 4장.
 * `CeremonyEffectDefinition`류처럼 목록/등록/수정 3화면으로 나누지 않고, 카탈로그 규모가
 * 작아(전 항목을 한 번에 불러와도 부담 없음) 이 한 화면 안에서 모달로 등록/수정을 처리한다 —
 * `PricePeriodManagerModal`과 같은 원칙. 순서는 위/아래 이동 버튼이 전체 목록을 다시
 * 인덱싱해 `PUT /order`로 통째로 보낸다(`UnitProduct` 목록과 같은 패턴).
 */
export const AdminFaqManagement: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_FAQ_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [faqs, setFaqs] = useState<FaqSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchFaqs = async () => {
    const response = await api.get('/platform-admin/faqs?size=200');
    setFaqs((response.data as PageResponse<FaqSummary>).content);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/platform-admin/faqs?size=200');
        if (!cancelled) setFaqs((response.data as PageResponse<FaqSummary>).content);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : 'FAQ 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalMode('create');
  };

  const openEdit = (faq: FaqSummary) => {
    setEditingId(faq.id);
    setForm({ category: faq.category ?? '', question: faq.question, answer: faq.answer, active: faq.active });
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) return;
    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        await api.post('/platform-admin/faqs', {
          category: form.category.trim() || null,
          question: form.question.trim(),
          answer: form.answer.trim(),
        });
        showSnackbar('FAQ를 등록했습니다.', 'success');
      } else if (modalMode === 'edit' && editingId !== null) {
        await api.put(`/platform-admin/faqs/${editingId}`, {
          category: form.category.trim() || null,
          question: form.question.trim(),
          answer: form.answer.trim(),
          active: form.active,
        });
        showSnackbar('FAQ를 수정했습니다.', 'success');
      }
      closeModal();
      await fetchFaqs();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    try {
      await api.delete(`/platform-admin/faqs/${deletingId}`);
      showSnackbar('FAQ를 삭제했습니다.', 'success');
      setDeletingId(null);
      await fetchFaqs();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (!canManage || isReordering || targetIndex < 0 || targetIndex >= faqs.length) return;
    setIsReordering(true);
    try {
      const reordered = [...faqs];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      await api.put('/platform-admin/faqs/order', {
        items: reordered.map((faq, i) => ({ id: faq.id, displayOrder: (i + 1) * 10 })),
      });
      await fetchFaqs();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '순서 변경에 실패했습니다.', 'error');
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <HelpCircle size={20} className="text-gray-400" />
            FAQ 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">파트너 화면에 노출되는 자주 묻는 질문 카탈로그입니다.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} /> FAQ 등록
          </Button>
        )}
      </div>

      <ListContainer isLoading={isLoading} isEmpty={faqs.length === 0} emptyMessage="등록된 FAQ가 없습니다.">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">순서</th>
              <th className="text-left px-4 py-3 font-medium">카테고리</th>
              <th className="text-left px-4 py-3 font-medium">질문</th>
              <th className="text-left px-4 py-3 font-medium">사용여부</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {faqs.map((faq, index) => (
              <tr key={faq.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={!canManage || isReordering || index === 0}
                      onClick={() => handleMove(index, -1)}
                      className="p-1 rounded text-gray-400 hover:text-gray-950 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      {isReordering ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
                    </button>
                    <button
                      type="button"
                      disabled={!canManage || isReordering || index === faqs.length - 1}
                      onClick={() => handleMove(index, 1)}
                      className="p-1 rounded text-gray-400 hover:text-gray-950 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{faq.category ?? '-'}</td>
                <td className="px-4 py-3 text-gray-950 font-medium">{faq.question}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                      faq.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {faq.active ? '사용' : '중지'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(faq)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        <Pencil size={12} /> 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(faq.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={12} /> 삭제
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <Modal open={modalMode !== null} onClose={closeModal} title={modalMode === 'create' ? 'FAQ 등록' : 'FAQ 수정'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              disabled={isSaving}
              placeholder="선택 입력, 예: 결제/행사 운영"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">질문</label>
            <input
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              disabled={isSaving}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">답변</label>
            <textarea
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              disabled={isSaving}
              rows={5}
              className={`${inputClass} resize-none`}
            />
          </div>
          {modalMode === 'edit' && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                disabled={isSaving}
              />
              사용
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm hover:border-gray-400">
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving || !form.question.trim() || !form.answer.trim()}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingId !== null}
        title="FAQ 삭제"
        message="이 FAQ를 삭제합니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
