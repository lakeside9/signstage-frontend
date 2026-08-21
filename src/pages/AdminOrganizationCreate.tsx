import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Hash, User } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PlatformAdminOrganizationSummary } from '../types';

/**
 * 관리자가 조직을 직접 만드는 화면. `POST /api/platform-admin/organizations`를 호출한다.
 * 계정은 새로 만들지 않는다 — ownerLoginId로 지정한 기존 사용자를 그대로 OWNER로 붙인다
 * (signstage-docs business/user-organization-design.md 5장의 "계정 생성 ≠ 조직 생성" 원칙을
 * 관리자 경로에서도 유지한다). PLATFORM_OPS 이상만 호출할 수 있다.
 */
export const AdminOrganizationCreate: FC = () => {
  const [organizationName, setOrganizationName] = useState('');
  const [code, setCode] = useState('');
  const [ownerLoginId, setOwnerLoginId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<PlatformAdminOrganizationSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!organizationName || !code || !ownerLoginId) {
      showSnackbar('조직 이름/코드/OWNER 아이디는 필수입니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/organizations', {
        organizationName,
        code,
        ownerLoginId,
      });
      setCreated(response.data as PlatformAdminOrganizationSummary);
      showSnackbar('조직이 등록되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '조직 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Link
        to="/admin/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        조직 목록으로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">조직 등록</h1>
        <p className="mt-1 text-sm text-gray-500">
          계정을 새로 만들지 않습니다. 이미 있는 사용자를 아이디로 지정해 OWNER로 붙입니다.
        </p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 text-gray-950 font-bold">
              <Building2 size={18} />
              {created.name}
            </div>
            <p className="text-sm text-gray-500 mt-1">코드: {created.code}</p>
            <p className="text-sm text-gray-500">OWNER: {ownerLoginId}</p>
          </div>

          <div className="flex gap-2">
            <Link
              to={`/admin/organizations/${created.id}`}
              className="flex-1 text-center px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              상세로 이동
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setOrganizationName('');
                setCode('');
                setOwnerLoginId('');
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">OWNER 아이디</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <User size={18} />
              </span>
              <input
                type="text"
                value={ownerLoginId}
                onChange={(e) => setOwnerLoginId(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                placeholder="OWNER로 지정할 기존 사용자의 로그인 아이디"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              이 아이디의 계정이 존재해야 합니다. 계정이 없다면 회원 관리에서 먼저 만들어주세요.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
          >
            {isLoading ? '등록 중...' : '조직 등록'}
          </button>
        </form>
      )}
    </div>
  );
};
