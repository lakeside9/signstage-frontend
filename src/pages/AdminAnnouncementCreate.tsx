import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CreateAnnouncementRequest } from '../types';

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/** 공지사항 등록(`/admin/announcements/new`) — signstage-docs business/partner-support-center-review.md 3장. */
export const AdminAnnouncementCreate: FC = () => {
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSaving(true);
    try {
      await api.post('/platform-admin/announcements', {
        title: title.trim(),
        content: content.trim(),
        pinned,
      } satisfies CreateAnnouncementRequest);
      showSnackbar('공지사항을 등록했습니다.', 'success');
      navigate('/admin/announcements');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '공지사항 등록에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link to="/admin/announcements" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} /> 공지사항 관리로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">공지사항 등록</h1>
        <p className="mt-1 text-sm text-gray-500">파트너 화면에 노출됩니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-lg">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSaving}
            rows={7}
            className={`${inputClass} resize-none`}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} disabled={isSaving} />
          상단 고정
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button to="/admin/announcements" variant="secondary">
            취소
          </Button>
          <Button type="submit" disabled={isSaving || !title.trim() || !content.trim()}>
            {isSaving ? '등록 중...' : '등록'}
          </Button>
        </div>
      </form>
    </div>
  );
};
