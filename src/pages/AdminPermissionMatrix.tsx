import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PermissionMatrixRow } from '../types';

type RoleAxis = 'PLATFORM' | 'ORGANIZATION';

const AXIS_TABS: Array<{ value: RoleAxis; label: string }> = [
  { value: 'PLATFORM', label: '플랫폼 관리자 (PlatformRole)' },
  { value: 'ORGANIZATION', label: '조직 사용자 (MemberRole)' },
];

const ROLE_COLUMNS_BY_AXIS: Record<RoleAxis, string[]> = {
  PLATFORM: ['PLATFORM_SUPPORT', 'PLATFORM_OPS', 'PLATFORM_SUPER'],
  ORGANIZATION: ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'],
};

/**
 * 역할 × 권한키 매트릭스 관리 화면 — signstage-docs
 * business/menu-and-action-permission-management-review.md 7/10/11장. 접근 자체는 화면
 * 진입 시 서버가 다시 검증하지만(11장, PLATFORM_SUPER만 GET/PUT 허용), 주소창으로 직접 들어온
 * 비-SUPER 계정에게도 안내를 보여준다 — 최종 판단은 항상 백엔드가 한다(2.3절).
 *
 * 두 축(PLATFORM/ORGANIZATION)을 탭으로 전환해 같은 화면에서 관리한다(12장 결정 #2 —
 * 플랫폼 축을 먼저 시딩했고, 조직 축이 다음 단계로 이어졌다). 메뉴(`MENU`)와 액션(`ACTION`)
 * 권한이 같은 테이블·같은 토글 UI로 나온다(8장) — 무엇을 감싸는지만 다를 뿐 메커니즘은 같다.
 */
export const AdminPermissionMatrix: FC = () => {
  const { t } = useTranslation();
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const isSuper = currentPlatformRole === 'PLATFORM_SUPER';
  const [axis, setAxis] = useState<RoleAxis>('PLATFORM');
  const [rows, setRows] = useState<PermissionMatrixRow[]>([]);
  const [isLoading, setIsLoading] = useState(isSuper);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuper) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/platform-admin/permissions?axis=${axis}`);
        if (!cancelled) {
          setRows(response.data as PermissionMatrixRow[]);
        }
      } catch (err) {
        showSnackbar(err instanceof Error ? err.message : '권한 매트릭스를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, axis]);

  const toggleAllowed = async (row: PermissionMatrixRow, roleValue: string, nextAllowed: boolean) => {
    const cellKey = `${row.permissionDefinitionId}:${roleValue}`;
    setPendingKey(cellKey);
    try {
      await api.put(`/platform-admin/permissions/${row.permissionDefinitionId}?axis=${axis}`, {
        roleValue,
        allowed: nextAllowed,
      });
      setRows((prev) =>
        prev.map((item) =>
          item.permissionDefinitionId === row.permissionDefinitionId
            ? {
                ...item,
                roleAllowances: item.roleAllowances.map((allowance) =>
                  allowance.roleValue === roleValue ? { ...allowance, allowed: nextAllowed } : allowance
                ),
              }
            : item
        )
      );
      showSnackbar('권한 설정을 변경했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '권한 설정 변경에 실패했습니다.', 'error');
    } finally {
      setPendingKey(null);
    }
  };

  if (!isSuper) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-950">{t('permission.management')}</h1>
        <p className="mt-4 text-sm text-gray-500">PLATFORM_SUPER만 접근할 수 있는 화면입니다.</p>
      </div>
    );
  }

  const roleColumns = ROLE_COLUMNS_BY_AXIS[axis];
  const menuRows = rows.filter((row) => row.permissionType === 'MENU');
  const actionRows = rows.filter((row) => row.permissionType === 'ACTION');

  const renderTable = (title: string, description: string, tableRows: PermissionMatrixRow[]) => (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-950">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left font-medium py-2 px-4">권한키</th>
              {roleColumns.map((role) => (
                <th key={role} className="text-center font-medium py-2 px-4">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={roleColumns.length + 1} className="py-6 text-center text-gray-400">
                  등록된 항목이 없습니다.
                </td>
              </tr>
            ) : (
              tableRows.map((row) => (
                <tr key={row.permissionDefinitionId}>
                  <td className="py-2.5 px-4">
                    <div className="text-gray-950 font-medium">{t(row.labelKey, row.permissionKey)}</div>
                    <div className="text-xs text-gray-400">{row.permissionKey}</div>
                  </td>
                  {roleColumns.map((role) => {
                    const allowance = row.roleAllowances.find((item) => item.roleValue === role);
                    const allowed = allowance?.allowed ?? false;
                    const cellKey = `${row.permissionDefinitionId}:${role}`;
                    const isPending = pendingKey === cellKey;
                    return (
                      <td key={role} className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => toggleAllowed(row, role, !allowed)}
                          className={`inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                            allowed ? 'bg-gray-950' : 'bg-gray-200'
                          }`}
                          aria-label={`${row.permissionKey} - ${role}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              allowed ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-950">{t('permission.management')}</h1>
      <p className="mt-1 text-sm text-gray-500">
        역할별로 메뉴 노출과 주요 액션 허용 여부를 켜고 끕니다. 변경은 즉시 적용되며 변경 이력이
        남습니다. 배포 없이 새 권한키를 추가할 수는 없습니다.
      </p>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {AXIS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setAxis(tab.value);
              setIsLoading(true);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              axis === tab.value
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
        <>
          {renderTable('메뉴', '사이드바에 노출되는 메뉴 항목입니다.', menuRows)}
          {renderTable('액션', '화면 안 버튼/개별 행위 단위 권한입니다.', actionRows)}
        </>
      )}
    </div>
  );
};
