import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Building2,
  Calculator,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Key,
  KeyRound,
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
import { usePermissionStore } from '../store/usePermissionStore';
import { api } from '../utils/api';
import { setInternationalizationPreferences } from '../utils/internationalization';
import type { MenuNode, UserProfile } from '../types';
import { useTranslation } from 'react-i18next';

/**
 * iconKey(서버 `menus.icon_key`) 문자열 → lucide 컴포넌트. 서버가 아는 아이콘 이름이 여기 없으면
 * 기본 아이콘으로 대체한다 — signstage-docs
 * business/menu-and-action-permission-management-review.md 7.1절.
 */
const ICON_BY_KEY: Record<string, ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={20} />,
  Building2: <Building2 size={20} />,
  ClipboardCheck: <ClipboardCheck size={20} />,
  Users: <Users size={20} />,
  ShieldCheck: <ShieldCheck size={20} />,
  Package: <Package size={20} />,
  Calculator: <Calculator size={20} />,
  ShoppingCart: <ShoppingCart size={20} />,
  ClipboardList: <ClipboardList size={20} />,
  User: <User size={20} />,
};

const iconFor = (iconKey: string | null) => (iconKey && ICON_BY_KEY[iconKey]) || <LayoutDashboard size={20} />;

/**
 * 권한 관리 화면 자체로 가는 메뉴는 의도적으로 서버 메뉴 트리(role_permissions)에 넣지 않고
 * PLATFORM_SUPER에게만 하드코딩으로 붙인다 — 자기 잠금(lockout) 방지(12장 결정 #6). `AdminLayout`이
 * `/admin/menus` 응답과 별개로 조건부 렌더링한다.
 */
const PERMISSION_MANAGEMENT_PATH = '/admin/permissions';

export const AdminLayout: FC = () => {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [, setInternationalizationVersion] = useState(0);
  const [menuNodes, setMenuNodes] = useState<MenuNode[]>([]);
  const navigate = useNavigate();
  const platformAdmin = useAuthStore((state) => state.platformAdmin);
  const logout = useAuthStore((state) => state.logout);
  const loadMyPermissions = usePermissionStore((state) => state.loadMyPermissions);

  useEffect(() => {
    api.get('/identity/me').then((response) => {
      const profile = response.data as UserProfile;
      setInternationalizationPreferences({
        languageCode: profile.languageCode,
        formatLocale: profile.locale,
        timeZoneId: profile.timeZoneId,
      });
      setInternationalizationVersion((value) => value + 1);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // 사이드바는 서버가 역할 기준으로 이미 걸러 응답한 메뉴 트리로 그린다 — 하드코딩된
    // NAV_ITEMS 배열을 두지 않는다(signstage-docs
    // business/menu-and-action-permission-management-review.md 10장).
    api.get('/platform-admin/menus').then((response) => {
      setMenuNodes(response.data as MenuNode[]);
    }).catch(() => undefined);
    loadMyPermissions();
  }, [loadMyPermissions]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    ...menuNodes.map((node) => ({
      to: node.path ?? '#',
      end: node.path === '/admin',
      icon: iconFor(node.iconKey),
      label: node.label,
    })),
    ...(platformAdmin?.platformRole === 'PLATFORM_SUPER'
      ? [{ to: PERMISSION_MANAGEMENT_PATH, end: false, icon: <KeyRound size={20} />, label: t('permission.management') }]
      : []),
  ];

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
            <span className="text-sm font-medium text-gray-700">{platformAdmin?.name ?? t('common.admin')}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-950 transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span className="hidden sm:block">{t('common.logout')}</span>
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
            {navItems.map((item) => (
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
              title={t(isSidebarOpen ? 'common.collapseSidebar' : 'common.expandSidebar')}
            >
              {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
              <span
                className={`whitespace-nowrap text-sm font-bold transition-opacity duration-300 ${
                  isSidebarOpen ? 'opacity-100' : 'hidden opacity-0'
                }`}
              >
                {t('common.collapseSidebar')}
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
