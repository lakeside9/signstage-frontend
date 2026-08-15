import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Loader2, Users } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type { OrganizationStatus, PlatformAdminOrganizationSummary } from '../types';

const STATUS_BADGE_CLASS: Record<OrganizationStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  TRIAL: 'bg-amber-50 text-amber-700 border-amber-200',
};

/**
 * 조직 상세 화면. `GET /api/platform-admin/organizations/{organizationId}`를 그대로 보여준다.
 * 상태 변경(정지/재개)은 PLATFORM_OPS 이상만 가능하다.
 * signstage-docs business/platform-admin-member-management.md 참고.
 */
export const AdminOrganizationDetail: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<PlatformAdminOrganizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/platform-admin/organizations/${organizationId}`);
        if (!cancelled) {
          setOrganization(response.data as PlatformAdminOrganizationSummary);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '조직 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate('/', { replace: true });
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

  const handleChangeStatus = async (status: 'ACTIVE' | 'SUSPENDED') => {
    setIsProcessing(true);
    try {
      const response = await api.put(`/platform-admin/organizations/${organizationId}/status`, { status });
      setOrganization(response.data as PlatformAdminOrganizationSummary);
      showSnackbar(status === 'ACTIVE' ? '조직을 재개했습니다.' : '조직을 정지했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        조직 목록으로
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Building2 size={20} className="text-gray-400" />
            {organization.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">조직 상세 정보</p>
        </div>
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[organization.status]}`}
        >
          {organization.status}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        <DetailRow icon={<Building2 size={16} />} label="조직 이름" value={organization.name} />
        <DetailRow label="조직 코드" value={organization.code} />
        <DetailRow icon={<Globe size={16} />} label="기본 언어" value={organization.defaultLocale} />
        <DetailRow icon={<Users size={16} />} label="활성 멤버" value={`${organization.activeMemberCount}명`} />
        <DetailRow label="생성일" value={new Date(organization.createdAt).toLocaleString('ko-KR')} />
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3">조직 상태</h2>
        {!canManage ? (
          <p className="text-sm text-gray-500">상태 변경은 PLATFORM_OPS 이상만 가능합니다. (조회 전용 계정)</p>
        ) : organization.status === 'TRIAL' ? (
          <p className="text-sm text-gray-500">TRIAL 상태는 이 화면에서 다루지 않습니다(과금 연동 시점에 별도 처리).</p>
        ) : (
          <div className="flex gap-2">
            {organization.status !== 'ACTIVE' && (
              <button
                onClick={() => handleChangeStatus('ACTIVE')}
                disabled={isProcessing}
                className="px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                재개
              </button>
            )}
            {organization.status !== 'SUSPENDED' && (
              <button
                onClick={() => handleChangeStatus('SUSPENDED')}
                disabled={isProcessing}
                className="px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-50"
              >
                정지
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const DetailRow: FC<{ icon?: ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <span className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500">
      {icon}
      {label}
    </span>
    <span className="text-sm text-gray-950">{value}</span>
  </div>
);
