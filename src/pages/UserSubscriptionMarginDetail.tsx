import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { OrganizationMarginPolicySection } from './organization/OrganizationMarginPolicySection';
import { OrganizationSubscriptionSection } from './organization/OrganizationSubscriptionSection';
import type { OrganizationSummary } from '../types';

/**
 * "구독·마진 관리" 상세(`/subscription-margin/:organizationId`) — `UserSubscriptionMarginList.tsx`
 * 참고. 이 화면은 조직 정보 자체(이름/언어 등)나 멤버 관리를 다루지 않는다 — 그건 여전히
 * "회사정보관리"(`UserOrganizationDetail.tsx`) 몫이다. 여기서는 헤더(조직 이름 + 내 역할)만
 * 가볍게 띄우고 `OrganizationSubscriptionSection`/`OrganizationMarginPolicySection` 두 컴포넌트를
 * 그대로 재사용한다 — 두 컴포넌트는 원래도 `organizationId`만 받아 자기 데이터를 알아서
 * 불러오는 독립 컴포넌트라 로직 변경이 전혀 없다. 두 섹션 다 내부적으로 OWNER 전용 권한
 * (`ACTION_MARGIN_POLICY_MANAGE` 등)이 없으면 섹션 자체를 숨기므로, OWNER가 아닌 멤버에게는
 * 이 화면이 비어 보일 수 있다 — 이 화면 자체를 메뉴에서 볼 수 있는지는 서버 메뉴 권한
 * (`MENU_ORG_SUBSCRIPTION_MARGIN`, OWNER만 허용)으로 먼저 걸러진다. 다만 메뉴가 안 보여도
 * URL을 직접 입력하면 여전히 들어올 수 있어(라우트 자체엔 접근 제어가 없다), 그 경로까지
 * 대비해 OWNER가 아니면 두 섹션 대신 안내 문구를 보여준다(signstage-docs
 * business/platform-admin-partner-ux-confusion-review.md 2.3절과 같은 원칙 — 빈 화면 대신
 * 이유를 알려준다).
 */
export const UserSubscriptionMarginDetail: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/organizations/${organizationId}`);
        if (!cancelled) {
          setOrganization(response.data as OrganizationSummary);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '조직 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate('/subscription-margin', { replace: true });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!organization || !organizationId) {
    return null;
  }

  return (
    <div>
      <Link
        to="/subscription-margin"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        구독·마진 관리로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Building2 size={20} className="text-gray-400" />
          {organization.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">내 역할: {organization.myRole}</p>
      </div>

      {organization.myRole === 'OWNER' ? (
        <>
          <OrganizationSubscriptionSection organizationId={organizationId} myRole={organization.myRole} />
          <OrganizationMarginPolicySection organizationId={organizationId} />
        </>
      ) : (
        <p className="mt-6 text-sm text-gray-500">이 화면은 OWNER만 볼 수 있습니다.</p>
      )}
    </div>
  );
};
