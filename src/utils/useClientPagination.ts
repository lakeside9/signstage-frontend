import { useState } from 'react';
import type { PaginationProps } from '../components/Pagination';

export const CLIENT_PAGE_SIZE = 20;

/**
 * 서버가 목록 전체를 한 번에 주는(`PageResponse`가 아닌) 화면에서 브라우저가 페이지를 나눈다 —
 * signstage-docs frontend/list-screen-convention.md의 과금 카탈로그 예외와 같은 방식이다.
 * 목록이 줄어(삭제·필터) 현재 페이지가 범위를 벗어나면 마지막 페이지를 보여준다.
 * 필터가 바뀔 때는 호출하는 쪽에서 `resetPage()`로 첫 페이지로 되돌린다.
 */
export const useClientPagination = <T>(items: T[], pageSize = CLIENT_PAGE_SIZE) => {
  const [requestedPage, setRequestedPage] = useState(0);
  const totalElements = items.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const page = Math.min(requestedPage, totalPages - 1);

  const pagination: PaginationProps = {
    page,
    totalPages,
    hasNext: page < totalPages - 1,
    totalElements,
    onPageChange: setRequestedPage,
  };

  return {
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    pagination,
    resetPage: () => setRequestedPage(0),
  };
};
