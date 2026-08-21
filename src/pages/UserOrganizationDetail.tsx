import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Loader2, Pencil, Plus, UserMinus, Users, X } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { MemberRole, MemberSummary, OrganizationSummary } from '../types';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  SUSPENDED: '정지',
  TRIAL: '체험',
};

const ALL_ROLE_OPTIONS: MemberRole[] = ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'];

/**
 * 내가 속한 조직 하나의 상세/설정 + 멤버 관리 화면(`/organizations/:organizationId`).
 * "조직 관리"(`UserOrganizationList`) 목록의 조직 행에서 진입한다.
 *
 * - 조직 정보: OWNER만 이름/기본 언어를 수정할 수 있다(`PUT /api/organizations/{id}`) —
 *   screen-composition-plan.md "조직 설정" 항목. 코드는 조직 식별자라 이 화면에서 바꿀 수 없다.
 * - 멤버: OWNER/ADMIN만 추가/역할변경/제거할 수 있다(`MemberController`, 4.3절 "최소 1 OWNER"
 *   규칙은 서버가 강제). OWNER 역할의 지정/해제·제거는 OWNER만 할 수 있어, ADMIN으로 로그인한
 *   경우 OWNER 행은 읽기 전용으로만 보여주고 역할 선택지에서도 OWNER를 뺀다 — 어차피 서버가
 *   거부할 조작을 화면에서 미리 걸러내는 용도다.
 */
