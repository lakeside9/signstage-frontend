import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, History, Loader2, Pencil, Plus, UserMinus, Users, UserPlus, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { OrganizationDiscountPanel } from '../components/OrganizationDiscountPanel';
import { CeremonyFinalDiscountPanel } from '../components/CeremonyFinalDiscountPanel';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type {
  MemberRole,
  OrganizationHistorySummary,
  OrganizationStatus,
  PageResponse,
  PlatformAdminMemberSummary,
  PlatformAdminOrganizationSummary,
  PlatformAdminUserSummary,
} from '../types';

const STATUS_BADGE_CLASS: Record<OrganizationStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  TRIAL: 'bg-amber-50 text-amber-700 border-amber-200',
};

const MEMBER_ROLE_OPTIONS: MemberRole[] = ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'];
const CANDIDATE_PAGE_SIZE = 10;
const EMPTY_CANDIDATE_SEARCH = { loginId: '', name: '', email: '' };

/**
 * 파트너 상세 화면. `GET /api/platform-admin/organizations/{organizationId}`를 그대로 보여준다.
 * 상태 변경(정지/재개)은 PLATFORM_OPS 이상만 가능하다. 멤버 목록과 강제 추가/역할변경/제거도
 * 이 화면에서 다룬다(signstage-docs business/platform-admin-member-management.md 4.2절
 * "조직 멤버십 강제 조정") — 호출자가 그 조직의 멤버가 아니어도 된다는 점이 일반 멤버
 * 관리와 다르다. 추가 시 role=OWNER 제한도 없다(관리자는 조직 내부 위계를 우회한다). "최소 1
 * OWNER" 규칙은 강제 조정에도 예외 없이 적용된다.
 *
 * 멤버 추가는 아이디를 직접 입력받지 않는다 — 어느 조직에도 속하지 않은 사용자만 후보가 될 수
 * 있어서(1인 1조직 제한, 2026-08-16 결정), `GET /api/platform-admin/users?withoutOrganization=true`
 * 로 후보 목록을 조회해 검색·선택하게 한다. 잘못된 아이디를 타이핑해 실패하는 일을 애초에 막는다.
 */
