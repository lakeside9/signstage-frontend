import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { NotificationSummary, PageResponse } from '../types';

const POLL_INTERVAL_MS = 60_000;

/**
 * 헤더 알림 — 읽지 않은 개수를 1분마다 확인하고, 누르면 최근 알림을 보여준다. 알림을 누르면 읽음으로
 * 바꾸고 연결된 화면으로 간다(signstage-docs business/platform-order-partner-subcontract-review.md 12장).
 */
export const NotificationBell: FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);

  const refreshCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount((response.data as { count: number }).count);
    } catch {
      // 알림 개수는 보조 정보라 실패해도 화면을 막지 않는다.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!cancelled) await refreshCount();
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const toggle = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    setIsLoading(true);
    try {
      const response = await api.get('/notifications?size=15');
      setNotifications((response.data as PageResponse<NotificationSummary>).content);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
    void refreshCount();
  };

  const open = async (notification: NotificationSummary) => {
    setIsOpen(false);
    if (!notification.read) {
      try {
        await api.post(`/notifications/${notification.id}/read`);
      } catch {
        // 읽음 처리에 실패해도 이동은 한다.
      }
      void refreshCount();
    }
    if (notification.linkPath) navigate(notification.linkPath);
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
      setUnreadCount(0);
    } catch {
      // 다음 확인 때 다시 맞춘다.
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative p-1.5 rounded-full text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-colors"
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}건 읽지 않음` : '알림'}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-[10px] font-bold leading-4 text-white text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg z-40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-950">알림</span>
            {notifications.some((notification) => !notification.read) && (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-950">
                <CheckCheck size={12} /> 모두 읽음
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="flex justify-center py-6 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">알림이 없습니다.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => open(notification)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${notification.read ? '' : 'bg-blue-50/50'}`}
                  >
                    <p className={`text-sm ${notification.read ? 'text-gray-700' : 'font-medium text-gray-950'}`}>{notification.title}</p>
                    {notification.message && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{notification.message}</p>}
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatDateTime(notification.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
