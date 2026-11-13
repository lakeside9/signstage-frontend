import { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogIn } from 'lucide-react';
import logo from '../assets/signstage-logo.png';
import { useAuthStore } from '../store/useAuthStore';

/** 푸터 사업자 정보 — 견적서 공급자와 같은 회사다. 바뀌면 여기만 고친다. */
const COMPANY = {
  name: '주식회사 이폼웍스',
  representative: '김홍래',
  businessNumber: '392-87-02096',
  address: '서울시 강남구 테헤란로 10길 15, 아이온빌딩',
  email: 'support@eformworks.com',
};

/**
 * 로그인 없이 보는 공개 화면의 레이아웃(2026-11-13) — 위에 로고와 로그인 버튼, 가운데 콘텐츠, 아래 푸터(사업자 정보·문의하기).
 * 홈(`/`, 로그인 전)·공지사항(`/notices`)·문의하기(`/contact`)가 쓴다. 화면 구성은 위드싸인 홈페이지를 참고했고, 룩앤필은 콘솔과 같은
 * 회색 톤을 유지한다(추후 별도 작업). 로그인한 사용자가 문의하기에 들어오면 로그인 버튼 대신 "콘솔로 이동"을 보인다.
 */
export const PublicLayout: FC<{ children?: ReactNode }> = ({ children }) => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const platformAdmin = useAuthStore((state) => state.platformAdmin);
  const location = useLocation();

  useEffect(() => {
    // 화면을 옮기면 맨 위로, "#workflow"처럼 앵커가 있으면 그 자리로 스크롤한다.
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen bg-white flex flex-col text-gray-950">
      <header className="sticky top-0 z-30 h-16 shrink-0 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link to="/" className="flex items-center" aria-label="싸인스테이지 홈">
            <img src={logo} alt="SignStage 싸인스테이지" className="h-9 w-auto" />
          </Link>

          {isLoggedIn ? (
            <Link
              to={platformAdmin ? '/admin' : '/'}
              className="inline-flex items-center gap-1.5 bg-gray-950 hover:bg-gray-800 text-white font-bold px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
            >
              <LayoutDashboard size={16} /> 콘솔로 이동
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 bg-gray-950 hover:bg-gray-800 text-white font-bold px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
            >
              <LogIn size={16} /> 로그인
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children ?? <Outlet />}</main>

      <footer className="shrink-0 border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-8 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <img src={logo} alt="SignStage 싸인스테이지" className="h-8 w-auto" />
            <div className="text-xs text-gray-400 space-y-1">
              <p className="flex flex-wrap gap-x-3 gap-y-1">
                <span>{COMPANY.name}</span>
                <span>대표자 {COMPANY.representative}</span>
                <span>사업자등록번호 {COMPANY.businessNumber}</span>
              </p>
              <p className="flex flex-wrap gap-x-3 gap-y-1">
                <span>{COMPANY.address}</span>
                <span>
                  이메일{' '}
                  <a href={`mailto:${COMPANY.email}`} className="hover:text-gray-950">
                    {COMPANY.email}
                  </a>
                </span>
              </p>
              <p>© {new Date().getFullYear()} e.Form Works Co.,Ltd. All rights reserved.</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm text-gray-500">
            <Link to="/notices" className="hover:text-gray-950">공지사항</Link>
            <Link to="/contact" className="hover:text-gray-950">문의하기</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
