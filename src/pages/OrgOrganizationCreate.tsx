import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Key, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationSummary } from '../types';

/**
 * 로그인한 일반 사용자가 조직을 만드는 화면이다 — 5.1절 (a) 3단계.
 * signstage-docs frontend/screen-composition-plan.md의 화면군 B 중 조직 생성에 해당한다.
 * 생성 성공 후에는 `OrgDashboard`(`/org`)로 이동하는 링크를 보여준다.
 *
 * 조직 생성 방법 자체(초대 vs 셀프서비스, 진입 지점 등)는 다시 정리할 예정이다 —
 * screen-composition-plan.md 11장 참고.
 */
export const OrgOrganizationCreate: FC = () => {
  const [organizationName, setOrganizationName] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<OrganizationSummary | null>(null);

  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!organizationName || !code) {
      showSnackbar('조직 이름과 코드를 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/organizations', { organizationName, code });
      const data = response.data as OrganizationSummary;
      setCreated(data);
      showSnackbar('조직이 생성되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '조직 생성에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-gray-950">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 flex items-center gap-2 text-gray-500 hover:text-gray-950 transition-colors text-sm font-medium"
      >
        <LogOut size={18} />
        로그아웃
      </button>

      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-950 rounded-lg mb-4 text-white">
            <Key size={24} />
          </div>
          <h1 className="text-lg font-bold text-gray-950">SignStage</h1>
          <p className="text-sm text-gray-500 mt-1">
            {created ? '조직이 생성되었습니다' : '아직 소속된 조직이 없습니다. 조직을 만들어주세요.'}
          </p>
        </div>

        {created ? (
          <div className="space-y-4 text-center">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
              <div className="flex items-center gap-2 text-gray-950 font-bold">
                <Building2 size={18} />
                {created.name}
              </div>
              <p className="text-sm text-gray-500 mt-1">코드: {created.code}</p>
            </div>
            <p className="text-sm text-gray-500">이 계정이 자동으로 OWNER가 됩니다.</p>
            <Link
              to="/org"
              className="block w-full text-center px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              대시보드로 이동
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">조직 이름</label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="예: 이폼웍스"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">조직 코드</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="영문 소문자, 숫자, '-' (예: eformworks)"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isLoading ? '생성 중...' : '조직 생성'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
