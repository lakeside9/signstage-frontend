import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Loader2, Pin } from 'lucide-react';
import { SanitizedHtml } from '../../components/SanitizedHtml';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/internationalization';
import type { AnnouncementSummary } from '../../types';

/**
 * 공개 공지사항(`/notices`, 2026-11-13) — 관리자가 고객용으로 등록한 공지를 로그인 없이 본다. 고정 공지가 먼저 나오고,
 * 제목을 누르면 내용이 펼쳐진다. `?id=`로 들어오면 그 공지를 펼친 채로 연다.
 */
export const PublicNotices: FC = () => {
  const [urlParams] = useSearchParams();
  const linkedId = Number(urlParams.get('id')) || null;
  const [notices, setNotices] = useState<AnnouncementSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState<number | null>(linkedId);

  useEffect(() => {
    let cancelled = false;
    api.get('/public/announcements')
      .then((response) => {
        if (!cancelled) setNotices(response.data as AnnouncementSummary[]);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-14 sm:py-20">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-950">공지사항</h1>
          <p className="mt-3 text-sm sm:text-base text-gray-500">싸인스테이지 서비스 소식과 안내를 알려드립니다.</p>
        </div>

        <div className="mt-10">
          {loadFailed ? (
            <p className="py-16 text-center text-sm text-gray-500">공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
          ) : notices === null ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : notices.length === 0 ? (
            <p className="rounded-lg border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">
              등록된 공지사항이 없습니다.
            </p>
          ) : (
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {notices.map((notice) => {
                const isOpen = openId === notice.id;
                return (
                  <div key={notice.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : notice.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left"
                    >
                      {notice.pinned && <Pin size={14} className="shrink-0 text-gray-950" aria-label="고정 공지" />}
                      <span className="flex-1 text-sm font-bold text-gray-950">{notice.title}</span>
                      <span className="shrink-0 text-xs text-gray-400">{formatDate(notice.createdAt)}</span>
                      <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && <SanitizedHtml html={notice.content} className="px-5 pb-5 text-sm leading-relaxed text-gray-600" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
