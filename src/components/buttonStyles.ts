export type ButtonSize = 'md' | 'sm' | 'xs';

/**
 * 콘솔 화면 버튼 크기 표준(2026-11-13, 기존 eform 화면 기준) — 크기를 바꿀 때는 이 값만 고친다.
 * 직접 `<button>`을 쓰는 곳도 같은 문자열을 써서 맞춘다.
 */
export const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-sm font-bold rounded-lg',
  sm: 'px-3 py-2 text-xs font-bold rounded-lg',
  xs: 'px-2 py-1 text-xs font-medium rounded-md',
};
