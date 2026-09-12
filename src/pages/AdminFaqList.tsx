import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, HelpCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { FaqSummary, PageResponse } from '../types';

/**
 * FAQ 관리(플랫폼 관리자) — signstage-docs business/partner-support-center-review.md 4장.
 * 목록/등록/수정 3화면으로 구성한다(2026-09-12 사용자 요청 — "회원관리처럼 페이지로
 * 구성해주세요", 등록·수정을 모달로 처리하던 것을 페이지 전환으로 바꿨다). 순서는 위/아래
 * 이동 버튼이 전체 목록을 다시 인덱싱해 `PUT /order`로 통째로 보낸다(`UnitProduct` 목록과
 * 같은 패턴).
 */
export const AdminFaqList: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_FAQ_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [faqs, setFaqs] = useState<FaqSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
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
          <Button to="/admin/faqs/new">
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
                      <Link
                        to={`/admin/faqs/${faq.id}/edit`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        <Pencil size={12} /> 수정
                      </Link>
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
