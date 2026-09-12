import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CeremonySummary } from '../types';

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

/**
 * 행사(Ceremony) 등록 화면. 제목만 먼저 등록하고 플랜은 나중에 고른다(2026-09-10, 사용자
 * 요청 — signstage-docs
 * business/ceremony-registration-flow-and-billing-tab-separation-review.md) — "선등록
 * 후플랜" 원칙은 그대로다. 예전엔 이 화면이 플랜 선택까지 같이 받았지만(business/
 * ceremony-billing-options-review.md 4.10절 "생성 시 필수" 결정), 그 결정을 뒤집었다 —
 * 등록 직후 수정 화면의 "과금" 탭으로 곧장 이동해 플랜을 고른다.
 *
 * <p><b>제목 외 나머지 정보도 함께 받는다(2026-09-12 사용자 요청)</b> — 예전엔 제목만
 * 받고 설명/주관 기관·부서/담당자 정보는 등록 후 수정 화면에서만 입력할 수 있었다. 플랜과
 * 무관한 이 정보들은 "선등록 후플랜" 원칙과 충돌하지 않아 등록 화면에서 함께 받도록
 * 넓혔다 — `UserCeremonyEdit.tsx`의 "행사 정보" 탭과 같은 필드 구성이고, 전부 선택
 * 입력이라 비워두고 나중에 채워도 된다.
 */
export const UserCeremonyCreate: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [organizingInstitution, setOrganizingInstitution] = useState('');
  const [organizingDepartment, setOrganizingDepartment] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
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
        description: description.trim() || null,
        organizingInstitution: organizingInstitution.trim() || null,
        organizingDepartment: organizingDepartment.trim() || null,
        contactName: contactName.trim() || null,
        contactTitle: contactTitle.trim() || null,
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
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
          제목만 입력해도 등록할 수 있습니다 — 나머지 정보는 지금 채워도 되고, 등록 후 수정 화면에서 채워도 됩니다.
          과금 플랜은 등록 직후 이어지는 화면에서 고릅니다.
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">행사 주관 기관</label>
            <input
              type="text"
              value={organizingInstitution}
              onChange={(e) => setOrganizingInstitution(e.target.value)}
              disabled={isLoading}
              placeholder="선택 입력"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">행사 주관 부서</label>
            <input
              type="text"
              value={organizingDepartment}
              onChange={(e) => setOrganizingDepartment(e.target.value)}
              disabled={isLoading}
              placeholder="선택 입력"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">담당자명</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={isLoading}
              placeholder="선택 입력"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">담당자 직위</label>
            <input
              type="text"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              disabled={isLoading}
              placeholder="선택 입력"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">담당자 전화번호</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={isLoading}
              placeholder="선택 입력"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">담당자 이메일</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={isLoading}
              placeholder="선택 입력"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">행사 설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={3}
            placeholder="선택 입력"
            className={`${inputClass} resize-none`}
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
