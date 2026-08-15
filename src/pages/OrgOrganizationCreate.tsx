import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Hash } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationSummary } from '../types';

/**
 * 로그인한 일반 사용자가 조직을 만드는 화면이다 — 5.1절 (a) 3단계.
 * signstage-docs frontend/screen-composition-plan.md의 화면군 B 중 조직 생성에 해당한다.
 * `OrgLayout` 하위 화면이라 header/sidebar는 레이아웃이 담당하고 이 화면은 본문만 그린다.
 * "조직 관리"(`OrgOrganizationList`, `/org/organizations`)의 "조직 만들기" 링크로 진입하고,
 * 생성 성공 후에는 그 목록으로 돌아가는 링크를 보여준다.
 *
 * 조직 생성 방법 자체(초대 vs 셀프서비스, 진입 지점 등)는 다시 정리할 예정이다 —
 * screen-composition-plan.md 11장 참고.
 */
export const OrgOrganizationCreate: FC = () => {
  const [organizationName, setOrganizationName] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<OrganizationSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

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
    <div className="max-w-lg">
      <Link
        to="/org/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        조직 관리로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">조직 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">이 계정이 자동으로 새 조직의 OWNER가 됩니다.</p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 text-gray-950 font-bold">
              <Building2 size={18} />
              {created.name}
            </div>
            <p className="text-sm text-gray-500 mt-1">코드: {created.code}</p>
          </div>
          <Link
            to="/org/organizations"
            className="block w-full text-center px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            조직 관리로 이동
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">조직 이름</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <Building2 size={18} />
              </span>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="예: 이폼웍스"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">조직 코드</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <Hash size={18} />
              </span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="영문 소문자, 숫자, '-' (예: eformworks)"
              />
            </div>
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
  );
};
