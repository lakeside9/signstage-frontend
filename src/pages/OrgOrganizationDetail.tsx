import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Loader2, Pencil, X } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationSummary } from '../types';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  SUSPENDED: '정지',
  TRIAL: '체험',
};

/**
 * 내가 속한 조직 하나의 상세/설정 화면(`/org/organizations/:organizationId`). "조직 관리"
 * (`OrgOrganizationList`) 목록의 조직 행에서 진입한다. OWNER만 이름/기본 언어를 수정할 수 있다
 * (`PUT /api/organizations/{id}`) — screen-composition-plan.md "조직 설정" 항목. 코드는 조직
 * 식별자라 이 화면에서 바꿀 수 없다. 멤버 관리는 아직 화면이 없다(범위 밖).
 */
export const OrgOrganizationDetail: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [nameDraft, setNameDraft] = useState('');
  const [localeDraft, setLocaleDraft] = useState('');

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/organizations/${organizationId}`);
        if (!cancelled) {
          const data = response.data as OrganizationSummary;
          setOrganization(data);
          setNameDraft(data.name);
          setLocaleDraft(data.defaultLocale);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '조직 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate('/org/organizations', { replace: true });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const startEdit = () => {
    if (!organization) return;
    setNameDraft(organization.name);
    setLocaleDraft(organization.defaultLocale);
    setIsEditing(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameDraft.trim() || !localeDraft.trim()) {
      showSnackbar('조직 이름과 기본 언어를 입력해주세요.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.put(`/organizations/${organizationId}`, {
        name: nameDraft.trim(),
        defaultLocale: localeDraft.trim(),
      });
      setOrganization(response.data as OrganizationSummary);
      setIsEditing(false);
      showSnackbar('조직 정보를 저장했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '조직 정보 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  const canEdit = organization.myRole === 'OWNER';

  return (
    <div className="max-w-lg">
      <Link
        to="/org/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        조직 관리로
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Building2 size={20} className="text-gray-400" />
            {organization.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">내 역할: {organization.myRole}</p>
        </div>
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50 text-gray-600 border-gray-200">
          {STATUS_LABEL[organization.status] ?? organization.status}
        </span>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">조직 이름</label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기본 언어</label>
            <input
              type="text"
              value={localeDraft}
              onChange={(e) => setLocaleDraft(e.target.value)}
              disabled={isSaving}
              placeholder="예: ko-KR"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 disabled:opacity-50"
            >
              <X size={14} />
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          <DetailRow icon={<Building2 size={16} />} label="조직 이름" value={organization.name} />
          <DetailRow label="조직 코드" value={organization.code} />
          <DetailRow icon={<Globe size={16} />} label="기본 언어" value={organization.defaultLocale} />
          <DetailRow label="생성일" value={new Date(organization.createdAt).toLocaleString('ko-KR')} />
        </div>
      )}

      {!isEditing && (
        <div className="mt-4">
          {canEdit ? (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
            >
              <Pencil size={14} />
              조직 정보 수정
            </button>
          ) : (
            <p className="text-xs text-gray-400">조직 정보 수정은 OWNER만 할 수 있습니다.</p>
          )}
        </div>
      )}
    </div>
  );
};

const DetailRow: FC<{ icon?: ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <span className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500">
      {icon}
      {label}
    </span>
    <span className="text-sm text-gray-950">{value}</span>
  </div>
);
