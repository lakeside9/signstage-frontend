import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, Key, LogIn, QrCode, ScreenShare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * 로그인 화면(LoginView) 진입 전에 보여주는 인트로(랜딩) 화면.
 *
 * `/`에 인증 없이 접근하면 이 화면이 뜨고(ProtectedRoute 참고), 로그인에 성공하면 기존
 * LoginView의 리다이렉트 로직(권한별 /admin, /demo, / 분기)이 그대로 적용되어 권한에 맞는
 * 기존 화면으로 이동한다 — 이 화면은 그 로직을 바꾸지 않고 로그인 이전 진입점만 추가한다.
 */
export const IntroView: FC = () => {
  const { t } = useTranslation();

  const features: Array<{ icon: FC<{ size?: number; className?: string }>; titleKey: string; descriptionKey: string }> = [
    { icon: FileCheck2, titleKey: 'intro.feature.signing.title', descriptionKey: 'intro.feature.signing.description' },
    { icon: ScreenShare, titleKey: 'intro.feature.projector.title', descriptionKey: 'intro.feature.projector.description' },
    { icon: QrCode, titleKey: 'intro.feature.portal.title', descriptionKey: 'intro.feature.portal.description' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-950">
      <header className="h-16 shrink-0 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between px-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-gray-950 p-1.5 rounded-lg text-white">
            <Key size={20} />
          </div>
          <span className="text-lg font-bold text-gray-950">SignStage</span>
        </Link>

        <Link
          to="/login"
          className="flex items-center gap-1.5 bg-gray-950 hover:bg-gray-800 text-white font-bold px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
        >
          <LogIn size={16} />
          {t('auth.signIn')}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-3xl w-full text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight">{t('intro.title')}</h1>
          <p className="mt-4 text-base sm:text-lg text-gray-500">{t('intro.description')}</p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="bg-gray-950 hover:bg-gray-800 text-white font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm text-sm"
            >
              {t('auth.signIn')}
            </Link>
            <Link
              to="/signup"
              className="bg-white hover:bg-gray-100 text-gray-950 font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm border border-gray-200 text-sm"
            >
              {t('auth.signUp')}
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {features.map(({ icon: Icon, titleKey, descriptionKey }) => (
              <div key={titleKey} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <div className="inline-flex items-center justify-center w-9 h-9 bg-gray-950 rounded-lg text-white mb-3">
                  <Icon size={18} />
                </div>
                <h2 className="text-sm font-bold text-gray-950">{t(titleKey)}</h2>
                <p className="mt-1.5 text-sm text-gray-500">{t(descriptionKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200 bg-white px-4 sm:px-8 py-5 text-center text-xs text-gray-400">
        {t('intro.footer', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
};
