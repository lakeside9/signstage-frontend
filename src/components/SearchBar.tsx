import type { FC, FormEvent, ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';

interface SearchBarProps {
  onSubmit: (e: FormEvent) => void;
  onReset: () => void;
  children: ReactNode;
}

/**
 * 목록 화면 공통 검색 영역(상단). signstage-docs frontend/list-screen-convention.md의
 * "검색 영역 → 목록 → 페이지네비게이션" 3단 구조 중 첫 번째를 담당한다.
 *
 * 필드는 화면마다 다르므로 직접 만들지 않고 children으로 받는다 — {@link SearchField}로
 * 감싸서 넘기면 라벨 스타일이 통일된다. 검색/초기화 버튼은 이 컴포넌트가 고정으로 그린다.
 *
 * 검색은 입력할 때마다 조회하지 않고 "검색" 제출 시에만 적용한다 — 호출하는 화면에서
 * "폼에 입력 중인 값(draft)"과 "실제 조회에 쓰인 값(applied)"을 분리해서 관리하고,
 * onSubmit에서 draft를 applied로 반영해야 한다(AdminUserList.tsx 등 예시 참고).
 */
export const SearchBar: FC<SearchBarProps> = ({ onSubmit, onReset, children }) => (
  <form
    onSubmit={onSubmit}
    className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3"
  >
    {children}

    <div className="flex gap-2">
      <button
        type="submit"
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        <Search size={14} />
        검색
      </button>
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
      >
        <RotateCcw size={14} />
        초기화
      </button>
    </div>
  </form>
);

interface SearchFieldProps {
  label: string;
  /** 입력 폭 등을 조정할 때만 지정한다(예: "w-40"). 생략하면 내용에 맞춰 늘어난다. */
  className?: string;
  children: ReactNode;
}

/** {@link SearchBar} 안에서 개별 입력 하나를 감싸는 라벨+필드 단위. */
export const SearchField: FC<SearchFieldProps> = ({ label, className, children }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);
