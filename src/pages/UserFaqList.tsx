import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SanitizedHtml } from '../components/SanitizedHtml';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { FaqSummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

/**
 * FAQ(파트너 쪽 조회) — signstage-docs business/partner-support-center-review.md 4.3절.
 * 조직 스코프가 없는 전역 카탈로그 조회라 API는 카테고리별로 그룹핑하지 않은 평평한
 * 목록을 내려주고(9장 결정 #3), 카테고리별 그룹핑은 이 화면이 한다(지금 페이지 안에서). `answer`는
 * 관리자가 `HtmlEditor.tsx`로 작성한 HTML 문자열이라 `SanitizedHtml.tsx`로 렌더링한다
 * (2026-09-12 사용자 요청). 검색 영역과 페이지네비게이션을 붙였다(2026-11-13).
 */
export const UserFaqList: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [keywordInput, setKeywordInput] = useState('');
  // 검색할 때마다 새 객체로 바꿔 같은 검색어로 다시 눌러도 다시 조회한다(로딩 표시가 남지 않게).
  const [search, setSearch] = useState({ keyword: '' });
  const keyword = search.keyword;
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<FaqSummary> | null>(null);
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
        const response = await api.get(`/faqs?${query.toString()}`);
        if (!cancelled) setPageData(response.data as PageResponse<FaqSummary>);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : 'FAQ를 불러오지 못했습니다.', 'error');
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

  const faqs = pageData?.content ?? [];
  const groups = faqs.reduce<Record<string, FaqSummary[]>>((acc, faq) => {
    const key = faq.category ?? '일반';
    (acc[key] ??= []).push(faq);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <HelpCircle size={20} className="text-gray-400" />
          FAQ
        </h1>
        <p className="mt-1 text-sm text-gray-500">자주 묻는 질문을 모았습니다.</p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="검색어" className="w-64">
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="카테고리, 질문 또는 답변"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          />
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={faqs.length === 0}
        emptyMessage={keyword.trim() ? '검색 결과가 없습니다.' : '등록된 FAQ가 없습니다.'}
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
          {Object.entries(groups).map(([category, items]) => (
            <div key={category}>
              <h2 className="px-4 py-2 bg-gray-50 text-xs font-bold uppercase text-gray-400">{category}</h2>
              <div className="divide-y divide-gray-100">
                {items.map((faq) => {
                  const isOpen = openId === faq.id;
                  return (
                    <div key={faq.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : faq.id)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span className="text-sm font-medium text-gray-950">{faq.question}</span>
                        {isOpen ? (
                          <ChevronUp size={16} className="shrink-0 text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="shrink-0 text-gray-400" />
                        )}
                      </button>
                      {isOpen && <SanitizedHtml html={faq.answer} className="px-4 pb-4 text-sm text-gray-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ListContainer>
    </div>
  );
};
