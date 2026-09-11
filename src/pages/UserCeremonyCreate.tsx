import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CeremonySummary } from '../types';

/**
 * 행사(Ceremony) 등록 화면. 제목만 먼저 등록하고 플랜은 나중에 고른다(2026-09-10, 사용자
 * 요청 — signstage-docs
 * business/ceremony-registration-flow-and-billing-tab-separation-review.md). 예전엔 이 화면이
 * 플랜 선택까지 같이 받았지만(business/ceremony-billing-options-review.md 4.10절 "생성 시 필수"
 * 결정), 그 결정을 뒤집었다 — 등록 직후 수정 화면의 "과금" 탭으로 곧장 이동해 플랜을 고른다.
 */
export const UserCeremonyCreate: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showSnackbar('행사 제목을 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post(`/organizations/${organizationId}/ceremonies`, {
        title: title.trim(),
      });
      const created = response.data as CeremonySummary;
      showSnackbar('행사가 등록되었습니다. 이어서 과금 플랜을 선택해주세요.', 'success');
      navigate(`/ceremonies/${organizationId}/${created.id}/edit?tab=billing`, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '행사 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Link
        to={`/ceremonies/${organizationId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        행사 목록으로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">행사 등록</h1>
        <p className="mt-1 text-sm text-gray-500">
          제목만 먼저 등록하면 됩니다. 과금 플랜과 나머지 정보는 등록 직후 수정 화면에서 채울 수 있습니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">행사 제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            placeholder="예: 2026년 상반기 협약식"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button to={`/ceremonies/${organizationId}`} variant="secondary">
            취소
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? '등록 중...' : '행사 등록'}
          </Button>
        </div>
      </form>
    </div>
  );
};
