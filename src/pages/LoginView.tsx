import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Key, Lock, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PlatformAdminInfo } from '../types';
import { useTranslation } from 'react-i18next';

/**
 * signstage-docs business/login-security.md 5장의 로그인 흐름을 구현한다.
 *
 * 로그인이 성공하면 두 가지 응답 중 하나가 온다.
 * - passwordChangeRequired=true: 최초 로그인이라 비밀번호 변경이 강제된다(5.3절).
 *   이 화면에서 바로 2단계(비밀번호 변경) 폼으로 전환한다.
 * - passwordChangeRequired=false: accessToken이 발급된다. 로그인 완료.
 *   platformAdmin이 있으면 플랫폼 관리자 콘솔(/admin)로, 없으면 일반 사용자다.
 *
 * 일반 사용자는 아직 organizationId를 담은 조직 선택 흐름(5.2절)이 없어, 조직이 있든 없든
 * 항상 대시보드(/)로 보낸다 — 조직 생성 화면으로 곧장 보내던 것을 분리했다(조직이 이미
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
  const { t } = useTranslation();
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
      showSnackbar(t('auth.enterCredentials'), 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/identity/login', { loginId, password });
      const data = response.data as LoginResponseData;

      if (data.passwordChangeRequired) {
        setPasswordResetToken(data.passwordResetToken ?? '');
        setStep('change-password');
        showSnackbar(t('auth.firstLogin'), 'info', null);
        return;
      }

      if (data.accessToken) {
        login(data.accessToken, data.platformAdmin);
        showSnackbar(t('auth.signedIn'), 'success');
        navigate(data.platformAdmin ? '/admin' : '/', { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.communicationFailed');
      showSnackbar(message, 'error');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!newPassword || !newPasswordConfirm) {
      showSnackbar(t('auth.enterNewPassword'), 'error');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showSnackbar(t('auth.passwordMismatch'), 'error');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/identity/force-password-change', {
        passwordResetToken,
        currentPassword: password,
        newPassword,
      });
      showSnackbar(t('auth.passwordChanged'), 'success');
      setStep('login');
      setPassword('');
      setPasswordResetToken('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.passwordChangeFailed');
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
            {t(step === 'login' ? 'auth.signInGuide' : 'auth.changePasswordGuide')}
          </p>
        </div>

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.loginId')}</label>
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
                  placeholder={t('auth.loginId')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
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
                  aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
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
              {t(isLoading ? 'auth.signingIn' : 'auth.signIn')}
            </button>

            <p className="text-center text-sm text-gray-500">
              {t('auth.noAccount')}{' '}
              <Link to="/signup" className="text-gray-950 font-medium hover:underline">
                {t('auth.signUp')}
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.newPassword')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder={t('auth.newPassword')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.confirmNewPassword')}</label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder={t('auth.confirmNewPassword')}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {t(isLoading ? 'auth.changingPassword' : 'auth.changePassword')}
            </button>

            <button
              type="button"
              onClick={() => setStep('login')}
              disabled={isLoading}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              {t('auth.backToSignIn')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
