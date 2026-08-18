import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  ClipboardCheck,
  FileSignature,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../utils/api';
import type { UserProfile } from '../types';

const NAV_ITEMS = [
  { to: '/org', end: true, icon: <LayoutDashboard size={20} />, label: '대시보드' },
  { to: '/org/organizations', end: false, icon: <Building2 size={20} />, label: '조직 관리' },
  { to: '/org/organization-requests', end: false, icon: <ClipboardCheck size={20} />, label: '조직 요청' },
  { to: '/org/ceremonies', end: false, icon: <FileSignature size={20} />, label: '행사 관리' },
  { to: '/org/profile', end: false, icon: <User size={20} />, label: '내 정보' },
];

/**
 * 일반 사용자(조직 소속 여부와 무관, `platformAdmin`이 없는 로그인)용 레이아웃 셸.
 * `AdminLayout`과 같은 header + left sidebar + content 구조를 그대로 따른다 — 두 화면군이
 * 로그인 상태를 공유하지만 진입 지점/메뉴가 다른 별개 셸이라는 점은 그대로다
 * (signstage-docs frontend/screen-composition-plan.md 2장).
 *
 * "조직 관리"(내가 속한 조직 + 정보 수정)와 "조직 요청"(생성 요청 제출 + 이력)을 별개 메뉴로
 * 분리했다 — 관심사가 다르기 때문이다(business/organization-creation-approval-review.md).
 * 나머지 화면군 B(멤버 관리 등)는 아직 없다.
 */
export const UserLayout: FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/identity/me');
        if (!cancelled) {
          setDisplayName((response.data as UserProfile).name);
        }
      } catch {
        // 헤더에 이름을 못 띄우는 정도라 실패해도 화면을 막지 않는다.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col text-gray-950">
      <header className="h-16 shrink-0 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between px-4 z-30">
        <Link to="/org" className="flex items-center gap-2">
          <div className="bg-gray-950 p-1.5 rounded-lg text-white">
            <Key size={20} />
          </div>
          <span className="text-lg font-bold text-gray-950 hidden sm:block">SignStage</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
            <User size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{displayName ?? '사용자'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-950 transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span className="hidden sm:block">로그아웃</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-20 flex flex-col ${
            isSidebarOpen ? 'w-64' : 'w-0 sm:w-20 overflow-hidden'
          }`}
        >
          <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isActive ? 'bg-gray-950 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <span className="shrink-0">{item.icon}</span>
                <span
                  className={`transition-opacity duration-300 whitespace-nowrap ${
                    isSidebarOpen ? 'opacity-100' : 'opacity-0 sm:hidden'
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((value) => !value)}
              className={`flex w-full items-center rounded-xl p-3 text-gray-600 transition-colors hover:bg-gray-100 ${
                isSidebarOpen ? 'justify-start gap-3' : 'justify-center'
              }`}
              title={isSidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
            >
              {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
              <span
                className={`whitespace-nowrap text-sm font-bold transition-opacity duration-300 ${
                  isSidebarOpen ? 'opacity-100' : 'hidden opacity-0'
                }`}
              >
                사이드바 접기
              </span>
            </button>
          </div>
        </aside>

        <main className="flex-1 min-h-0 overflow-auto">
          <div className="p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {!isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-10 sm:hidden" onClick={() => setIsSidebarOpen(true)} />
      )}
    </div>
  );
};
