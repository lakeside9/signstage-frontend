import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Key, Lock, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PlatformAdminInfo } from '../types';

/**
 * signstage-docs business/login-security.md 5장의 로그인 흐름을 구현한다.
 *
 * 로그인이 성공하면 두 가지 응답 중 하나가 온다.
 * - passwordChangeRequired=true: 최초 로그인이라 비밀번호 변경이 강제된다(5.3절).
 *   이 화면에서 바로 2단계(비밀번호 변경) 폼으로 전환한다.
 * - passwordChangeRequired=false: accessToken이 발급된다. 로그인 완료.
 *   platformAdmin이 있으면 플랫폼 관리자 콘솔(/)로, 없으면 일반 사용자다.
 *
 * 일반 사용자는 아직 organizationId를 담은 조직 선택 흐름(5.2절)이 없어, 조직이 있든 없든
 * 항상 대시보드(/org)로 보낸다 — 조직 생성 화면으로 곧장 보내던 것을 분리했다(조직이 이미
 * 있는 사용자도 매번 생성 화면부터 거쳐야 하는 문제가 있었다). 승인 대기(PENDING)
 * 계정으로 로그인을 시도하면 IDENTITY_ACCOUNT_PENDING_APPROVAL 오류가 오는데, 백엔드 메시지를
 * 그대로 스낵바에 띄운다.
 */

interface LoginResponseData {
  passwordChangeRequired: boolean;
  passwordResetToken: string | null;
  tokenType: string | null;
  accessToken: string | null;
  platformAdmin: PlatformAdminInfo | null;
}

type Step = 'login' | 'change-password';

export const LoginView: FC = () => {
  const [step, setStep] = useState<Step>('login');

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [passwordResetToken, setPasswordResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!loginId || !password) {
      showSnackbar('아이디와 비밀번호를 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/identity/login', { loginId, password });
      const data = response.data as LoginResponseData;

      if (data.passwordChangeRequired) {
        setPasswordResetToken(data.passwordResetToken ?? '');
        setStep('change-password');
        showSnackbar('최초 로그인입니다. 비밀번호를 변경해주세요.', 'info', null);
        return;
      }

      if (data.accessToken) {
        login(data.accessToken, data.platformAdmin);
        showSnackbar('로그인되었습니다.', 'success');
        navigate(data.platformAdmin ? '/' : '/org', { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '서버와의 통신 중 오류가 발생했습니다.';
      showSnackbar(message, 'error');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!newPassword || !newPasswordConfirm) {
      showSnackbar('새 비밀번호를 입력해주세요.', 'error');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showSnackbar('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/identity/force-password-change', {
        passwordResetToken,
        currentPassword: password,
        newPassword,
      });
      showSnackbar('비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.', 'success');
      setStep('login');
      setPassword('');
      setPasswordResetToken('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-gray-950">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-950 rounded-lg mb-4 text-white">
            <Key size={24} />
          </div>
          <h1 className="text-lg font-bold text-gray-950">SignStage</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 'login' ? '관리자 계정으로 로그인하세요' : '처음 로그인 시 비밀번호를 변경해야 합니다'}
          </p>
        </div>

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">아이디</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                  placeholder="아이디"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={isLoading}
                  tabIndex={-1}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>

            <p className="text-center text-sm text-gray-500">
              계정이 없으신가요?{' '}
              <Link to="/signup" className="text-gray-950 font-medium hover:underline">
                회원가입
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="새 비밀번호"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호 확인</label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="새 비밀번호 확인"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isLoading ? '변경 중...' : '비밀번호 변경'}
            </button>

            <button
              type="button"
              onClick={() => setStep('login')}
              disabled={isLoading}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              로그인으로 돌아가기
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
