import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Loader2,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  User,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { MenuAdminRow } from '../types';

type RoleAxis = 'PLATFORM' | 'ORGANIZATION';

const AXIS_TABS: Array<{ value: RoleAxis; label: string }> = [
  { value: 'PLATFORM', label: '플랫폼 관리자 콘솔' },
  { value: 'ORGANIZATION', label: '조직 사용자 콘솔' },
];

/** 관리자가 임의 문자열을 넣어 렌더링이 깨지는 걸 막는다 — AdminLayout/UserLayout이 실제로 아는 아이콘만 고른다. */
const ICON_BY_KEY: Record<string, ReactNode> = {
  LayoutDashboard: <ClipboardList size={14} />,
  FileSignature: <FileSignature size={14} />,
  Settings: <Settings size={14} />,
  Building2: <Building2 size={14} />,
  User: <User size={14} />,
  Users: <Users size={14} />,
  ClipboardCheck: <ClipboardCheck size={14} />,
  ShieldCheck: <ShieldCheck size={14} />,
  Package: <Package size={14} />,
  Calculator: <Calculator size={14} />,
  ShoppingCart: <ShoppingCart size={14} />,
  ClipboardList: <ClipboardList size={14} />,
};
const ICON_OPTIONS = Object.keys(ICON_BY_KEY);
const iconFor = (iconKey: string) => ICON_BY_KEY[iconKey] ?? <span className="inline-block w-3.5" />;

interface TreeItem {
  row: MenuAdminRow;
  children: TreeItem[];
}

