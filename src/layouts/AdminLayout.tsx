import type { FC } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Key, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

/**
 * 지금은 헤더만 있는 최소 레이아웃이다. 화면이 늘어나면 사이드바 네비게이션을 추가한다.
 */
export const AdminLayout: FC = () => {
  const navigate = useNavigate();
  const platformAdmin = useAuthStore((state) => state.platformAdmin);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-950">
      <header className="h-16 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="bg-gray-950 p-1.5 rounded-lg text-white">
            <Key size={20} />
          </div>
          <span className="text-lg font-bold text-gray-950">SignStage</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
            <User size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{platformAdmin?.name ?? '관리자'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-950 transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
