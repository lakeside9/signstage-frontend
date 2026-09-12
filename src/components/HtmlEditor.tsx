import { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from 'lucide-react';

interface HtmlEditorProps {
  /** HTML 문자열. 빈 값이면 빈 에디터로 시작한다. */
  value: string;
  /** 내용이 바뀔 때마다 현재 HTML을 그대로 넘긴다(`editor.getHTML()`). */
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ToolbarButton: FC<{ onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: ReactNode }> = ({
  onClick,
  active,
  disabled,
  label,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      active ? 'bg-gray-950 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-950'
    }`}
  >
    {children}
  </button>
);

/**
 * 공지사항/FAQ의 "내용"/"답변" 입력에 쓰는 HTML 리치 텍스트 에디터(Tiptap 기반) — 2026-09-12
 * 사용자 요청("내용에 Html editor 를 적용해주세요"). 굵게/기울임/취소선, 제목 2단계, 목록
 * (순서 없음/있음), 인용, 링크, 되돌리기/다시하기만 지원하는 최소 툴바다 — 공지/FAQ 내용에
 * 필요한 서식은 이 정도면 충분하고, 표·이미지 등은 이 화면 용도에 과하다고 판단해 빼뒀다.
 *
 * `onChange`는 `editor.getHTML()`을 그대로 넘긴다 — 저장 시 이 문자열이 그대로
 * `content`/`answer` 필드에 들어가고, 파트너 화면(`UserAnnouncementList.tsx`/
 * `UserFaqList.tsx`)이 `dangerouslySetInnerHTML`(DOMPurify로 살균)로 그대로 렌더링한다.
 * 읽기 전용 렌더링과 이 에디터가 공유하는 스타일은 `index.css`의 `.rich-text-content`/
 * `.rich-text-editor`에 있다(별도 타이포그래피 플러그인을 새로 들이지 않고 최소 스타일만
 * 직접 정의).
 *
 * 외부에서 `value`가 바뀌어도(수정 화면이 처음 로드를 마쳤을 때 등) 에디터에 포커스가 없을
 * 때만 내용을 다시 채운다 — 타이핑 중에 매 렌더마다 `value`로 덮어쓰면 캐럿이 계속
 * 튀는 문제를 피한다.
 */
export const HtmlEditor: FC<HtmlEditorProps> = ({ value, onChange, disabled = false, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: updatedEditor }) => onChange(updatedEditor.getHTML()),
    editorProps: {
      attributes: { class: 'rich-text-content px-3 py-2 text-sm text-gray-950' },
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div className="rich-text-editor border border-gray-200 rounded-md focus-within:ring-2 focus-within:ring-gray-950/10 focus-within:border-gray-400">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-1.5 py-1">
        <ToolbarButton
          label="굵게"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={disabled}
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="기울임"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          disabled={disabled}
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="취소선"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          disabled={disabled}
        >
          <Strikethrough size={14} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <ToolbarButton
          label="제목 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
        >
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="제목 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          disabled={disabled}
        >
          <Heading3 size={14} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <ToolbarButton
          label="글머리 목록"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          disabled={disabled}
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="번호 목록"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          disabled={disabled}
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="인용"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          disabled={disabled}
        >
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="링크"
          onClick={() => {
            const url = window.prompt('연결할 URL을 입력하세요', editor.getAttributes('link').href ?? 'https://');
            if (url === null) return;
            if (url.trim() === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
          }}
          active={editor.isActive('link')}
          disabled={disabled}
        >
          <LinkIcon size={14} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <ToolbarButton
          label="되돌리기"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
        >
          <Undo size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="다시하기"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
        >
          <Redo size={14} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
