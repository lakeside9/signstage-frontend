import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Lock, LockOpen, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type { PlatformAdminUserSummary, UserStatus } from '../types';

const STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISABLED: 'bg-gray-100 text-gray-600 border-gray-200',
  WITHDRAWN: 'bg-red-50 text-red-700 border-red-200',
};

/**
 * 회원 상세 화면. `GET /api/platform-admin/users/{userId}`를 그대로 보여준다.
 * 상태 변경 버튼은 `AdminUserList`와 동일한 규칙(PLATFORM_OPS 이상, 본인 계정 제외)을 따른다.
 * signstage-docs backend/signup-approval-implementation-plan.md 4장,
 * business/platform-admin-member-management.md 참고.
 */
export const AdminUserDetail: FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<PlatformAdminUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentAdminId = useAuthStore((state) => state.platformAdmin?.id);
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/platform-admin/users/${userId}`);
        if (!cancelled) {
          setUser(response.data as PlatformAdminUserSummary);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '회원 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate('/users', { replace: true });
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
  const canManage = canManagePlatform(currentPlatformRole);

  return (
    <div className="max-w-2xl">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
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
        <DetailRow icon={<Mail size={16} />} label="이메일" value={user.email} />
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