export const UserOrganizationDetail: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [nameDraft, setNameDraft] = useState('');
  const [localeDraft, setLocaleDraft] = useState('');

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [processingMemberId, setProcessingMemberId] = useState<number | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, MemberRole>>({});
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<number | null>(null);

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addLoginId, setAddLoginId] = useState('');
  const [addRole, setAddRole] = useState<MemberRole>('VIEWER');
  const [isAddingMember, setIsAddingMember] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchMembers = async () => {
    const response = await api.get(`/organizations/${organizationId}/members`);
    return response.data as MemberSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/organizations/${organizationId}`);
        if (!cancelled) {
          const data = response.data as OrganizationSummary;
          setOrganization(data);
          setNameDraft(data.name);
          setLocaleDraft(data.defaultLocale);
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

  const startEdit = () => {
    if (!organization) return;
    setNameDraft(organization.name);
    setLocaleDraft(organization.defaultLocale);
    setIsEditing(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameDraft.trim() || !localeDraft.trim()) {
      showSnackbar('조직 이름과 기본 언어를 입력해주세요.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.put(`/organizations/${organizationId}`, {
        name: nameDraft.trim(),
        defaultLocale: localeDraft.trim(),
      });
      setOrganization(response.data as OrganizationSummary);
      setIsEditing(false);
      showSnackbar('조직 정보를 저장했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '조직 정보 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!addLoginId.trim()) {
      showSnackbar('추가할 사용자의 아이디를 입력해주세요.', 'error');
      return;
    }

    setIsAddingMember(true);
    try {
      await api.post(`/organizations/${organizationId}/members`, { loginId: addLoginId.trim(), role: addRole });
      showSnackbar('멤버를 추가했습니다.', 'success');
      setAddLoginId('');
      setAddRole('VIEWER');
      setIsAddFormOpen(false);
      setMembers(await fetchMembers());
    } catch (err) {
      const message = err instanceof Error ? err.message : '멤버 추가에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleChangeMemberRole = async (memberId: number) => {
    const nextRole = roleDrafts[memberId];
    setProcessingMemberId(memberId);
    try {
      await api.put(`/organizations/${organizationId}/members/${memberId}/role`, { role: nextRole });
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
      await api.delete(`/organizations/${organizationId}/members/${memberId}`);
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

  const canEdit = organization.myRole === 'OWNER';
  const canManageMembers = organization.myRole === 'OWNER' || organization.myRole === 'ADMIN';
  // OWNER 역할의 지정/해제는 OWNER만 할 수 있다(MemberService#addMember, #updateMemberRole) — ADMIN에게는
  // 선택지에서 아예 뺀다.
  const roleOptions = organization.myRole === 'OWNER' ? ALL_ROLE_OPTIONS : ALL_ROLE_OPTIONS.filter((role) => role !== 'OWNER');
  // ADMIN은 OWNER 멤버의 역할/제거를 건드릴 수 없다(ORGANIZATION_ONLY_OWNER_CAN_ASSIGN_OWNER/
  // _REMOVE_OWNER) — 그 행은 편집 대상에서 제외한다.
  const canEditMember = (member: MemberSummary) => canManageMembers && (organization.myRole === 'OWNER' || member.role !== 'OWNER');

  return (
    <div className="max-w-2xl">
      <Link
        to="/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        조직 관리로
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Building2 size={20} className="text-gray-400" />
            {organization.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">내 역할: {organization.myRole}</p>
        </div>
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50 text-gray-600 border-gray-200">
          {STATUS_LABEL[organization.status] ?? organization.status}
        </span>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">조직 이름</label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기본 언어</label>
            <input
              type="text"
              value={localeDraft}
              onChange={(e) => setLocaleDraft(e.target.value)}
              disabled={isSaving}
              placeholder="예: ko-KR"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-50"
            >
              <X size={14} />
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          <DetailRow icon={<Building2 size={16} />} label="조직 이름" value={organization.name} />
          <DetailRow label="조직 코드" value={organization.code} />
          <DetailRow icon={<Globe size={16} />} label="기본 언어" value={organization.defaultLocale} />
          <DetailRow label="생성일" value={new Date(organization.createdAt).toLocaleString('ko-KR')} />
        </div>
      )}

      {!isEditing && (
        <div className="mt-4">
          {canEdit ? (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
            >
              <Pencil size={14} />
              조직 정보 수정
            </button>
          ) : (
            <p className="text-xs text-gray-400">조직 정보 수정은 OWNER만 할 수 있습니다.</p>
          )}
        </div>
      )}

      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <Users size={14} />
            멤버
          </h2>
          {canManageMembers && !isAddFormOpen && (
            <button
              onClick={() => setIsAddFormOpen(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
            >
              <Plus size={12} />
              멤버 추가
            </button>
          )}
        </div>

        {isAddFormOpen && (
          <form
            onSubmit={handleAddMember}
            className="mb-4 flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3"
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">아이디</label>
              <input
                type="text"
                value={addLoginId}
                onChange={(e) => setAddLoginId(e.target.value)}
                disabled={isAddingMember}
                placeholder="이미 가입된 사용자의 로그인 아이디"
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">역할</label>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as MemberRole)}
                disabled={isAddingMember}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isAddingMember}
                className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {isAddingMember ? '추가 중...' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddFormOpen(false)}
                disabled={isAddingMember}
                className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
              >
                취소
              </button>
            </div>
            <p className="basis-full text-xs text-gray-400">
              이 아이디의 계정이 이미 있어야 합니다. 이메일 초대는 아직 지원하지 않습니다.
            </p>
          </form>
        )}

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
                {canManageMembers && <th className="text-right font-medium pb-2">처리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="py-2 text-gray-950">{member.loginId}</td>
                  <td className="py-2 text-gray-700">{member.name}</td>
                  <td className="py-2 text-gray-500">{member.email}</td>
                  {canEditMember(member) ? (
                    <td className="py-2">
                      <select
                        value={roleDrafts[member.id] ?? member.role}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({ ...prev, [member.id]: e.target.value as MemberRole }))
                        }
                        disabled={processingMemberId === member.id}
                        className="px-2 py-1 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <td className="py-2 text-gray-700">{member.role}</td>
                  )}
                  {canManageMembers && (
                    <td className="py-2">
                      {canEditMember(member) && (
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
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!canManageMembers && (
          <p className="mt-2 text-xs text-gray-400">멤버 추가/역할변경/제거는 OWNER/ADMIN만 할 수 있습니다.</p>
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
