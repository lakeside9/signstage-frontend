import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Hash, User } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { PlatformAdminOrganizationSummary } from '../types';

/**
 * 관리자가 파트너를 직접 만드는 화면. `POST /api/platform-admin/organizations`를 호출한다.
 * 계정은 새로 만들지 않는다 — ownerLoginId로 지정한 기존 사용자를 그대로 OWNER로 붙인다
 * (signstage-docs business/user-organization-design.md 5장의 "계정 생성 ≠ 조직 생성" 원칙을
 * 관리자 경로에서도 유지한다). PLATFORM_OPS 이상만 호출할 수 있다.
 *
 * <p>"데모 조직으로 생성"을 체크하면 OWNER 아이디 입력 자체를 숨긴다 — 서버가 조직 코드로부터
 * 자리표시자 OWNER 계정을 자동으로 만들어준다(아무도 로그인하지 않는다, signstage-docs
 * business/demo-account-exhibition-signer-preview-review.md 11.3절). 관리자 본인 계정을
 * OWNER로 지정할 수 없다는 기존 제약(플랫폼 관리자↔조직 멤버 겸직 불가, 2026-08-24 결정)과
 * 부딪혀 매번 별도 계정을 미리 만들어야 하는 번거로움을 없앴다.
 */
export const AdminOrganizationCreate: FC = () => {
  const [organizationName, setOrganizationName] = useState('');
  const [code, setCode] = useState('');
  const [ownerLoginId, setOwnerLoginId] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<PlatformAdminOrganizationSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!organizationName || !code || (!isDemo && !ownerLoginId)) {
      showSnackbar(isDemo ? '파트너 이름/코드는 필수입니다.' : '파트너 이름/코드/OWNER 아이디는 필수입니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/organizations', {
        organizationName,
        code,
        ownerLoginId: isDemo ? undefined : ownerLoginId,
        isDemo,
      });
      setCreated(response.data as PlatformAdminOrganizationSummary);
      showSnackbar('파트너가 등록되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '파트너 등록에 실패했습니다.';
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
        파트너 목록으로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">파트너 등록</h1>
        <p className="mt-1 text-sm text-gray-500">
          일반 파트너는 계정을 새로 만들지 않고 이미 있는 사용자를 아이디로 지정해 OWNER로 붙입니다.
          데모 조직은 OWNER 계정을 서버가 자동으로 만듭니다.
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
            {created.isDemo ? (
              <p className="text-sm text-gray-500">데모 조직입니다 — OWNER 자리표시자 계정이 자동으로 만들어졌습니다.</p>
            ) : (
              <p className="text-sm text-gray-500">OWNER: {ownerLoginId}</p>
            )}
          </div>

          <div className="flex gap-2">
            {created.isDemo ? (
              <Button to={`/ceremonies/${created.id}`} className="flex-1">
                데모 행사 관리로 이동
              </Button>
            ) : (
              <Button to={`/admin/organizations/${created.id}`} className="flex-1">
                상세로 이동
              </Button>
            )}
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setCreated(null);
                setOrganizationName('');
                setCode('');
                setOwnerLoginId('');
                setIsDemo(false);
              }}
            >
              계속 추가하기
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">파트너 이름</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">파트너 코드</label>
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
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
                disabled={isLoading}
              />
              데모 조직으로 생성
            </label>
            <p className="mt-1.5 text-xs text-gray-500">
              체크하면 OWNER 계정을 서버가 자동으로 만듭니다(아무도 로그인하지 않는 자리표시자).
              플랫폼 관리자가 데모 행사 관리 메뉴에서 행사 생성부터 서명자 등록·하위 행사 제어까지
              직접 합니다(signstage-docs business/demo-account-exhibition-signer-preview-review.md 11장).
            </p>
          </div>

          {!isDemo && (
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
                이 아이디의 계정이 존재해야 합니다. 계정이 없다면 회원 관리에서 먼저 만들어주세요. 관리자
                본인 계정은 지정할 수 없습니다(플랫폼 관리자는 조직에 소속될 수 없습니다).
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? '등록 중...' : '파트너 등록'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
