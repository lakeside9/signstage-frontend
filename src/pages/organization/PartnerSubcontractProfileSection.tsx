import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Briefcase, Loader2, Pencil } from 'lucide-react';
import { Button } from '../../components/Button';
import { usePermissionStore } from '../../store/usePermissionStore';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { Field, FormActions } from '../billingCatalog/components';
import { inputClass } from '../billingCatalog/constants';
import { BUSINESS_TYPE_LABEL, blankToNull } from '../order/constants';
import { PartnerProfileSummary } from './PartnerProfileSummary';
import type { PartnerBusinessType, PartnerSubcontractProfile } from '../../types';

interface ProfileDraft {
  businessType: PartnerBusinessType | '';
  businessRegistrationNumber: string;
  representativeName: string;
  bankName: string;
  bankAccountNumber: string;
  accountHolderName: string;
  agreeSubcontractTerms: boolean;
  agreePrivacyConsignment: boolean;
}

const toDraft = (profile: PartnerSubcontractProfile): ProfileDraft => ({
  businessType: profile.businessType ?? '',
  businessRegistrationNumber: profile.businessRegistrationNumber ?? '',
  representativeName: profile.representativeName ?? '',
  bankName: profile.bankName ?? '',
  bankAccountNumber: profile.bankAccountNumber ?? '',
  accountHolderName: profile.accountHolderName ?? '',
  agreeSubcontractTerms: profile.subcontractTermsAgreedAt !== null,
  agreePrivacyConsignment: profile.privacyConsignmentAgreedAt !== null,
});

/**
 * 파트너 외주 정보(조직 OWNER) — signstage-docs business/platform-order-partner-subcontract-review.md
 * D22. 사업자 정보·정산 계좌·외주 기본계약·처리위탁 동의를 채워야 플랫폼 발주를 받을 수 있다.
 * 계좌는 플랫폼 관리자가 예금주를 확인해야 하고, 계좌를 바꾸면 확인이 풀린다. 동의는 한 번 하면
 * 철회하지 않는다(체크를 풀어도 서버는 유지한다).
 */
export const PartnerSubcontractProfileSection: FC<{ organizationId: string }> = ({ organizationId }) => {
  const canEdit = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_PROFILE_EDIT'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [profile, setProfile] = useState<PartnerSubcontractProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const endpoint = `/organizations/${organizationId}/partner-profile`;

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    api.get(endpoint)
      .then((response) => {
        if (!cancelled) setProfile(response.data as PartnerSubcontractProfile);
      })
      .catch((err) => {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '외주 정보를 불러오지 못했습니다.', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit, endpoint, showSnackbar]);

  if (!canEdit) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.businessType) {
      showSnackbar('사업자 유형을 고르세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.put(endpoint, {
        businessType: draft.businessType,
        businessRegistrationNumber: blankToNull(draft.businessRegistrationNumber),
        representativeName: blankToNull(draft.representativeName),
        bankName: blankToNull(draft.bankName),
        bankAccountNumber: blankToNull(draft.bankAccountNumber),
        accountHolderName: blankToNull(draft.accountHolderName),
        agreeSubcontractTerms: draft.agreeSubcontractTerms,
        agreePrivacyConsignment: draft.agreePrivacyConsignment,
      });
      setProfile(response.data as PartnerSubcontractProfile);
      setDraft(null);
      showSnackbar('외주 정보를 저장했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const textField = (field: keyof ProfileDraft, label: string, placeholder?: string) => (
    <Field label={label}>
      <input
        value={draft ? String(draft[field]) : ''}
        onChange={(e) => setDraft((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))}
        disabled={isSaving}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <Briefcase size={14} />
          외주 정보(플랫폼 발주 수령 요건)
        </h2>
        {profile && !draft && (
          <Button variant="secondary" size="sm" onClick={() => setDraft(toDraft(profile))}>
            <Pencil size={12} /> 수정
          </Button>
        )}
      </div>

      {!profile ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : draft ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="사업자 유형">
              <select
                value={draft.businessType}
                onChange={(e) => setDraft({ ...draft, businessType: e.target.value as PartnerBusinessType | '' })}
                disabled={isSaving}
                className={`${inputClass} bg-white`}
              >
                <option value="">선택</option>
                {Object.entries(BUSINESS_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            {textField('businessRegistrationNumber', '사업자등록번호', draft.businessType === 'INDIVIDUAL' ? '개인은 비워둡니다' : '000-00-00000')}
            {textField('representativeName', '대표자')}
            {textField('bankName', '은행')}
            {textField('bankAccountNumber', '계좌번호')}
            {textField('accountHolderName', '예금주')}
          </div>
          <p className="text-xs text-gray-400">계좌를 바꾸면 플랫폼의 예금주 확인을 다시 받아야 발주를 받을 수 있습니다.</p>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.agreeSubcontractTerms}
              onChange={(e) => setDraft({ ...draft, agreeSubcontractTerms: e.target.checked })}
              disabled={isSaving || profile.subcontractTermsAgreedAt !== null}
            />
            외주 기본계약에 동의합니다.
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.agreePrivacyConsignment}
              onChange={(e) => setDraft({ ...draft, agreePrivacyConsignment: e.target.checked })}
              disabled={isSaving || profile.privacyConsignmentAgreedAt !== null}
            />
            서명자 개인정보 처리위탁 계약에 동의합니다.
          </label>
          <FormActions isSaving={isSaving} savingLabel="저장 중..." saveLabel="저장" onCancel={() => setDraft(null)} />
        </form>
      ) : (
        <PartnerProfileSummary profile={profile} />
      )}
    </div>
  );
};
