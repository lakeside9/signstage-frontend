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
 *
 * <p>onSubmit에서 draft를 applied로 반영할 때는 반드시 새 객체로 복사해서 넣어야 한다
 * (예: {@code setSearchParams({ ...formValues })}). draft(formValues)와 applied(searchParams)의
 * 초기값을 같은 상수 객체 참조로 두면, 아무 입력도 안 바꾼 채(또는 직전과 똑같은 조건으로)
 * "검색"을 누를 때 draft와 applied가 참조까지 같아져 React가 상태 변경으로 안 치고 넘어간다
 * — applied를 deps로 쓰는 조회 useEffect가 다시 안 돌아서, 이 컴포넌트가 막 켠 로딩
 * 스피너만 영원히 남는 채로 멈춘다(2026-08-25, 회원 관리 등 목록 화면 7곳에서 실제로 있었던
 * 버그 — 전부 이 방식으로 고쳤다).
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
