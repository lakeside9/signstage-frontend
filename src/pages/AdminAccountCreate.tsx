import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PlatformAdminCreatedUser, PlatformRole } from '../types';

const PLATFORM_ROLE_OPTIONS: Array<{ value: PlatformRole; label: string; description: string }> = [
  { value: 'PLATFORM_SUPPORT', label: 'PLATFORM_SUPPORT', description: '전 조직 데이터 조회만 (CS/지원팀)' },
  { value: 'PLATFORM_OPS', label: 'PLATFORM_OPS', description: '조회 + 조직/회원 상태 제어 (운영팀)' },
  { value: 'PLATFORM_SUPER', label: 'PLATFORM_SUPER', description: '전체 권한 + 관리자 계정 발급' },
];

/**
 * 플랫폼 관리자 계정 생성 화면. `POST /api/platform-admin/accounts`를 호출한다.
 * PLATFORM_SUPER만 접근 의미가 있다(URL은 열려 있지만 백엔드가 SUPER 아니면 403).
 * signstage-docs business/user-organization-design.md 7.2절 참고.
 */
export const AdminAccountCreate: FC = () => {
  const [loginId, setLoginId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [platformRole, setPlatformRole] = useState<PlatformRole>('PLATFORM_SUPPORT');

  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<PlatformAdminCreatedUser | null>(null);
  const [copied, setCopied] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!loginId || !name || !email) {
      showSnackbar('아이디/이름/이메일은 필수입니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/accounts', {
        loginId,
        name,
        email,
        phone: phone || null,
        platformRole,
      });
      setCreated(response.data as PlatformAdminCreatedUser);
      showSnackbar('플랫폼 관리자 계정이 생성되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '관리자 계정 생성에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!created) {
      return;
    }
    try {
      await navigator.clipboard.writeText(created.temporaryPassword);
      setCopied(true);
      showSnackbar('임시 비밀번호를 복사했습니다.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showSnackbar('클립보드 복사에 실패했습니다. 직접 선택해 복사해주세요.', 'error');
    }
  };

  return (
    <div className="max-w-lg">
      <Link to="/accounts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        관리자 계정 목록으로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">플랫폼 관리자 계정 생성</h1>
        <p className="mt-1 text-sm text-gray-500">PLATFORM_SUPER만 호출할 수 있는 기능입니다.</p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-500 mb-1">아이디</p>
            <p className="text-base font-bold text-gray-950 mb-1">{created.user.loginId}</p>
            <p className="text-sm text-gray-500 mb-4">등급: {created.user.platformRole}</p>

            <p className="text-sm text-gray-500 mb-1">임시 비밀번호</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono text-gray-950">
                {created.temporaryPassword}
              </code>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="p-2 rounded-md border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
                aria-label="임시 비밀번호 복사"
              >
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="mt-3 text-xs text-red-600">
              이 비밀번호는 서버에 저장되지 않아 지금 화면을 벗어나면 다시 볼 수 없습니다. 지금 바로
              전달하거나 기록해두세요. 첫 로그인 시 비밀번호 변경이 강제됩니다.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to="/accounts"
              className="flex-1 text-center px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              목록으로 이동
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setLoginId('');
                setName('');
                setEmail('');
                setPhone('');
                setPlatformRole('PLATFORM_SUPPORT');
              }}
              className="flex-1 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
            >
              계속 추가하기
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
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
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="로그인에 사용할 아이디"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
              placeholder="이름"
            />
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
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="전화번호"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">플랫폼 권한 등급</label>
            <div className="space-y-2">
              {PLATFORM_ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    platformRole === option.value
                      ? 'border-gray-950 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="platformRole"
                    value={option.value}
                    checked={platformRole === option.value}
                    onChange={() => setPlatformRole(option.value)}
                    disabled={isLoading}
                    className="mt-1"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-950">
                      <ShieldCheck size={14} />
                      {option.label}
                    </span>
                    <span className="text-xs text-gray-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
          >
            {isLoading ? '생성 중...' : '관리자 계정 생성'}
          </button>
        </form>
      )}
    </div>
  );
};
