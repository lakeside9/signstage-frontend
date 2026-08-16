import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, NotebookPen } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';

/**
 * 로그인한 일반 사용자가 조직 생성을 "요청"하는 화면이다 — signstage-docs
 * business/organization-creation-approval-review.md 3.1/3.3절. 조직은 이 제출만으로 만들어지지
 * 않는다. 플랫폼 관리자가 승인해야 만들어지고, 코드도 그때 관리자가 정한다 — 그래서 이 폼에는
 * 조직 이름과 메모만 있고 코드 입력란이 없다.
 *
 * `OrgLayout` 하위 화면이라 header/sidebar는 레이아웃이 담당하고 이 화면은 본문만 그린다.
 * "조직 관리"(`OrgOrganizationList`, `/org/organizations`)의 "조직 만들기" 링크로 진입하고,
 * 제출 성공 후에는 요청 내역(`OrgOrganizationRequestList`, `/org/organizations/requests`)으로
 * 이동하는 링크를 보여준다 — 승인 전까지는 여기서 진행 상태를 확인해야 한다.
 */
export const OrgOrganizationRequestCreate: FC = () => {
  const [organizationName, setOrganizationName] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!organizationName) {
      showSnackbar('조직 이름을 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/organizations/requests', { organizationName, note: note || undefined });
      setSubmitted(true);
      showSnackbar('조직 생성을 요청했습니다. 관리자 승인을 기다려주세요.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '조직 생성 요청에 실패했습니다.';
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
        <h1 className="text-xl font-bold text-gray-950">조직 생성 요청</h1>
        <p className="mt-1 text-sm text-gray-500">
          제출한 요청은 플랫폼 관리자가 검토합니다. 승인되면 이 계정이 새 조직의 OWNER가 됩니다.
        </p>
      </div>

      {submitted ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 text-gray-950 font-bold">
              <Building2 size={18} />
              {organizationName}
            </div>
            <p className="text-sm text-gray-500 mt-1">요청이 접수되었습니다. 승인 대기 중입니다.</p>
          </div>
          <Link
            to="/org/organizations/requests"
            className="block w-full text-center px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            요청 내역 보기
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
            <label className="block text-sm font-medium text-gray-700 mb-2">메모 (선택)</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <NotebookPen size={18} />
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isLoading}
                rows={3}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50 resize-none"
                placeholder="관리자가 참고할 내용이 있다면 적어주세요."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/org/organizations')}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isLoading ? '제출 중...' : '요청 제출'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
