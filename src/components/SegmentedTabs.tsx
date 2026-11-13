/**
 * 콘솔 화면 탭 표준(2026-11-13) — 회색 상자 안에서 선택된 탭이 채워지는 상자형 탭. 모든 탭 묶음이 이 두 값을 써서
 * 크기와 모양을 맞춘다. 탭마다 색이 다른 곳(하위 행사 유형)은 `colorClass`로 선택/비선택 색만 바꾼다.
 */
export const SEGMENTED_TAB_GROUP_CLASS = 'mb-4 inline-flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-1';

export const segmentedTabClass = (isActive: boolean, colorClass?: { active: string; inactive: string }) =>
  `inline-flex items-center justify-center gap-1.5 min-w-28 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
    colorClass
      ? (isActive ? colorClass.active : colorClass.inactive)
      : (isActive ? 'bg-gray-950 text-white' : 'text-gray-500 hover:text-gray-950')
  }`;
