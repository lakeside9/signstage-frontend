import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Building2, PlayCircle, Plus } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { PlatformAdminOrganizationSummary } from '../types';

/**
 * 데모 행사 관리 진입점 — signstage-docs
 * business/demo-account-exhibition-signer-preview-review.md 11장(2026-09-09, 결정 번복).
 * 데모 조직(`isDemo=true`) 목록만 보여주고, "관리" 클릭 시 그 조직의 기존 행사 관리 화면
 * (`/ceremonies/:organizationId`, 조직 사용자용 `UserLayout` 화면군)으로 그대로 이동한다 —
 * 새 화면을 다시 만들지 않고 기존 화면을 재사용한다(11.4/11.6절, 재사용 시 조직 역할 권한은
 * `UserLayout`이 플랫폼 관리자 세션을 감지해 `/platform-admin/organizations/{id}/demo-permissions`로
 * 대신 조회한다).
 *
 * 조회는 `MENU_DEMO_CEREMONIES`로 PLATFORM_SUPPORT 이상 누구나 이 화면에 들어올 수 있지만,
 * "관리" 버튼을 눌러 실제로 행사를 만들고 제어하려면(백엔드 `findActiveMemberOrThrow` 우회가
 * `ACTION_DEMO_CEREMONY_MANAGE` 권한을 요구한다) PLATFORM_OPS 이상이어야 한다 — 이 화면에서는
 * 그 차이를 안내 문구로만 보여주고, 최종 판단은 항상 백엔드가 한다.
 */
export const AdminDemoCeremonies: FC = () => {
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_DEMO_CEREMONY_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/platform-admin/organizations/demo');
        if (!cancelled) setOrganizations(response.data as PlatformAdminOrganizationSummary[]);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '데모 조직 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <PlayCircle size={20} className="text-gray-400" />
            데모 행사 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            데모 조직의 행사를 플랫폼 관리자가 직접 생성·관리합니다. 문서 업로드, 서명자 등록, 하위 행사 제어까지
            "관리" 버튼을 눌러 그 조직의 행사 관리 화면으로 이동해서 진행합니다.
            {!canManage && ' 지금 등급(PLATFORM_SUPPORT)은 조회만 가능하고, 실제 관리는 PLATFORM_OPS 이상이 할 수 있습니다.'}
          </p>
        </div>
        {canManage && (
          <Link
            to="/admin/organizations/new"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
          >
            <Plus size={12} />
            데모 조직 만들기
          </Link>
        )}
      </div>

      <ListContainer isLoading={isLoading} isEmpty={organizations.length === 0} emptyMessage="등록된 데모 조직이 없습니다.">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium py-2 px-4">데모 조직</th>
              <th className="text-left font-medium py-2">코드</th>
              <th className="text-right font-medium py-2">생성일</th>
              <th className="text-right font-medium py-2 px-4">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {organizations.map((organization) => (
              <tr key={organization.id}>
                <td className="py-2 px-4 text-gray-950 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 size={14} className="text-gray-400" />
                    {organization.name}
                  </span>
                </td>
                <td className="py-2 text-gray-500">{organization.code}</td>
                <td className="py-2 text-right text-gray-500">{formatDateTime(organization.createdAt)}</td>
                <td className="py-2 px-4 text-right">
                  <Link
                    to={`/ceremonies/${organization.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
                  >
                    관리
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
