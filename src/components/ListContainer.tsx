import type { FC, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Pagination } from './Pagination';
import type { PaginationProps } from './Pagination';

interface ListContainerProps {
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  /** 아직 첫 조회 결과가 없으면(예: 로딩 중 처음 진입) 생략한다 — 그 프레임에는 페이지네비게이션을 그리지 않는다. */
  pagination?: PaginationProps;
  /** 로딩 중도 비어 있지도 않을 때 보여줄 목록 본문(대개 `<table>`). */
  children: ReactNode;
}

/**
 * 목록 화면 공통 본문 영역(목록 + 페이지네비게이션). signstage-docs
 * frontend/list-screen-convention.md의 "검색 영역 → 목록 → 페이지네비게이션" 3단 구조 중
 * 뒤 두 개를 한 컴포넌트로 묶는다 — 로딩/빈 목록/실제 목록 세 상태를 항상 같은 방식으로 보여주고,
 * 그 아래 {@link Pagination}을 붙인다.
 */
export const ListContainer: FC<ListContainerProps> = ({ isLoading, isEmpty, emptyMessage, pagination, children }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
    {isLoading ? (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    ) : isEmpty ? (
      <p className="py-16 text-center text-sm text-gray-500">{emptyMessage}</p>
    ) : (
      children
    )}

    {pagination && <Pagination {...pagination} />}
  </div>
);
