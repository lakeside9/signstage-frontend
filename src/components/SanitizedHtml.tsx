import DOMPurify from 'dompurify';
import type { FC } from 'react';

interface SanitizedHtmlProps {
  /** `HtmlEditor.tsx`가 만든 HTML 문자열. */
  html: string;
  className?: string;
}

/**
 * 관리자가 `HtmlEditor.tsx`(Tiptap)로 작성한 HTML을 파트너 화면에 그대로 렌더링한다 —
 * 공지사항/FAQ 전용(2026-09-12 사용자 요청, "내용에 Html editor 를 적용해주세요"). 신뢰된
 * 플랫폼 관리자만 이 내용을 쓸 수 있지만(`ACTION_FAQ_MANAGE`/`ACTION_ANNOUNCEMENT_MANAGE`),
 * `dangerouslySetInnerHTML` 앞에 DOMPurify로 한 번 살균한다. 읽기 전용 렌더링 스타일은
 * `index.css`의 `.rich-text-content`(에디터 화면과 공유)에 있다.
 */
export const SanitizedHtml: FC<SanitizedHtmlProps> = ({ html, className }) => (
  <div
    className={`rich-text-content${className ? ` ${className}` : ''}`}
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
  />
);