const buildTree = (rows: MenuAdminRow[]): TreeItem[] => {
  const byParent = rows.reduce<Record<string, MenuAdminRow[]>>((acc, row) => {
    const key = String(row.parentMenuId ?? 'root');
    (acc[key] ??= []).push(row);
    return acc;
  }, {});
  const toItems = (parentKey: string): TreeItem[] =>
    (byParent[parentKey] ?? [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((row) => ({ row, children: toItems(String(row.id)) }));
  return toItems('root');
};

interface Draft {
  label: string;
  path: string;
  iconKey: string;
  active: boolean;
}

const toDraft = (row: MenuAdminRow): Draft => ({
  label: row.label,
  path: row.path ?? '',
  iconKey: row.iconKey ?? '',
  active: row.active,
});

const isDirty = (row: MenuAdminRow, draft: Draft) =>
  draft.label !== row.label || draft.path !== (row.path ?? '') || draft.iconKey !== (row.iconKey ?? '') || draft.active !== row.active;

/**
 * 메뉴 구조(이름/경로/아이콘/순서/사용여부) 관리 화면 — signstage-docs
 * business/menu-and-action-permission-management-review.md 7.1/12장 결정 #10(2026-09-05,
 * 이름/경로/순서까지 편집 허용). `AdminPermissionMatrix`와 같은 이유로 접근은 서버가 다시
 * 검증하지만(PLATFORM_SUPER 전용), 안내 화면을 먼저 보여준다.
 *
 * 좌측 트리(부모-자식 계층, 펼치기/접기) + 우측 편집 패널 구조다. 순서는 숫자를 직접 입력하는
 * 대신 형제 사이 위/아래 이동 버튼으로 바꾼다 — 서명자/문서 양식 순서 편집(UserCeremonyDetail/
 * UserTemplateDetail)과 같은 패턴.
 */
export const AdminMenuManager: FC = () => {
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const isSuper = currentPlatformRole === 'PLATFORM_SUPER';
  const [console_, setConsole] = useState<RoleAxis>('PLATFORM');
  const [rows, setRows] = useState<MenuAdminRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(isSuper);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isSuper) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/platform-admin/menus/admin?console=${console_}`);
        if (!cancelled) {
          const data = response.data as MenuAdminRow[];
          setRows(data);
          setDrafts(Object.fromEntries(data.map((row) => [row.id, toDraft(row)])));
          setExpandedIds(new Set(data.filter((row) => row.parentMenuId === null).map((row) => row.id)));
          setSelectedId(data.find((row) => row.parentMenuId === null)?.id ?? null);
        }
      } catch (err) {
        showSnackbar(err instanceof Error ? err.message : '메뉴 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, console_]);

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateDraft = (rowId: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [rowId]: { ...prev[rowId], ...patch } }));
  };

  const handleSave = async (row: MenuAdminRow) => {
    const draft = drafts[row.id];
    setSavingId(row.id);
    try {
      await api.put(`/platform-admin/menus/${row.id}`, {
        // 실제로 바뀐 경우에만 label을 보낸다 — 그대로 보내면 매번 menu_translation_histories에
        // 같은 값 스냅샷이 또 쌓인다(백엔드는 label이 있으면 항상 저장한다).
        label: draft.label !== row.label ? draft.label : null,
        // 이 화면(편집 폼)은 레벨을 바꾸지 않는다 — 상위 메뉴는 들여쓰기/내어쓰기 버튼 전용이다.
        parentMenuId: row.parentMenuId,
        path: draft.path.trim() === '' ? null : draft.path.trim(),
        iconKey: draft.iconKey === '' ? null : draft.iconKey,
        displayOrder: row.displayOrder,
        active: draft.active,
      });
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? { ...item, label: draft.label, path: draft.path || null, iconKey: draft.iconKey || null, active: draft.active }
            : item
        )
      );
      showSnackbar('메뉴를 수정했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '메뉴 수정에 실패했습니다.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  /** 같은 부모를 둔 형제끼리 표시 순서를 맞바꾼다 — 그 둘의 저장된 값만 바꾸고 draft는 건드리지 않는다. */
  const handleMove = async (row: MenuAdminRow, direction: -1 | 1) => {
    const siblings = rows
      .filter((item) => item.parentMenuId === row.parentMenuId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex((item) => item.id === row.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    const other = siblings[targetIndex];

    setMovingId(row.id);
    try {
      await api.put(`/platform-admin/menus/${row.id}`, {
        label: null, parentMenuId: row.parentMenuId, path: row.path, iconKey: row.iconKey,
        displayOrder: other.displayOrder, active: row.active,
      });
      await api.put(`/platform-admin/menus/${other.id}`, {
        label: null, parentMenuId: other.parentMenuId, path: other.path, iconKey: other.iconKey,
        displayOrder: row.displayOrder, active: other.active,
      });
      setRows((prev) =>
        prev.map((item) => {
          if (item.id === row.id) return { ...item, displayOrder: other.displayOrder };
          if (item.id === other.id) return { ...item, displayOrder: row.displayOrder };
          return item;
        })
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '순서 변경에 실패했습니다.', 'error');
    } finally {
      setMovingId(null);
    }
  };

  /**
   * 들여쓰기 — 바로 위 형제의 마지막 하위 메뉴로 편입한다(문서 편집기의 Tab과 같은 동작).
   * 맨 처음 형제는 위에 아무도 없어 들여쓸 수 없다.
   */
  const handleIndent = async (row: MenuAdminRow) => {
    const siblings = rows
      .filter((item) => item.parentMenuId === row.parentMenuId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex((item) => item.id === row.id);
    if (index <= 0) return;
    const newParent = siblings[index - 1];
    const newSiblings = rows.filter((item) => item.parentMenuId === newParent.id);
    const newDisplayOrder = newSiblings.length === 0 ? 0 : Math.max(...newSiblings.map((item) => item.displayOrder)) + 1;

    setMovingId(row.id);
    try {
      await api.put(`/platform-admin/menus/${row.id}`, {
        label: null, parentMenuId: newParent.id, path: row.path, iconKey: row.iconKey,
        displayOrder: newDisplayOrder, active: row.active,
      });
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, parentMenuId: newParent.id, displayOrder: newDisplayOrder } : item))
      );
      setExpandedIds((prev) => new Set(prev).add(newParent.id));
      showSnackbar('메뉴를 하위로 옮겼습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '메뉴 이동에 실패했습니다.', 'error');
    } finally {
      setMovingId(null);
    }
  };

  /**
   * 내어쓰기 — 지금 속한 상위 메뉴와 같은 레벨(그 상위 메뉴의 형제)로 올린다(Shift+Tab과 같은
   * 동작). 이미 최상위면 더 올릴 곳이 없다.
   */
  const handleOutdent = async (row: MenuAdminRow) => {
    if (row.parentMenuId === null) return;
    const currentParent = rows.find((item) => item.id === row.parentMenuId);
    const newParentId = currentParent?.parentMenuId ?? null;
    const newSiblings = rows.filter((item) => item.parentMenuId === newParentId && item.id !== row.id);
    const newDisplayOrder = newSiblings.length === 0 ? 0 : Math.max(...newSiblings.map((item) => item.displayOrder)) + 1;

    setMovingId(row.id);
    try {
      await api.put(`/platform-admin/menus/${row.id}`, {
        label: null, parentMenuId: newParentId, path: row.path, iconKey: row.iconKey,
        displayOrder: newDisplayOrder, active: row.active,
      });
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, parentMenuId: newParentId, displayOrder: newDisplayOrder } : item))
      );
      showSnackbar('메뉴를 상위로 옮겼습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '메뉴 이동에 실패했습니다.', 'error');
    } finally {
      setMovingId(null);
    }
  };

  if (!isSuper) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-950">메뉴 관리</h1>
        <p className="mt-4 text-sm text-gray-500">PLATFORM_SUPER만 접근할 수 있는 화면입니다.</p>
      </div>
    );
  }

  const tree = buildTree(rows);
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const selectedDraft = selectedRow ? drafts[selectedRow.id] : null;
  const siblingsOfSelected = selectedRow
    ? rows.filter((row) => row.parentMenuId === selectedRow.parentMenuId).sort((a, b) => a.displayOrder - b.displayOrder)
    : [];
  const selectedSiblingIndex = selectedRow ? siblingsOfSelected.findIndex((row) => row.id === selectedRow.id) : -1;

  const renderTreeItem = (item: TreeItem, depth: number): ReactNode => {
    const hasChildren = item.children.length > 0;
    const isExpanded = expandedIds.has(item.row.id);
    const isSelected = item.row.id === selectedId;
    return (
      <div key={item.row.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedId(item.row.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedId(item.row.id)}
          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-left transition-colors cursor-pointer ${
            isSelected ? 'bg-gray-950 text-white font-medium' : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.row.id);
              }}
              className={`shrink-0 rounded p-0.5 ${isSelected ? 'hover:bg-white/20' : 'hover:bg-gray-200'}`}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <span className={isSelected ? 'text-white' : 'text-gray-400'}>{iconFor(item.row.iconKey ?? '')}</span>
          <span className="truncate flex-1">{item.row.label}</span>
          {!item.row.active && (
            <span className={`shrink-0 text-[10px] rounded px-1 ${isSelected ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>
              비활성
            </span>
          )}
        </div>
        {hasChildren && isExpanded && item.children.map((child) => renderTreeItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-950">메뉴 관리</h1>
      <p className="mt-1 text-sm text-gray-500">
        사이드바 메뉴의 이름·경로·아이콘·표시 순서·사용여부를 편집합니다. 메뉴 자체를
        새로 만들거나 삭제할 수는 없습니다(배포로만 등록) — 노출 여부(어떤 역할이 볼 수
        있는지)는 <span className="font-medium text-gray-700">권한 관리</span> 화면에서 설정합니다.
      </p>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {AXIS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setConsole(tab.value);
              setIsLoading(true);
              setSelectedId(null);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              console_ === tab.value
                ? 'border-gray-950 text-gray-950'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="mt-6 flex gap-4 items-start">
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-lg p-2">
            {tree.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">메뉴가 없습니다.</p>
            ) : (
              tree.map((item) => renderTreeItem(item, 0))
            )}
          </div>

          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-5">
            {!selectedRow || !selectedDraft ? (
              <p className="text-sm text-gray-400">왼쪽 트리에서 메뉴를 선택하세요.</p>
            ) : (
              <div className="max-w-md space-y-4">
                <div>
                  <div className="text-xs text-gray-400">{selectedRow.menuKey}</div>
                  <div className="text-xs text-gray-400">{selectedRow.labelKey}</div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
                  <input
                    type="text"
                    value={selectedDraft.label}
                    onChange={(e) => updateDraft(selectedRow.id, { label: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">경로</label>
                  <input
                    type="text"
                    value={selectedDraft.path}
                    onChange={(e) => updateDraft(selectedRow.id, { path: e.target.value })}
                    placeholder="(그룹 메뉴 — 경로 없음)"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">아이콘</label>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded-md text-gray-600">
                      {iconFor(selectedDraft.iconKey)}
                    </span>
                    <select
                      value={selectedDraft.iconKey}
                      onChange={(e) => updateDraft(selectedRow.id, { iconKey: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                    >
                      <option value="">(없음)</option>
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">표시 순서(형제 사이)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMove(selectedRow, -1)}
                      disabled={selectedSiblingIndex <= 0 || movingId !== null}
                      title="위로 이동"
                      className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(selectedRow, 1)}
                      disabled={selectedSiblingIndex === -1 || selectedSiblingIndex >= siblingsOfSelected.length - 1 || movingId !== null}
                      title="아래로 이동"
                      className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <span className="text-xs text-gray-400">
                      {selectedSiblingIndex + 1} / {siblingsOfSelected.length}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">레벨(상위 메뉴)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOutdent(selectedRow)}
                      disabled={selectedRow.parentMenuId === null || movingId !== null}
                      title="상위로 이동(내어쓰기)"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 text-xs"
                    >
                      <ChevronsLeft size={14} />
                      상위로
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIndent(selectedRow)}
                      disabled={selectedSiblingIndex <= 0 || movingId !== null}
                      title="바로 위 메뉴의 하위로 편입(들여쓰기)"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 text-xs"
                    >
                      하위로
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {selectedSiblingIndex > 0
                      ? `"하위로"를 누르면 "${siblingsOfSelected[selectedSiblingIndex - 1].label}" 밑으로 들어갑니다.`
                      : '바로 위 형제가 없어 하위로 편입할 수 없습니다.'}
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedDraft.active}
                    onChange={(e) => updateDraft(selectedRow.id, { active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  사용함(사이드바에 노출)
                </label>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!isDirty(selectedRow, selectedDraft) || savingId === selectedRow.id}
                    onClick={() => handleSave(selectedRow)}
                    className="px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    저장
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
