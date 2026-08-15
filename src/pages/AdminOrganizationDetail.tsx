import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Loader2, UserMinus, Users } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type { MemberRole, OrganizationStatus, PlatformAdminMemberSummary, PlatformAdminOrganizationSummary } from '../types';

const STATUS_BADGE_CLASS: Record<OrganizationStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  TRIAL: 'bg-amber-50 text-amber-700 border-amber-200',
};

const MEMBER_ROLE_OPTIONS: MemberRole[] = ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'];

/**
 * 조직 상세 화면. `GET /api/platform-admin/organizations/{organizationId}`를 그대로 보여준다.
 * 상태 변경(정지/재개)은 PLATFORM_OPS 이상만 가능하다. 멤버 목록과 강제 역할변경/제거도
 * 이 화면에서 다룬다(signstage-docs business/platform-admin-member-management.md 4.2절
 * "조직 멤버십 강제 조정") — 호출자가 그 조직의 멤버가 아니어도 된다는 점이 일반 멤버
 * 관리와 다르다. "최소 1 OWNER" 규칙은 강제 조정에도 예외 없이 적용된다.
 */
export const AdminOrganizationDetail: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<PlatformAdminOrganizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [members, setMembers] = useState<PlatformAdminMemberSummary[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [processingMemberId, setProcessingMemberId] = useState<number | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, MemberRole>>({});
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<number | null>(null);

  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchMembers = async () => {
    const response = await api.get(`/platform-admin/organizations/${organizationId}/members`);
    return response.data as PlatformAdminMemberSummary[];
  };

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
          navigate('/organizations', { replace: true });
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchMembers();
        if (!cancelled) {
          setMembers(data);
          setRoleDrafts(Object.fromEntries(data.map((member) => [member.id, member.role])));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '멤버 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsMembersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleChangeMemberRole = async (memberId: number) => {
    const nextRole = roleDrafts[memberId];
    setProcessingMemberId(memberId);
    try {
      await api.put(`/platform-admin/organizations/${organizationId}/members/${memberId}/role`, { role: nextRole });
      showSnackbar('멤버 역할을 변경했습니다.', 'success');
      setMembers(await fetchMembers());
    } catch (err) {
      const message = err instanceof Error ? err.message : '역할 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    setProcessingMemberId(memberId);
    try {
      await api.delete(`/platform-admin/organizations/${organizationId}/members/${memberId}`);
      showSnackbar('멤버를 제거했습니다.', 'success');
      setConfirmingRemoveId(null);
      setMembers(await fetchMembers());
    } catch (err) {
      const message = err instanceof Error ? err.message : '멤버 제거에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingMemberId(null);
    }
  };

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
      <Link
        to="/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
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

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3 flex items-center gap-1.5">
          <Users size={14} />
          멤버
        </h2>
        {isMembersLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-500">멤버가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium pb-2">아이디</th>
                <th className="text-left font-medium pb-2">이름</th>
                <th className="text-left font-medium pb-2">이메일</th>
                <th className="text-left font-medium pb-2">역할</th>
                {canManage && <th className="text-right font-medium pb-2">처리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="py-2 text-gray-950">
                    {member.loginId}
                    <Link
                      to={`/users/${member.userId}`}
                      className="ml-1.5 text-xs text-gray-400 hover:text-gray-950 hover:underline"
                    >
                      상세
                    </Link>
                  </td>
                  <td className="py-2 text-gray-700">{member.name}</td>
                  <td className="py-2 text-gray-500">{member.email}</td>
                  {canManage ? (
                    <td className="py-2">
                      <select
                        value={roleDrafts[member.id] ?? member.role}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({ ...prev, [member.id]: e.target.value as MemberRole }))
                        }
                        disabled={processingMemberId === member.id}
                        className="px-2 py-1 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                      >
                        {MEMBER_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <td className="py-2 text-gray-700">{member.role}</td>
                  )}
                  {canManage && (
                    <td className="py-2">
                      <div className="flex justify-end items-center gap-2">
                        {roleDrafts[member.id] && roleDrafts[member.id] !== member.role && (
                          <button
                            onClick={() => handleChangeMemberRole(member.id)}
                            disabled={processingMemberId === member.id}
                            className="px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                          >
                            역할 저장
                          </button>
                        )}
                        {confirmingRemoveId === member.id ? (
                          <>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={processingMemberId === member.id}
                              className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              확인
                            </button>
                            <button
                              onClick={() => setConfirmingRemoveId(null)}
                              disabled={processingMemberId === member.id}
                              className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmingRemoveId(member.id)}
                            disabled={processingMemberId === member.id}
                            className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                          >
                            <UserMinus size={12} />
                            제거
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!canManage && (
          <p className="mt-2 text-xs text-gray-400">역할 강제 변경/제거는 PLATFORM_OPS 이상만 가능합니다.</p>
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
