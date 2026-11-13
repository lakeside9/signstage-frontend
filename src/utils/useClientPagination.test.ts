import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useClientPagination } from './useClientPagination';

const range = (count: number) => Array.from({ length: count }, (_, i) => i);

describe('useClientPagination', () => {
  it('목록을 페이지 크기만큼 나누고 다음 페이지 여부를 계산한다', () => {
    const { result } = renderHook(() => useClientPagination(range(45), 20));

    expect(result.current.pageItems).toEqual(range(20));
    expect(result.current.pagination).toMatchObject({ page: 0, totalPages: 3, hasNext: true, totalElements: 45 });

    act(() => result.current.pagination.onPageChange(2));
    expect(result.current.pageItems).toEqual([40, 41, 42, 43, 44]);
    expect(result.current.pagination.hasNext).toBe(false);
  });

  it('목록이 줄어 현재 페이지가 사라지면 마지막 페이지를 보여준다', () => {
    const { result, rerender } = renderHook(({ items }) => useClientPagination(items, 20), {
      initialProps: { items: range(45) },
    });
    act(() => result.current.pagination.onPageChange(2));

    rerender({ items: range(40) });
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.pageItems).toEqual(range(40).slice(20));
  });

  it('빈 목록이면 한 페이지로 본다', () => {
    const { result } = renderHook(() => useClientPagination<number>([], 20));

    expect(result.current.pageItems).toEqual([]);
    expect(result.current.pagination).toMatchObject({ page: 0, totalPages: 1, hasNext: false, totalElements: 0 });
  });
});
