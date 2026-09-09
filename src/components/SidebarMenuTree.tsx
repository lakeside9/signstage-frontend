import { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { MenuNode } from '../types';

interface SidebarMenuTreeProps {
  nodes: MenuNode[];
  isSidebarOpen: boolean;
  iconFor: (iconKey: string | null) => ReactNode;
}

/**
 * `AdminLayout`/`UserLayout` 사이드바가 공유하는 메뉴 트리 렌더러 — signstage-docs
 * business/menu-and-action-permission-management-review.md 7.1절. 서버 `menus.parent_menu_id`가
 * 임의 깊이를 지원하고(관리 화면에서 들여쓰기/내어쓰기로 레벨을 옮길 수 있다), 사이드바도
 * 하드코딩된 한 단계가 아니라 실제로 재귀적으로 그려야 그 이동이 화면에 그대로 반영된다.
 *
 * 자식이 없는 노드는 바로 링크로, 자식이 있는 노드는 "설정"처럼 여닫는 그룹으로 그린다.
 * 그룹은 그 안에 현재 경로와 일치하는 항목이 있으면 자동으로 펼쳐진 채 시작한다.
 *
 * <p>펼침/접힘 상태는 "사용자가 이 그룹을 직접 건드린 적이 있는가"를 기준으로 판단한다
 * ({@code manualOpenById}) — 아무것도 안 건드렸으면 현재 경로 포함 여부로 자동 결정하고,
 * 한 번이라도 클릭했으면 그 이후로는 사용자가 정한 상태를 그대로 따른다. 이렇게 해야
 * "하위 메뉴가 선택된 채로도 상위 그룹을 접을 수 있어야 한다"(2026-09-09 사용자 요청)가
 * 성립한다 — 이전에는 `containsCurrentPath`가 무조건 펼침을 강제해서 활성 항목을 가진
 * 그룹은 절대 접을 수 없었다.
 */
export const SidebarMenuTree: FC<SidebarMenuTreeProps> = ({ nodes, isSidebarOpen, iconFor }) => {
  const location = useLocation();
  const [manualOpenById, setManualOpenById] = useState<Map<number, boolean>>(new Map());

  const containsCurrentPath = (node: MenuNode): boolean => {
    if (node.path && location.pathname.startsWith(node.path) && node.path !== '/') {
      return true;
    }
    if (node.path === '/' && location.pathname === '/') {
      return true;
    }
    return node.children.some(containsCurrentPath);
  };

  const toggle = (node: MenuNode) => {
    setManualOpenById((prev) => {
      const currentlyOpen = prev.has(node.id) ? (prev.get(node.id) as boolean) : containsCurrentPath(node);
      const next = new Map(prev);
      next.set(node.id, !currentlyOpen);
      return next;
    });
  };

  const renderNode = (node: MenuNode, depth: number): ReactNode => {
    const isChild = depth > 0;

    if (node.children.length === 0) {
      return (
        <NavLink
          key={node.id}
          to={node.path ?? '#'}
          end={node.path === '/' || node.path === '/admin'}
          className={({ isActive }) =>
            isChild
              ? `flex items-center gap-2.5 py-2 px-2.5 rounded-lg transition-all ${
                  isActive ? 'bg-gray-950 text-white font-bold' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`
              : `flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isActive ? 'bg-gray-950 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'
                }`
          }
        >
          <span className="shrink-0">{iconFor(node.iconKey)}</span>
          <span
            className={`transition-opacity duration-300 whitespace-nowrap ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 sm:hidden'
            }`}
          >
            {node.label}
          </span>
        </NavLink>
      );
    }

    const isActiveGroup = containsCurrentPath(node);
    const isOpen = manualOpenById.has(node.id) ? (manualOpenById.get(node.id) as boolean) : isActiveGroup;

    return (
      <div key={node.id} className={isOpen && isSidebarOpen ? 'rounded-xl bg-gray-50' : undefined}>
        <button
          type="button"
          onClick={() => toggle(node)}
          className={`flex w-full items-center gap-3 p-3 rounded-xl transition-all ${
            isActiveGroup ? 'text-gray-950 font-bold' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span className="shrink-0">{iconFor(node.iconKey)}</span>
          <span
            className={`flex-1 text-left font-semibold transition-opacity duration-300 whitespace-nowrap ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 sm:hidden'
            }`}
          >
            {node.label}
          </span>
          <span
            className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 sm:hidden'
            }`}
          >
            <ChevronDown size={16} />
          </span>
        </button>
        {isOpen && (
          <div
            className={
              isSidebarOpen
                ? 'ml-[27px] pl-3 border-l border-gray-200 space-y-1 pb-2 pr-2'
                : 'space-y-1 pb-2'
            }
          >
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return <div className="space-y-1.5">{nodes.map((node) => renderNode(node, 0))}</div>;
};
