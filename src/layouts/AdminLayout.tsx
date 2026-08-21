import { useState } from 'react';
import type { FC } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Building2,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  ShoppingCart,
  User,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const NAV_ITEMS = [
  { to: '/admin', end: true, icon: <LayoutDashboard size={20} />, label: '대시보드' },
  { to: '/admin/organizations', end: false, icon: <Building2 size={20} />, label: '조직 관리' },
  { to: '/admin/organization-requests', end: false, icon: <ClipboardCheck size={20} />, label: '조직 요청' },
  { to: '/admin/users', end: false, icon: <Users size={20} />, label: '회원 관리' },
  { to: '/admin/accounts', end: false, icon: <ShieldCheck size={20} />, label: '관리자 계정' },
  { to: '/admin/billing-catalog', end: false, icon: <Package size={20} />, label: '과금 카탈로그' },
  { to: '/admin/purchase-requests', end: false, icon: <ShoppingCart size={20} />, label: '추가구매 요청' },
  { to: '/admin/audit-logs', end: false, icon: <ClipboardList size={20} />, label: '감사 로그' },
  { to: '/admin/profile', end: false, icon: <User size={20} />, label: '내 정보' },
];

export const AdminLayout: FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const platformAdmin = useAuthStore((state) => state.platformAdmin);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col text-gray-950">
      <header className="h-16 shrink-0 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between px-4 z-30">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="bg-gray-950 p-1.5 rounded-lg text-white">
            <Key size={20} />
          </div>
          <span className="text-lg font-bold text-gray-950 hidden sm:block">SignStage</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
            <User size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{platformAdmin?.name ?? '관리자'}</span>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-950 transition-colors text-sm font-medium"
            title="일반 사용자 화면으로 전환합니다"
          >
            <ArrowLeftRight size={14} />
            <span className="hidden sm:block">일반 화면으로</span>
          </Link>
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
