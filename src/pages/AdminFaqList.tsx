import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, HelpCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { FaqSummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

interface SearchValues {
  keyword: string;
  active: 'ALL' | 'true' | 'false';
}

const EMPTY_SEARCH: SearchValues = { keyword: '', active: 'ALL' };

/**
 * FAQ 관리(플랫폼 관리자) — signstage-docs business/partner-support-center-review.md 4장.
 * 목록/등록/수정 3화면으로 구성한다(2026-09-12 사용자 요청 — "회원관리처럼 페이지로
 * 구성해주세요"). 검색(키워드/사용여부)도 같은 날 후속 요청으로 추가했다 —
 * `CeremonyEffectManagement.tsx`와 같은 원칙으로, **검색 필터가 걸려 있으면 순서 이동을
 * 막는다**(위/아래 이동이 "지금 화면에 보이는 부분 목록"이 아니라 전체 목록 기준으로만
 * 의미가 있기 때문).
 */
export const AdminFaqList: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_FAQ_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [formValues, setFormValues] = useState<SearchValues>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchValues>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<FaqSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchFaqs = async () => {
    const query = new URLSearchParams();
    if (searchParams.keyword.trim()) query.set('keyword', searchParams.keyword.trim());
    if (searchParams.active !== 'ALL') query.set('active', searchParams.active);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/platform-admin/faqs?${query.toString()}`);
    return response.data as PageResponse<FaqSummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchFaqs();
        if (!cancelled) setPageData(data);
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

  const handleDelete = async () => {
    if (deletingId === null) return;
    try {
      await api.delete(`/platform-admin/faqs/${deletingId}`);
      showSnackbar('FAQ를 삭제했습니다.', 'success');
      setDeletingId(null);
      setPageData(await fetchFaqs());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    }
  };

  const canReorder = !searchParams.keyword.trim() && searchParams.active === 'ALL';
  const faqs = pageData?.content ?? [];

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (!canManage || !canReorder || isReordering || targetIndex < 0 || targetIndex >= faqs.length) return;
    setIsReordering(true);
    try {
      const reordered = [...faqs];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      await api.put('/platform-admin/faqs/order', {
        items: reordered.map((faq, i) => ({ id: faq.id, displayOrder: (i + 1) * 10 })),
      });
      setPageData(await fetchFaqs());
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

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="검색어" className="w-56">
          <input
            value={formValues.keyword}
            onChange={(e) => setFormValues((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="카테고리, 질문 또는 답변"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          />
        </SearchField>
        <SearchField label="사용여부">
          <select
            value={formValues.active}
            onChange={(e) => setFormValues((prev) => ({ ...prev, active: e.target.value as SearchValues['active'] }))}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          >
            <option value="ALL">전체</option>
            <option value="true">사용</option>
            <option value="false">중지</option>
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={faqs.length === 0}
        emptyMessage="해당 조건의 FAQ가 없습니다."
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
                      disabled={!canManage || !canReorder || isReordering || index === 0}
                      onClick={() => handleMove(index, -1)}
                      title={canReorder ? '위로 이동' : '검색어/사용여부 필터를 초기화해야 순서를 바꿀 수 있습니다.'}
                      className="p-1 rounded text-gray-400 hover:text-gray-950 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      {isReordering ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
                    </button>
                    <button
                      type="button"
                      disabled={!canManage || !canReorder || isReordering || index === faqs.length - 1}
                      onClick={() => handleMove(index, 1)}
                      title={canReorder ? '아래로 이동' : '검색어/사용여부 필터를 초기화해야 순서를 바꿀 수 있습니다.'}
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
