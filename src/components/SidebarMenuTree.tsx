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
 */
export const SidebarMenuTree: FC<SidebarMenuTreeProps> = ({ nodes, isSidebarOpen, iconFor }) => {
  const location = useLocation();
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const containsCurrentPath = (node: MenuNode): boolean => {
    if (node.path && location.pathname.startsWith(node.path) && node.path !== '/') {
      return true;
    }
    if (node.path === '/' && location.pathname === '/') {
      return true;
    }
    return node.children.some(containsCurrentPath);
  };

  const renderNode = (node: MenuNode, depth: number): ReactNode => {
    const paddingLeft = depth === 0 ? undefined : `${depth * 20 + 12}px`;

    if (node.children.length === 0) {
      return (
        <NavLink
          key={node.id}
          to={node.path ?? '#'}
          end={node.path === '/' || node.path === '/admin'}
          style={paddingLeft ? { paddingLeft } : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 p-3 rounded-xl transition-all ${
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

    const isOpen = openIds.has(node.id) || containsCurrentPath(node);
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => toggle(node.id)}
          style={paddingLeft ? { paddingLeft } : undefined}
          className={`flex w-full items-center gap-3 p-3 rounded-xl transition-all ${
            containsCurrentPath(node) ? 'text-gray-950 font-bold' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="shrink-0">{iconFor(node.iconKey)}</span>
          <span
            className={`flex-1 text-left transition-opacity duration-300 whitespace-nowrap ${
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
        {isOpen && <div className="space-y-2 mt-2">{node.children.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return <div className="space-y-2">{nodes.map((node) => renderNode(node, 0))}</div>;
};