export const AdminOrganizationDetail: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<PlatformAdminOrganizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [localeDraft, setLocaleDraft] = useState('');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<OrganizationHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [members, setMembers] = useState<PlatformAdminMemberSummary[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [processingMemberId, setProcessingMemberId] = useState<number | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, MemberRole>>({});
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<number | null>(null);

  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [addRole, setAddRole] = useState<MemberRole>('VIEWER');
  const [addingUserId, setAddingUserId] = useState<number | null>(null);

  const [candidateSearchForm, setCandidateSearchForm] = useState(EMPTY_CANDIDATE_SEARCH);
  const [candidateSearchParams, setCandidateSearchParams] = useState(EMPTY_CANDIDATE_SEARCH);
  const [candidatePage, setCandidatePage] = useState(0);
  const [candidatePageData, setCandidatePageData] = useState<PageResponse<PlatformAdminUserSummary> | null>(null);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);

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
          const message = err instanceof Error ? err.message : '파트너 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate('/admin/organizations', { replace: true });
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

  useEffect(() => {
    if (!isAddPanelOpen) {
      return;
    }
    let cancelled = false;

    (async () => {
      setIsCandidatesLoading(true);
      try {
        const query = new URLSearchParams();
        query.set('withoutOrganization', 'true');
        if (candidateSearchParams.loginId) query.set('loginId', candidateSearchParams.loginId);
        if (candidateSearchParams.name) query.set('name', candidateSearchParams.name);
        if (candidateSearchParams.email) query.set('email', candidateSearchParams.email);
        query.set('page', String(candidatePage));
        query.set('size', String(CANDIDATE_PAGE_SIZE));

        const response = await api.get(`/platform-admin/users?${query.toString()}`);
        if (!cancelled) {
          setCandidatePageData(response.data as PageResponse<PlatformAdminUserSummary>);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '추가할 사용자 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsCandidatesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddPanelOpen, candidateSearchParams, candidatePage]);

  const openAddPanel = () => {
    setIsAddPanelOpen(true);
    setCandidateSearchForm(EMPTY_CANDIDATE_SEARCH);
    setCandidateSearchParams(EMPTY_CANDIDATE_SEARCH);
    setCandidatePage(0);
    setAddRole('VIEWER');
  };

  const handleCandidateSearch = (e: FormEvent) => {
    e.preventDefault();
    setCandidatePage(0);
    setCandidateSearchParams(candidateSearchForm);
  };

  const handleCandidateSearchReset = () => {
    setCandidateSearchForm(EMPTY_CANDIDATE_SEARCH);
    setCandidatePage(0);
    setCandidateSearchParams(EMPTY_CANDIDATE_SEARCH);
  };

  const handleAddCandidate = async (candidate: PlatformAdminUserSummary) => {
    setAddingUserId(candidate.id);
    try {
      await api.post(`/platform-admin/organizations/${organizationId}/members`, {
        loginId: candidate.loginId,
        role: addRole,
      });
      showSnackbar(`${candidate.name}님을 멤버로 추가했습니다.`, 'success');
      setIsAddPanelOpen(false);
      setMembers(await fetchMembers());
    } catch (err) {
      const message = err instanceof Error ? err.message : '멤버 추가에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setAddingUserId(null);
    }
  };

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
      showSnackbar(status === 'ACTIVE' ? '파트너를 재개했습니다.' : '파트너를 정지했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const startEditInfo = () => {
    if (!organization) return;
    setNameDraft(organization.name);
    setLocaleDraft(organization.defaultLocale);
    setIsEditingInfo(true);
  };

  const handleSaveInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameDraft.trim() || !localeDraft.trim()) {
      showSnackbar('파트너 이름과 기본 언어를 입력해주세요.', 'error');
      return;
    }

    setIsSavingInfo(true);
    try {
      const response = await api.put(`/platform-admin/organizations/${organizationId}/info`, {
        organizationName: nameDraft.trim(),
        defaultLocale: localeDraft.trim(),
      });
      setOrganization(response.data as PlatformAdminOrganizationSummary);
      setIsEditingInfo(false);
      showSnackbar('파트너 정보를 저장했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '파트너 정보 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const openHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/organizations/${organizationId}/history`);
      setHistory(response.data as OrganizationHistorySummary[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsHistoryLoading(false);
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
    <div>
      <Link
        to="/admin/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        파트너 목록으로
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Building2 size={20} className="text-gray-400" />
            {organization.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">파트너 상세 정보</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openHistory}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
          >
            <History size={12} />
            이력
          </button>
          <span
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[organization.status]}`}
          >
            {organization.status}
          </span>
        </div>
      </div>

      {isEditingInfo ? (
        <form onSubmit={handleSaveInfo} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">파트너 이름</label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={isSavingInfo}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기본 언어</label>
            <input
              type="text"
              value={localeDraft}
              onChange={(e) => setLocaleDraft(e.target.value)}
              disabled={isSavingInfo}
              placeholder="예: ko-KR"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditingInfo(false)}
              disabled={isSavingInfo}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-50"
            >
              <X size={14} />
              취소
            </button>
            <button
              type="submit"
              disabled={isSavingInfo}
              className="flex-1 bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isSavingInfo ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            <DetailRow icon={<Building2 size={16} />} label="파트너 이름" value={organization.name} />
            <DetailRow label="파트너 코드" value={organization.code} />
            <DetailRow icon={<Globe size={16} />} label="기본 언어" value={organization.defaultLocale} />
            <DetailRow icon={<Users size={16} />} label="활성 멤버" value={`${organization.activeMemberCount}명`} />
            <DetailRow label="생성일" value={new Date(organization.createdAt).toLocaleString('ko-KR')} />
          </div>
          {canManage && (
            <button
              onClick={startEditInfo}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
            >
              <Pencil size={14} />
              파트너 정보 수정
            </button>
          )}
        </>
      )}

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3">파트너 상태</h2>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <Users size={14} />
            멤버
          </h2>
          {canManage && !isAddPanelOpen && (
            <button
              onClick={openAddPanel}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
            >
              <Plus size={12} />
              멤버 추가
            </button>
          )}
        </div>

        {canManage && isAddPanelOpen && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">
                어느 파트너에도 속하지 않은 사용자만 후보로 나옵니다(1인 1파트너 제한). 파트너 내부 위계와
                무관하게 OWNER로도 추가할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={() => setIsAddPanelOpen(false)}
                className="shrink-0 ml-2 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleCandidateSearch} className="flex flex-wrap items-end gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">아이디</label>
                <input
                  type="text"
                  value={candidateSearchForm.loginId}
                  onChange={(e) => setCandidateSearchForm((prev) => ({ ...prev, loginId: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all w-36"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
                <input
                  type="text"
                  value={candidateSearchForm.name}
                  onChange={(e) => setCandidateSearchForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all w-28"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
                <input
                  type="text"
                  value={candidateSearchForm.email}
                  onChange={(e) => setCandidateSearchForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all w-40"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
              >
                검색
              </button>
              <button
                type="button"
                onClick={handleCandidateSearchReset}
                className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
              >
                초기화
              </button>

              <div className="ml-auto">
                <label className="block text-xs font-medium text-gray-500 mb-1">추가할 역할</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as MemberRole)}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                >
                  {MEMBER_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </form>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {isCandidatesLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : !candidatePageData || candidatePageData.content.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  조건에 맞는, 어느 파트너에도 속하지 않은 사용자가 없습니다.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">아이디</th>
                      <th className="text-left font-medium px-3 py-2">이름</th>
                      <th className="text-left font-medium px-3 py-2">이메일</th>
                      <th className="text-right font-medium px-3 py-2">처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {candidatePageData.content.map((candidate) => (
                      <tr key={candidate.id}>
                        <td className="px-3 py-2 text-gray-950">{candidate.loginId}</td>
                        <td className="px-3 py-2 text-gray-700">{candidate.name}</td>
                        <td className="px-3 py-2 text-gray-500">{candidate.email}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleAddCandidate(candidate)}
                            disabled={addingUserId === candidate.id}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                          >
                            <UserPlus size={12} />
                            {addingUserId === candidate.id ? '추가 중...' : `${addRole}로 추가`}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {candidatePageData && (
                <Pagination
                  page={candidatePageData.page}
                  totalPages={candidatePageData.totalPages}
                  hasNext={candidatePageData.hasNext}
                  totalElements={candidatePageData.totalElements}
                  onPageChange={setCandidatePage}
                />
              )}
            </div>
          </div>
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
                {canManage && <th className="text-right font-medium pb-2">처리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="py-2 text-gray-950">
                    {member.loginId}
                    <Link
                      to={`/admin/users/${member.userId}`}
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
          <p className="mt-2 text-xs text-gray-400">멤버 추가/역할 강제 변경/제거는 PLATFORM_OPS 이상만 가능합니다.</p>
        )}
      </div>

      {organizationId && (
        <>
          <CeremonyFinalDiscountPanel organizationId={organizationId} canManage={canManage} showSnackbar={showSnackbar} />
          <OrganizationDiscountPanel organizationId={organizationId} canManage={canManage} showSnackbar={showSnackbar} />
        </>
      )}

      <Modal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="파트너 정보 변경 이력" widthClassName="max-w-lg">
        {isHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {history.map((entry) => (
              <li key={entry.id} className="py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-950 font-medium">{entry.name}</p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[entry.status]}`}
                  >
                    {entry.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  코드 {entry.code} · 기본 언어 {entry.defaultLocale}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(entry.createdAt).toLocaleString('ko-KR')}
                  {entry.createdBy != null && ` · 변경자 #${entry.createdBy}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
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
