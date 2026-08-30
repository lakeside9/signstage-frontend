import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  History,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserX,
} from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform, isPlatformSuper } from '../utils/permissions';
import type {
  MemberStatus,
  PageResponse,
  PlatformAdminLoginHistoryEntry,
  PlatformAdminUserDetail,
  PlatformAdminUserHistorySummary,
  PlatformAdminUserSummary,
  UserStatus,
} from '../types';

const PAGE_SIZE = 10;

const STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISABLED: 'bg-gray-100 text-gray-600 border-gray-200',
  WITHDRAWN: 'bg-red-50 text-red-700 border-red-200',
};

const MEMBERSHIP_STATUS_LABEL: Record<MemberStatus, string> = {
  INVITED: '초대됨',
  ACTIVE: '활성',
  REMOVED: '제외됨',
};

const LOGIN_HISTORY_STATUS_LABEL: Record<string, string> = {
  SUCCESS: '성공',
  FAILED_NOT_FOUND: '실패(존재하지 않는 아이디)',
  FAILED_INVALID_PASSWORD: '실패(비밀번호 불일치)',
  FAILED_LOCKED: '실패(계정 잠김)',
  FAILED_PENDING_APPROVAL: '실패(승인 대기)',
  FAILED_DISABLED: '실패(비활성 계정)',
  FAILED_WITHDRAWN: '실패(탈퇴 계정)',
};

/**
 * 회원 상세 화면. `GET /api/platform-admin/users/{userId}`가 기본 정보 + 소속 파트너 목록을
 * 함께 반환한다(signstage-docs business/platform-admin-member-management.md 4.1절).
 * 로그인 이력은 PLATFORM_OPS 이상만 조회할 수 있어(login-security.md 6장) 별도로 불러온다.
 * 강제 탈퇴는 PLATFORM_SUPER만 가능한 되돌릴 수 없는 동작이라 2단계 확인을 거친다.
 */
