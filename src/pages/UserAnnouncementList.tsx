import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { ChevronDown, ChevronUp, Megaphone, Pin } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SanitizedHtml } from '../components/SanitizedHtml';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { AnnouncementSummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

/**
 * 공지사항(파트너 쪽 조회) — signstage-docs business/partner-support-center-review.md 3.3절.
 * v1은 플랫폼 전체 공개만 지원한다(조직별 타겟팅 없음). 활성 공지만 고정 우선 + 최신순으로
 * 내려온다(서버가 이미 정렬). `content`는 관리자가 `HtmlEditor.tsx`로 작성한 HTML
 * 문자열이라 `SanitizedHtml.tsx`로 렌더링한다(2026-09-12 사용자 요청). 검색 영역과
 * 페이지네비게이션을 붙였다(2026-11-13).
 */
export const UserAnnouncementList: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [keywordInput, setKeywordInput] = useState('');
  // 검색할 때마다 새 객체로 바꿔 같은 검색어로 다시 눌러도 다시 조회한다(로딩 표시가 남지 않게).
  const [search, setSearch] = useState({ keyword: '' });
  const keyword = search.keyword;
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<AnnouncementSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = new URLSearchParams();
        if (keyword.trim()) query.set('keyword', keyword.trim());
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));
        const response = await api.get(`/announcements?${query.toString()}`);
        if (!cancelled) setPageData(response.data as PageResponse<AnnouncementSummary>);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '공지사항을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setSearch({ keyword: keywordInput });
  };

  const handleReset = () => {
    setIsLoading(true);
    setKeywordInput('');
    setPage(0);
    setSearch({ keyword: '' });
  };

  const announcements = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Megaphone size={20} className="text-gray-400" />
          공지사항
        </h1>
        <p className="mt-1 text-sm text-gray-500">플랫폼에서 안내하는 공지입니다.</p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="검색어" className="w-64">
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="제목 또는 내용"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          />
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={announcements.length === 0}
        emptyMessage={keyword.trim() ? '검색 결과가 없습니다.' : '등록된 공지사항이 없습니다.'}
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
        <div className="divide-y divide-gray-100">
          {announcements.map((announcement) => {
            const isOpen = openId === announcement.id;
            return (
              <div key={announcement.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : announcement.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-950">
                    {announcement.pinned && <Pin size={13} className="text-amber-500 shrink-0" />}
                    {announcement.title}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(announcement.createdAt)}</span>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </span>
                </button>
                {isOpen && <SanitizedHtml html={announcement.content} className="px-4 pb-4 text-sm text-gray-600" />}
              </div>
            );
          })}
        </div>
      </ListContainer>
    </div>
  );
};
