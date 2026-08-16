import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Mail, Phone, UserPlus } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PlatformAdminCreatedUser } from '../types';

/**
 * 관리자가 회원 계정을 직접 만드는 화면. `POST /api/platform-admin/users`를 호출한다.
 * 회원가입(PENDING)→승인 경로를 거치지 않고 즉시 ACTIVE로 만들어진다 — 관리자가
 * 만든다는 행위 자체가 승인이다. 비밀번호는 서버가 임시로 생성해 응답에 한 번만
 * 담아 돌려주므로, 화면에 표시된 뒤 저장하지 않는다(다시 조회 불가).
 * signstage-docs business/platform-admin-member-management.md 참고.
 *
 * 아이디 입력란이 없다 — 이메일을 그대로 로그인 아이디로 쓴다(2026-08-16 결정). 서버가
 * `email`을 `loginId`로 저장하므로 이 화면은 `loginId`를 요청에 아예 담지 않는다.
 */
export const AdminUserCreate: FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<PlatformAdminCreatedUser | null>(null);
  const [copied, setCopied] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name || !email) {
      showSnackbar('이름/이메일은 필수입니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/users', {
        name,
        email,
        phone: phone || null,
      });
      setCreated(response.data as PlatformAdminCreatedUser);
      showSnackbar('회원 계정이 생성되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '회원 생성에 실패했습니다.';
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
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        회원 목록으로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">회원 생성</h1>
        <p className="mt-1 text-sm text-gray-500">
          가입 승인 절차 없이 즉시 활성(ACTIVE) 상태로 계정이 만들어집니다.
        </p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-500 mb-1">아이디</p>
            <p className="text-base font-bold text-gray-950 mb-4">{created.user.loginId}</p>

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
              to={`/users/${created.user.id}`}
              className="flex-1 text-center px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              상세로 이동
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setName('');
                setEmail('');
                setPhone('');
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
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="이메일"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">이 이메일이 로그인 아이디로 사용됩니다.</p>
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
          >
            {isLoading ? '생성 중...' : '회원 생성'}
          </button>
        </form>
      )}
    </div>
  );
};
