import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { ChevronDown, ChevronUp, Loader2, Megaphone, Pin } from 'lucide-react';
import { SanitizedHtml } from '../components/SanitizedHtml';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { AnnouncementSummary } from '../types';

/**
 * 공지사항(파트너 쪽 조회) — signstage-docs business/partner-support-center-review.md 3.3절.
 * v1은 플랫폼 전체 공개만 지원한다(조직별 타겟팅 없음). 활성 공지만 고정 우선 + 최신순으로
 * 내려온다(서버가 이미 정렬). `content`는 관리자가 `HtmlEditor.tsx`로 작성한 HTML
 * 문자열이라 `SanitizedHtml.tsx`로 렌더링한다(2026-09-12 사용자 요청).
 */
export const UserAnnouncementList: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [announcements, setAnnouncements] = useState<AnnouncementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/announcements');
        if (!cancelled) setAnnouncements(response.data as AnnouncementSummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '공지사항을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Megaphone size={20} className="text-gray-400" />
          공지사항
        </h1>
        <p className="mt-1 text-sm text-gray-500">플랫폼에서 안내하는 공지입니다.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">등록된 공지사항이 없습니다.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {announcements.map((announcement) => {
            const isOpen = openId === announcement.id;
            return (
              <div key={announcement.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : announcement.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-950">
                    {announcement.pinned && <Pin size={13} className="text-amber-500 shrink-0" />}
                    {announcement.title}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(announcement.createdAt)}</span>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </span>
                </button>
                {isOpen && <SanitizedHtml html={announcement.content} className="px-4 pb-4 text-sm text-gray-600" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
