import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { AnnouncementSummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

interface SearchValues {
  keyword: string;
  active: 'ALL' | 'true' | 'false';
}

const EMPTY_SEARCH: SearchValues = { keyword: '', active: 'ALL' };

/**
 * 공지사항 관리(플랫폼 관리자) — signstage-docs business/partner-support-center-review.md 3장.
 * 목록/등록/수정 3화면으로 구성한다(2026-09-12 사용자 요청 — "회원관리처럼 페이지로
 * 구성해주세요"). 검색(키워드/사용여부)도 같은 날 후속 요청으로 추가했다. v1은 플랫폼
 * 전체 공개만 지원한다(조직별 타겟팅은 범위 밖).
 */
export const AdminAnnouncementList: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_ANNOUNCEMENT_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [formValues, setFormValues] = useState<SearchValues>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchValues>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<AnnouncementSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAnnouncements = async () => {
    const query = new URLSearchParams();
    if (searchParams.keyword.trim()) query.set('keyword', searchParams.keyword.trim());
    if (searchParams.active !== 'ALL') query.set('active', searchParams.active);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/platform-admin/announcements?${query.toString()}`);
    return response.data as PageResponse<AnnouncementSummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAnnouncements();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '공지사항 목록을 불러오지 못했습니다.', 'error');
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
      await api.delete(`/platform-admin/announcements/${deletingId}`);
      showSnackbar('공지사항을 삭제했습니다.', 'success');
      setDeletingId(null);
      setPageData(await fetchAnnouncements());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    }
  };

  const announcements = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Megaphone size={20} className="text-gray-400" />
            공지사항 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">파트너 화면에 노출되는 플랫폼 전체 공지입니다. 고정한 공지가 상단에 먼저 표시됩니다.</p>
        </div>
        {canManage && (
          <Button to="/admin/announcements/new">
            <Plus size={16} /> 공지 등록
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="검색어" className="w-56">
          <input
            value={formValues.keyword}
            onChange={(e) => setFormValues((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="제목 또는 내용"
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
        isEmpty={announcements.length === 0}
        emptyMessage="해당 조건의 공지사항이 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">제목</th>
              <th className="text-left px-4 py-3 font-medium">고정</th>
              <th className="text-left px-4 py-3 font-medium">사용여부</th>
              <th className="text-left px-4 py-3 font-medium">등록일</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {announcements.map((announcement) => (
              <tr key={announcement.id}>
                <td className="px-4 py-3 text-gray-950 font-medium">{announcement.title}</td>
                <td className="px-4 py-3 text-amber-500">{announcement.pinned && <Pin size={14} />}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                      announcement.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {announcement.active ? '사용' : '중지'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(announcement.createdAt)}</td>
                <td className="px-4 py-3">
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/admin/announcements/${announcement.id}/edit`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        <Pencil size={12} /> 수정
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeletingId(announcement.id)}
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
        title="공지사항 삭제"
        message="이 공지사항을 삭제합니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
