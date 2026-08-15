import type { FC } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  /** 0부터 시작하는 현재 페이지. 백엔드 core.web.PageResponse.page와 동일한 규약이다. */
  page: number;
  totalPages: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  /** 전달하면 좌측에 "총 N건"을 함께 보여준다. */
  totalElements?: number;
  /** 가운데 페이지 번호 버튼을 최대 몇 개까지 보여줄지. 기본 5개. */
  maxVisiblePages?: number;
}

/**
 * `core.web.PageResponse<T>`를 쓰는 목록 화면에서 공통으로 쓰는 페이지 네비게이션이다.
 * signstage-docs backend/backend-coding-convention.md 10장의 페이지네이션 규약(0-base page)과 맞춘다.
 *
 * 사용 예:
 * ```tsx
 * <Pagination
 *   page={pageData.page}
 *   totalPages={pageData.totalPages}
 *   hasNext={pageData.hasNext}
 *   totalElements={pageData.totalElements}
 *   onPageChange={setPage}
 * />
 * ```
 */
export const Pagination: FC<PaginationProps> = ({
  page,
  totalPages,
  hasNext,
  onPageChange,
  totalElements,
  maxVisiblePages = 5,
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const windowStart = Math.max(0, Math.min(page - Math.floor(maxVisiblePages / 2), totalPages - maxVisiblePages));
  const windowEnd = Math.min(totalPages, windowStart + maxVisiblePages);
  const pageNumbers = Array.from({ length: windowEnd - windowStart }, (_, i) => windowStart + i);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        {typeof totalElements === 'number' ? `총 ${totalElements.toLocaleString()}건` : ''}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="이전 페이지"
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {windowStart > 0 && (
          <>
            <PageNumberButton pageNumber={0} isActive={false} onClick={() => onPageChange(0)} />
            {windowStart > 1 && <span className="px-1 text-gray-400">…</span>}
          </>
        )}

        {pageNumbers.map((pageNumber) => (
          <PageNumberButton
            key={pageNumber}
            pageNumber={pageNumber}
            isActive={pageNumber === page}
            onClick={() => onPageChange(pageNumber)}
          />
        ))}

        {windowEnd < totalPages && (
          <>
            {windowEnd < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
            <PageNumberButton
              pageNumber={totalPages - 1}
              isActive={false}
              onClick={() => onPageChange(totalPages - 1)}
            />
          </>
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label="다음 페이지"
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

const PageNumberButton: FC<{ pageNumber: number; isActive: boolean; onClick: () => void }> = ({
  pageNumber,
  isActive,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={isActive ? 'page' : undefined}
    className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors ${
      isActive ? 'bg-gray-950 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {pageNumber + 1}
  </button>
);
