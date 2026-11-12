import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { BadgeCheck, Briefcase, Loader2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { usePermissionStore } from '../../store/usePermissionStore';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { PartnerProfileSummary } from './PartnerProfileSummary';
import type { PartnerSubcontractProfile } from '../../types';

/**
 * 관리자 파트너 상세의 외주 정보 — 파트너가 입력한 정산 계좌의 예금주를 확인한다(D22).
 * 확인 전에는 발주할 수 없다.
 */
export const AdminPartnerProfileSection: FC<{ organizationId: string }> = ({ organizationId }) => {
  const canVerify = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_PROFILE_VERIFY'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [profile, setProfile] = useState<PartnerSubcontractProfile | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const endpoint = `/platform-admin/organizations/${organizationId}/partner-profile`;

  useEffect(() => {
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
  }, [endpoint, showSnackbar]);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await api.post(`${endpoint}/account-verification`);
      setProfile(response.data as PartnerSubcontractProfile);
      showSnackbar('예금주 확인을 기록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '예금주 확인에 실패했습니다.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <Briefcase size={14} />
          외주 정보
        </h2>
        {canVerify && profile?.bankName && !profile.accountVerifiedAt && (
          <Button size="sm" onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />}
            예금주 확인 완료
          </Button>
        )}
      </div>
      {profile ? (
        <PartnerProfileSummary profile={profile} />
      ) : (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      )}
    </div>
  );
};
