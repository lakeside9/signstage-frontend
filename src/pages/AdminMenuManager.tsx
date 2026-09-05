import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { GripVertical, Loader2 } from 'lucide-react';
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
const ICON_OPTIONS = [
  'LayoutDashboard', 'FileSignature', 'Settings', 'Building2', 'User', 'Users',
  'ClipboardCheck', 'ShieldCheck', 'Package', 'Calculator', 'ShoppingCart', 'ClipboardList',
];

interface Draft {
  label: string;
  path: string;
  iconKey: string;
  displayOrder: number;
  active: boolean;
}

const toDraft = (row: MenuAdminRow): Draft => ({
  label: row.label,
  path: row.path ?? '',
  iconKey: row.iconKey ?? '',
  displayOrder: row.displayOrder,
  active: row.active,
});

const isDirty = (row: MenuAdminRow, draft: Draft) =>
  draft.label !== row.label ||
  draft.path !== (row.path ?? '') ||
  draft.iconKey !== (row.iconKey ?? '') ||
  draft.displayOrder !== row.displayOrder ||
  draft.active !== row.active;

/**
 * 메뉴 구조(이름/경로/아이콘/순서/사용여부) 관리 화면 — signstage-docs
 * business/menu-and-action-permission-management-review.md 7.1/12장 결정 #10(2026-09-05,
 * 이름/경로/순서까지 편집 허용). `AdminPermissionMatrix`와 같은 이유로 접근은 서버가 다시
 * 검증하지만(PLATFORM_SUPER 전용), 안내 화면을 먼저 보여준다.
 *
 * 부모가 없는 메뉴를 먼저, 그 아래 자식을 들여쓰기로 붙이는 순서로 나열한다 — 실제 사이드바에
 * 그려지는 순서와 같다. "설정"처럼 경로가 없는 그룹 메뉴도 이름/아이콘/순서는 그대로 편집
 * 가능하다(경로 칸은 비워둔다).
 */
export const AdminMenuManager: FC = () => {
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const isSuper = currentPlatformRole === 'PLATFORM_SUPER';
  const [console_, setConsole] = useState<RoleAxis>('PLATFORM');
  const [rows, setRows] = useState<MenuAdminRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [isLoading, setIsLoading] = useState(isSuper);
  const [savingId, setSavingId] = useState<number | null>(null);

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
        path: draft.path.trim() === '' ? null : draft.path.trim(),
        iconKey: draft.iconKey === '' ? null : draft.iconKey,
        displayOrder: draft.displayOrder,
        active: draft.active,
      });
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? { ...item, label: draft.label, path: draft.path || null, iconKey: draft.iconKey || null, displayOrder: draft.displayOrder, active: draft.active }
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

  if (!isSuper) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-950">메뉴 관리</h1>
        <p className="mt-4 text-sm text-gray-500">PLATFORM_SUPER만 접근할 수 있는 화면입니다.</p>
      </div>
    );
  }

  // 부모(부모 없는 메뉴 먼저) 아래 자식을 순서대로 붙인다 — 사이드바에 그려지는 순서와 같다.
  const topLevel = rows.filter((row) => row.parentMenuId === null).sort((a, b) => a.displayOrder - b.displayOrder);
  const childrenByParent = rows.reduce<Record<number, MenuAdminRow[]>>((acc, row) => {
    if (row.parentMenuId !== null) {
      (acc[row.parentMenuId] ??= []).push(row);
    }
    return acc;
  }, {});
  const orderedRows = topLevel.flatMap((parent) => [
    { row: parent, depth: 0 },
    ...(childrenByParent[parent.id] ?? [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((child) => ({ row: child, depth: 1 })),
  ]);

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
        <div className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-medium py-2 px-4">메뉴</th>
                  <th className="text-left font-medium py-2 px-4 w-56">경로</th>
                  <th className="text-left font-medium py-2 px-4 w-40">아이콘</th>
                  <th className="text-center font-medium py-2 px-4 w-20">순서</th>
                  <th className="text-center font-medium py-2 px-4 w-20">사용</th>
                  <th className="text-right font-medium py-2 px-4 w-24">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orderedRows.map(({ row, depth }) => {
                  const draft = drafts[row.id];
                  if (!draft) return null;
                  const dirty = isDirty(row, draft);
                  return (
                    <tr key={row.id}>
                      <td className="py-2 px-4">
                        <div className={depth > 0 ? 'ml-6 flex items-center gap-1.5' : 'flex items-center gap-1.5'}>
                          {depth > 0 && <GripVertical size={12} className="text-gray-300 shrink-0" />}
                          <div>
                            <input
                              type="text"
                              value={draft.label}
                              onChange={(e) => updateDraft(row.id, { label: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                            />
                            <div className="text-xs text-gray-400 mt-0.5">{row.menuKey}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={draft.path}
                          onChange={(e) => updateDraft(row.id, { path: e.target.value })}
                          placeholder="(그룹 메뉴 — 경로 없음)"
                          className="w-full px-2 py-1 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <select
                          value={draft.iconKey}
                          onChange={(e) => updateDraft(row.id, { iconKey: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                        >
                          <option value="">(없음)</option>
                          {ICON_OPTIONS.map((icon) => (
                            <option key={icon} value={icon}>
                              {icon}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          value={draft.displayOrder}
                          onChange={(e) => updateDraft(row.id, { displayOrder: Number(e.target.value) })}
                          className="w-16 px-2 py-1 border border-gray-200 rounded-md text-sm text-center focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) => updateDraft(row.id, { active: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button
                          type="button"
                          disabled={!dirty || savingId === row.id}
                          onClick={() => handleSave(row)}
                          className="px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          저장
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
