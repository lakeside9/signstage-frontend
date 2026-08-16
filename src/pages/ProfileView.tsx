import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Loader2, Mail, Phone, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { UserProfile } from '../types';

const LOCALE_OPTIONS = [
  { value: 'ko-KR', label: '한국어' },
  { value: 'en-US', label: 'English' },
];

/**
 * 로그인 후 내 정보(이름/이메일/전화번호/언어)와 비밀번호를 수정하는 화면이다.
 * signstage-backend feature.identity의 GET/PUT /api/identity/me,
 * PUT /api/identity/me/password 를 사용한다.
 *
 * 로그인 아이디는 원래부터 여기서 못 바꾼다(읽기 전용 표시). 이메일은 일반 사용자만 못 바꾼다
 * (2026-08-16 결정) — 회원가입/회원 생성 시점에 이메일을 그대로 loginId로도 저장하기 때문에,
 * 자유롭게 바꾸게 두면 "로그인 아이디로 안내한 값"과 어긋나 보인다. 플랫폼 관리자는 loginId가
 * 이메일과 무관하게 별도로 관리돼(관리자 계정 생성은 이 정책에 포함되지 않음) 예외로 둔다 —
 * `useAuthStore`의 `platformAdmin` 유무로 판단한다(서버도 같은 기준으로 한 번 더 막는다).
 */
export const ProfileView: FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [locale, setLocale] = useState('ko-KR');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const platformAdmin = useAuthStore((state) => state.platformAdmin);
  const updatePlatformAdminName = useAuthStore((state) => state.updatePlatformAdminName);
  const canEditEmail = !!platformAdmin;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/identity/me');
        if (cancelled) {
          return;
        }
        const data = response.data as UserProfile;
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
        setPhone(data.phone ?? '');
        setLocale(data.locale);
      } catch (err) {
        const message = err instanceof Error ? err.message : '내 정보를 불러오지 못했습니다.';
        showSnackbar(message, 'error');
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();

    if (!name || !email) {
      showSnackbar('이름과 이메일은 필수입니다.', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await api.put('/identity/me', { name, email, phone: phone || null, locale });
      const data = response.data as UserProfile;
      setProfile(data);
      updatePlatformAdminName(data.name);
      showSnackbar('내 정보가 수정되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '내 정보 수정에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      showSnackbar('비밀번호 항목을 모두 입력해주세요.', 'error');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showSnackbar('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    setIsSavingPassword(true);
    try {
      await api.put('/identity/me/password', { currentPassword, newPassword });
      showSnackbar('비밀번호가 변경되었습니다.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={18} className="animate-spin" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-950">내 정보</h1>
        <p className="mt-1 text-sm text-gray-500">프로필과 비밀번호를 수정할 수 있습니다.</p>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-950 mb-4">프로필</h2>
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">로그인 아이디</label>
            <input
              type="text"
              value={profile?.loginId ?? ''}
              disabled
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <User size={18} />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSavingProfile}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
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
                disabled={isSavingProfile || !canEditEmail}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
              />
            </div>
            {!canEditEmail && (
              <p className="mt-1.5 text-xs text-gray-500">로그인 아이디로도 사용되고 있어 변경할 수 없습니다.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <Phone size={18} />
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSavingProfile}
                placeholder="선택 입력"
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">언어</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={isSavingProfile}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            >
              {LOCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
          >
            {isSavingProfile ? '저장 중...' : '저장'}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-950 mb-4">비밀번호 변경</h2>
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">현재 비밀번호</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSavingPassword}
              autoComplete="current-password"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSavingPassword}
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호 확인</label>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              disabled={isSavingPassword}
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
          >
            {isSavingPassword ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>
    </div>
  );
};
