import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Loader2, Mail, Phone, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { UserProfile } from '../types';
import {
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_TIME_ZONE_ID,
  setInternationalizationPreferences,
} from '../utils/internationalization';
import { useTranslation } from 'react-i18next';

const LOCALE_OPTIONS = [
  { value: 'ko-KR', label: '한국 형식 (ko-KR)' },
  { value: 'en-US', label: 'US format (en-US)' },
];

const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

const TIME_ZONE_OPTIONS = ['Asia/Seoul', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

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
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [languageCode, setLanguageCode] = useState(DEFAULT_LANGUAGE_CODE);
  const [locale, setLocale] = useState('ko-KR');
  const [timeZoneId, setTimeZoneId] = useState(DEFAULT_TIME_ZONE_ID);
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
        setLanguageCode(data.languageCode);
        setLocale(data.locale);
        setTimeZoneId(data.timeZoneId);
        setInternationalizationPreferences({
          languageCode: data.languageCode,
          formatLocale: data.locale,
          timeZoneId: data.timeZoneId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : t('profile.loadFailed');
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
      showSnackbar(t('profile.required'), 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await api.put('/identity/me', {
        name,
        email,
        phone: phone || null,
        languageCode,
        locale,
        timeZoneId,
      });
      const data = response.data as UserProfile;
      setProfile(data);
      setInternationalizationPreferences({
        languageCode: data.languageCode,
        formatLocale: data.locale,
        timeZoneId: data.timeZoneId,
      });
      updatePlatformAdminName(data.name);
      showSnackbar(t('profile.saved'), 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.saveFailed');
      showSnackbar(message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      showSnackbar(t('profile.passwordFieldsRequired'), 'error');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showSnackbar(t('profile.passwordMismatch'), 'error');
      return;
    }

    setIsSavingPassword(true);
    try {
      await api.put('/identity/me/password', { currentPassword, newPassword });
      showSnackbar(t('profile.passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.passwordChangeFailed');
      showSnackbar(message, 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={18} className="animate-spin" />
        {t('profile.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-950">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('profile.description')}</p>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-950 mb-4">{t('profile.profile')}</h2>
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.loginId')}</label>
            <input
              type="text"
              value={profile?.loginId ?? ''}
              disabled
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.name')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.email')}</label>
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
              <p className="mt-1.5 text-xs text-gray-500">{t('profile.emailLocked')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.phone')}</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <Phone size={18} />
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSavingProfile}
                placeholder={t('profile.optional')}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.language')}</label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              disabled={isSavingProfile}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.formatLocale')}</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.timeZone')}</label>
            <select
              value={timeZoneId}
              onChange={(e) => setTimeZoneId(e.target.value)}
              disabled={isSavingProfile}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            >
              {TIME_ZONE_OPTIONS.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
          >
            {t(isSavingProfile ? 'profile.saving' : 'profile.save')}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-950 mb-4">{t('profile.passwordChange')}</h2>
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.currentPassword')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.newPassword')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.confirmNewPassword')}</label>
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
            {t(isSavingPassword ? 'profile.changing' : 'profile.passwordChange')}
          </button>
        </form>
      </section>
    </div>
  );
};
