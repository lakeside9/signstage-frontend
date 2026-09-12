import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Loader2, Percent, Pencil, X } from 'lucide-react';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import { usePermissionStore } from '../../store/usePermissionStore';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatCurrency } from '../../utils/internationalization';
import type { MarginType, OrganizationMarginPolicy } from '../../types';

const MARGIN_TYPE_LABEL: Record<MarginType, string> = {
  PERCENT: '정률(%)',
  FIXED_AMOUNT: '정액',
};

/**
 * 조직 상세(`UserOrganizationDetail`) 안에 얹는 "재판매 마진" 섹션 — signstage-docs
 * business/platform-partner-customer-billing-model-reference.md 4장 결정(2026-09-11). 파트너가
 * 실고객에게 시스템 사용료를 재판매할 때 원가 위에 얹는 기본 마진이다 — 행사별로 다르게
 * 쓰고 싶으면 행사 수정 화면의 "고객 견적" 탭에서 override할 수 있다. 설정·조회 전부
 * OWNER 전용(`ACTION_MARGIN_POLICY_MANAGE`)이라 그 권한이 없으면 섹션 자체를 숨긴다 — 플랫폼은
 * 이 값에 상한·승인 등 어떤 통제도 두지 않는다(파트너 재량).
 */
export const OrganizationMarginPolicySection: FC<{ organizationId: string }> = ({ organizationId }) => {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canManage = hasPermission('ACTION_MARGIN_POLICY_MANAGE');

  const [policy, setPolicy] = useState<OrganizationMarginPolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [marginType, setMarginType] = useState<MarginType>('PERCENT');
  const [marginValue, setMarginValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    if (!canManage) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/organizations/${organizationId}/margin-policy`);
        if (!cancelled) setPolicy(response.data as OrganizationMarginPolicy);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '마진 설정을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, canManage]);

  const openEditForm = () => {
    setMarginType(policy?.marginType ?? 'PERCENT');
    setMarginValue(policy?.marginValue != null ? String(policy.marginValue) : '');
    setIsEditing(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(marginValue);
    if (!marginValue.trim() || Number.isNaN(value) || value < 0) return;
    setIsSaving(true);
    try {
      const response = await api.put(`/organizations/${organizationId}/margin-policy`, { marginType, marginValue: value });
      setPolicy(response.data as OrganizationMarginPolicy);
      setIsEditing(false);
      showSnackbar('기본 마진을 저장했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '마진 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <Percent size={14} />
          재판매 마진
        </h2>
        {!isEditing && (
          <button
            onClick={openEditForm}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
          >
            <Pencil size={12} />
            {policy?.marginType ? '수정' : '설정'}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        실고객에게 시스템 사용료를 재판매할 때 원가 위에 얹을 기본 마진입니다. 행사별로 다르게 쓰고 싶으면 해당 행사의
        "고객 견적" 탭에서 따로 설정할 수 있습니다.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500">마진</label>
            <button type="button" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-950">
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={marginType}
              onChange={(e) => setMarginType(e.target.value as MarginType)}
              disabled={isSaving}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
            >
              <option value="PERCENT">정률(%)</option>
              <option value="FIXED_AMOUNT">정액</option>
            </select>
            <FormattedNumberInput
              min={0}
              step="0.01"
              value={marginValue}
              onChange={setMarginValue}
              disabled={isSaving}
              placeholder={marginType === 'PERCENT' ? '예: 20' : '예: 10000'}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving || !marginValue.trim() || Number(marginValue) < 0}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      ) : policy?.marginType ? (
        <p className="text-sm text-gray-950 font-medium">
          {policy.marginType === 'PERCENT' ? `${policy.marginValue}%` : formatCurrency(policy.marginValue ?? 0, 'KRW')}
          <span className="ml-1.5 text-xs font-normal text-gray-400">({MARGIN_TYPE_LABEL[policy.marginType]})</span>
        </p>
      ) : (
        <p className="text-sm text-gray-500">아직 기본 마진을 설정하지 않았습니다.</p>
      )}
    </div>
  );
};
