import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { AnnouncementSummary, PageResponse } from '../types';

interface FormState {
  title: string;
  content: string;
  pinned: boolean;
  active: boolean;
}

const EMPTY_FORM: FormState = { title: '', content: '', pinned: false, active: true };

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/**
 * 공지사항 관리(플랫폼 관리자) — signstage-docs business/partner-support-center-review.md 3장.
 * FAQ 관리와 같은 이유로 목록/등록/수정 3화면 대신 모달 기반 단일 화면으로 구성한다. v1은
 * 플랫폼 전체 공개만 지원한다(조직별 타겟팅은 범위 밖).
 */
export const AdminAnnouncementManagement: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_ANNOUNCEMENT_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [announcements, setAnnouncements] = useState<AnnouncementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAnnouncements = async () => {
    const response = await api.get('/platform-admin/announcements?size=200');
    setAnnouncements((response.data as PageResponse<AnnouncementSummary>).content);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/platform-admin/announcements?size=200');
        if (!cancelled) setAnnouncements((response.data as PageResponse<AnnouncementSummary>).content);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '공지사항 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalMode('create');
  };

  const openEdit = (announcement: AnnouncementSummary) => {
    setEditingId(announcement.id);
    setForm({ title: announcement.title, content: announcement.content, pinned: announcement.pinned, active: announcement.active });
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        await api.post('/platform-admin/announcements', {
          title: form.title.trim(), content: form.content.trim(), pinned: form.pinned,
        });
        showSnackbar('공지사항을 등록했습니다.', 'success');
      } else if (modalMode === 'edit' && editingId !== null) {
        await api.put(`/platform-admin/announcements/${editingId}`, {
          title: form.title.trim(), content: form.content.trim(), pinned: form.pinned, active: form.active,
        });
        showSnackbar('공지사항을 수정했습니다.', 'success');
      }
      closeModal();
      await fetchAnnouncements();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    try {
      await api.delete(`/platform-admin/announcements/${deletingId}`);
      showSnackbar('공지사항을 삭제했습니다.', 'success');
      setDeletingId(null);
      await fetchAnnouncements();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Megaphone size={20} className="text-gray-400" />
            공지사항 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">파트너 화면에 노출되는 플랫폼 전체 공지입니다. 고정한 공지가 상단에 먼저 표시됩니다.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} /> 공지 등록
          </Button>
        )}
      </div>

      <ListContainer isLoading={isLoading} isEmpty={announcements.length === 0} emptyMessage="등록된 공지사항이 없습니다.">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">제목</th>
              <th className="text-left px-4 py-3 font-medium">고정</th>
              <th className="text-left px-4 py-3 font-medium">사용여부</th>
              <th className="text-left px-4 py-3 font-medium">등록일</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {announcements.map((announcement) => (
              <tr key={announcement.id}>
                <td className="px-4 py-3 text-gray-950 font-medium">{announcement.title}</td>
                <td className="px-4 py-3 text-amber-500">{announcement.pinned && <Pin size={14} />}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                      announcement.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {announcement.active ? '사용' : '중지'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(announcement.createdAt)}</td>
                <td className="px-4 py-3">
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(announcement)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        <Pencil size={12} /> 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(announcement.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={12} /> 삭제
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <Modal open={modalMode !== null} onClose={closeModal} title={modalMode === 'create' ? '공지사항 등록' : '공지사항 수정'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={isSaving}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">내용</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              disabled={isSaving}
              rows={6}
              className={`${inputClass} resize-none`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              disabled={isSaving}
            />
            상단 고정
          </label>
          {modalMode === 'edit' && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                disabled={isSaving}
              />
              사용
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm hover:border-gray-400">
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving || !form.title.trim() || !form.content.trim()}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingId !== null}
        title="공지사항 삭제"
        message="이 공지사항을 삭제합니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
