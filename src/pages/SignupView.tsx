import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Key, Mail, Phone, User, UserPlus } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { SignupResult } from '../types';

/**
 * 회원가입 화면. signstage-docs business/user-organization-design.md 5.1절 (a)
 * "회원가입 → 승인 → 조직 생성" 3단계 중 1단계다.
 *
 * 가입 직후 계정은 PENDING(승인 대기) 상태라 로그인할 수 없다. 관리자가 승인(PENDING→ACTIVE)해야
 * 로그인 후 조직을 만들 수 있다 — 이 화면은 가입 접수만 담당하고 로그인은 시키지 않는다.
 */
export const SignupView: FC = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!loginId || !password || !name || !email) {
      showSnackbar('아이디/비밀번호/이름/이메일은 필수입니다.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      showSnackbar('비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/identity/signup', {
        loginId,
        password,
        name,
        email,
        phone: phone || null,
      });
      const data = response.data as SignupResult;
      setCompleted(true);
      showSnackbar(`${data.loginId} 계정 가입 신청이 접수되었습니다.`, 'success', null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '가입 신청에 실패했습니다.';
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
            {completed ? '가입 신청이 접수되었습니다' : '회원가입'}
          </p>
        </div>

        {completed ? (
          <div className="space-y-6 text-center">
            <p className="text-sm text-gray-600 leading-relaxed">
              관리자 승인 후 로그인할 수 있습니다. 승인 전에는 로그인을 시도해도
              "가입 승인 대기 중" 안내가 표시됩니다.
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm"
            >
              로그인 화면으로 이동
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  placeholder="로그인에 사용할 아이디"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="비밀번호"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="비밀번호 확인"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">
                  <UserPlus size={18} />
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                  placeholder="이름"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                  placeholder="이메일"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">전화번호 (선택)</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">
                  <Phone size={18} />
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                  autoComplete="tel"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                  placeholder="전화번호"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isLoading ? '가입 신청 중...' : '가입 신청'}
            </button>

            <p className="text-center text-sm text-gray-500">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-gray-950 font-medium hover:underline">
                로그인
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