export const AdminUserDetail: FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<PlatformAdminUserSummary | null>(null);
  const [organizations, setOrganizations] = useState<PlatformAdminUserDetail['organizations']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [historyPage, setHistoryPage] = useState(0);
  const [historyData, setHistoryData] = useState<PageResponse<PlatformAdminLoginHistoryEntry> | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const [infoHistory, setInfoHistory] = useState<PlatformAdminUserHistorySummary[]>([]);
  const [isInfoHistoryLoading, setIsInfoHistoryLoading] = useState(true);

  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const currentAdminId = useAuthStore((state) => state.platformAdmin?.id);
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const canWithdraw = isPlatformSuper(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/platform-admin/users/${userId}`);
        const detail = response.data as PlatformAdminUserDetail;
        if (!cancelled) {
          setUser(detail.user);
          setOrganizations(detail.organizations);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '회원 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate('/admin/users', { replace: true });
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
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!canManage) {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
        return;
      }

      try {
        const query = new URLSearchParams();
        query.set('page', String(historyPage));
        query.set('size', String(PAGE_SIZE));
        const response = await api.get(`/platform-admin/users/${userId}/login-history?${query.toString()}`);
        if (!cancelled) {
          setHistoryData(response.data as PageResponse<PlatformAdminLoginHistoryEntry>);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '로그인 이력을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, historyPage, canManage]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/platform-admin/users/${userId}/history`);
        if (!cancelled) {
          setInfoHistory(response.data as PlatformAdminUserHistorySummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '회원 정보 변경 이력을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsInfoHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleChangeStatus = async (status: 'ACTIVE' | 'DISABLED') => {
    setIsProcessing(true);
    try {
      const response = await api.put(`/platform-admin/users/${userId}/status`, { status });
      setUser(response.data as PlatformAdminUserSummary);
      showSnackbar(status === 'ACTIVE' ? '승인 처리되었습니다.' : '거절/비활성화 처리되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlock = async () => {
    setIsProcessing(true);
    try {
      const response = await api.post(`/platform-admin/users/${userId}/unlock`);
      setUser(response.data as PlatformAdminUserSummary);
      showSnackbar('계정 잠금을 해제했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '잠금 해제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForcePasswordReset = async () => {
    setIsProcessing(true);
    try {
      const response = await api.post(`/platform-admin/users/${userId}/force-password-reset`);
      setUser(response.data as PlatformAdminUserSummary);
      showSnackbar('다음 로그인 시 비밀번호 변경이 강제됩니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '강제 비밀번호 재설정 요청에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    setIsProcessing(true);
    try {
      const response = await api.post(`/platform-admin/users/${userId}/withdraw`);
      setUser(response.data as PlatformAdminUserSummary);
      setConfirmingWithdraw(false);
      showSnackbar('회원을 탈퇴 처리했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '강제 탈퇴에 실패했습니다.';
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

  if (!user) {
    return null;
  }

  const isSelf = user.id === currentAdminId;
  const isWithdrawn = user.status === 'WITHDRAWN';

  return (
    <div>
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        회원 목록으로
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            {user.name}
            {isSelf && <span className="text-xs font-normal text-gray-400">(나)</span>}
          </h1>
          <p className="mt-1 text-sm text-gray-500">회원 상세 정보</p>
        </div>
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[user.status]}`}
        >
          {user.status}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        <DetailRow icon={<User size={16} />} label="아이디" value={user.loginId} />
        <DetailRow icon={<User size={16} />} label="이름" value={user.name} />
        <DetailRow icon={<Mail size={16} />} label="이메일" value={user.email ?? '-'} />
        <DetailRow icon={<Phone size={16} />} label="전화번호" value={user.phone ?? '-'} />
        <DetailRow label="언어" value={user.locale} />
        <DetailRow
          icon={<ShieldCheck size={16} />}
          label="플랫폼 권한"
          value={user.platformRole ?? '(일반 사용자)'}
        />
        <DetailRow
          icon={user.locked ? <Lock size={16} /> : <LockOpen size={16} />}
          label="로그인 잠금"
          value={user.locked ? '잠김' : '정상'}
        />
        <DetailRow label="비밀번호 재설정" value={user.passwordResetRequired ? '다음 로그인 시 강제' : '없음'} />
        <DetailRow label="가입일" value={new Date(user.createdAt).toLocaleString('ko-KR')} />
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3 flex items-center gap-1.5">
          <Building2 size={14} />
          소속 파트너
        </h2>
        {organizations.length === 0 ? (
          <p className="text-sm text-gray-500">소속된 파트너가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium pb-2">파트너</th>
                <th className="text-left font-medium pb-2">역할</th>
                <th className="text-left font-medium pb-2">상태</th>
                <th className="text-right font-medium pb-2">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {organizations.map((membership) => (
                <tr key={membership.organizationId}>
                  <td className="py-2">
                    <Link
                      to={`/admin/organizations/${membership.organizationId}`}
                      className="text-gray-950 hover:underline"
                    >
                      {membership.organizationName}
                    </Link>
                  </td>
                  <td className="py-2 text-gray-700">{membership.role}</td>
                  <td className="py-2 text-gray-500">{MEMBERSHIP_STATUS_LABEL[membership.status]}</td>
                  <td className="py-2 text-right text-gray-500">
                    {membership.joinedAt ? new Date(membership.joinedAt).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3">가입 승인</h2>
        {isSelf ? (
          <p className="text-sm text-gray-500">본인 계정은 상태를 변경할 수 없습니다.</p>
        ) : !canManage ? (
          <p className="text-sm text-gray-500">상태 변경은 PLATFORM_OPS 이상만 가능합니다. (조회 전용 계정)</p>
        ) : (
          <div className="flex gap-2">
            {user.status !== 'ACTIVE' && (
              <button
                onClick={() => handleChangeStatus('ACTIVE')}
                disabled={isProcessing}
                className="px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                승인/활성화
              </button>
            )}
            {user.status !== 'DISABLED' && (
              <button
                onClick={() => handleChangeStatus('DISABLED')}
                disabled={isProcessing}
                className="px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-50"
              >
                거절/비활성화
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3">계정 제어</h2>
        {isSelf ? (
          <p className="text-sm text-gray-500">본인 계정은 대상으로 지정할 수 없습니다.</p>
        ) : !canManage ? (
          <p className="text-sm text-gray-500">잠금 해제/비밀번호 재설정은 PLATFORM_OPS 이상만 가능합니다.</p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleUnlock}
              disabled={isProcessing || !user.locked}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-40"
              title={user.locked ? undefined : '현재 잠긴 계정이 아닙니다.'}
            >
              <LockOpen size={14} />
              잠금 즉시 해제
            </button>
            <button
              onClick={handleForcePasswordReset}
              disabled={isProcessing || user.passwordResetRequired}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-40"
              title={user.passwordResetRequired ? '이미 강제 재설정이 대기 중입니다.' : undefined}
            >
              <KeyRound size={14} />
              강제 비밀번호 재설정
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3 flex items-center gap-1.5">
          <History size={14} />
          로그인 이력
        </h2>
        {!canManage ? (
          <p className="text-sm text-gray-500">로그인 이력 조회는 PLATFORM_OPS 이상만 가능합니다.</p>
        ) : (
          <ListContainer
            isLoading={isHistoryLoading}
            isEmpty={(historyData?.content.length ?? 0) === 0}
            emptyMessage="로그인 시도 이력이 없습니다."
            pagination={
              historyData
                ? {
                    page: historyData.page,
                    totalPages: historyData.totalPages,
                    hasNext: historyData.hasNext,
                    totalElements: historyData.totalElements,
                    onPageChange: (nextPage) => {
                      setIsHistoryLoading(true);
                      setHistoryPage(nextPage);
                    },
                  }
                : undefined
            }
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">일시</th>
                  <th className="text-left px-4 py-2 font-medium">시도한 아이디</th>
                  <th className="text-left px-4 py-2 font-medium">결과</th>
                  <th className="text-left px-4 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(historyData?.content ?? []).map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-gray-500">{new Date(entry.createdAt).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2 text-gray-950">{entry.loginIdInput}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {LOGIN_HISTORY_STATUS_LABEL[entry.status] ?? entry.status}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{entry.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ListContainer>
        )}
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3 flex items-center gap-1.5">
          <History size={14} />
          회원 정보 변경 이력
        </h2>
        <ListContainer
          isLoading={isInfoHistoryLoading}
          isEmpty={infoHistory.length === 0}
          emptyMessage="변경 이력이 없습니다."
        >
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">일시</th>
                <th className="text-left px-4 py-2 font-medium">이름</th>
                <th className="text-left px-4 py-2 font-medium">이메일</th>
                <th className="text-left px-4 py-2 font-medium">전화번호</th>
                <th className="text-left px-4 py-2 font-medium">상태</th>
                <th className="text-left px-4 py-2 font-medium">플랫폼 등급</th>
                <th className="text-left px-4 py-2 font-medium">변경자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {infoHistory.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2 text-gray-950">{entry.name}</td>
                  <td className="px-4 py-2 text-gray-500">{entry.email ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{entry.phone ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[entry.status]}`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{entry.platformRole ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {entry.createdBy == null || entry.createdBy === user.id ? '본인' : `관리자 #${entry.createdBy}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListContainer>
        <p className="mt-2 text-xs text-gray-400">
          "본인"은 회원가입 또는 내 정보 수정 화면에서 이 회원이 직접 바꾼 것이고, "관리자"는 플랫폼 관리자가 대신
          바꾼 것입니다(번호는 그 관리자의 회원 id).
        </p>
      </div>

      {!isWithdrawn && (
        <div className="mt-4 bg-white border border-red-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            위험 구역
          </h2>
          {isSelf ? (
            <p className="text-sm text-gray-500">본인 계정은 대상으로 지정할 수 없습니다.</p>
          ) : !canWithdraw ? (
            <p className="text-sm text-gray-500">회원 강제 탈퇴는 PLATFORM_SUPER만 가능합니다.</p>
          ) : user.platformRole ? (
            <p className="text-sm text-gray-500">
              플랫폼 관리자 권한이 있는 계정은 탈퇴시킬 수 없습니다. 관리자 계정 화면에서 먼저 권한을 해제해주세요.
            </p>
          ) : confirmingWithdraw ? (
            <div className="space-y-3">
              <p className="text-sm text-red-700">
                되돌릴 수 없습니다. 아이디/이름/이메일/전화번호가 마스킹되고 다시 로그인할 수 없게 됩니다. 이
                회원이 마지막 OWNER인 파트너가 있다면 실패합니다(먼저 소유권을 이전해주세요).
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleWithdraw}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  네, 강제 탈퇴시킵니다
                </button>
                <button
                  onClick={() => setConfirmingWithdraw(false)}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingWithdraw(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50"
            >
              <UserX size={14} />
              회원 강제 탈퇴
            </button>
          )}
        </div>
      )}
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
