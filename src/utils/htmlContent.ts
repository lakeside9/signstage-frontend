/**
 * HTML 태그를 뺀 텍스트가 비어 있으면 true — 빈 에디터(`HtmlEditor.tsx`)는 `<p></p>`처럼
 * 태그만 남아있을 수 있어 `content.trim() === ''`로는 "비어 있음"을 판정할 수 없다. 공지사항/
 * FAQ 등록·수정 폼의 필수값 검사에 쓴다(2026-09-12 사용자 요청). `HtmlEditor.tsx`와 같은
 * 파일에 두지 않는다 — 비컴포넌트 값을 컴포넌트 파일에 같이 export하면 Vite Fast Refresh가
 * 그 파일을 컴포넌트 모듈로 취급하지 못해 `react-refresh/only-export-components` 린트
 * 규칙에 걸린다(billingCatalog/constants.ts와 같은 이유로 분리).
 */
export const isHtmlContentEmpty = (html: string) => html.replace(/<[^>]*>/g, '').trim() === '';
