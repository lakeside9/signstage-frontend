import type { FC } from 'react';
import { formatDateTime } from '../../utils/internationalization';
import { DetailRow } from '../billingCatalog/components';
import { BUSINESS_TYPE_LABEL, statusBadgeClass } from '../order/constants';
import type { PartnerSubcontractProfile } from '../../types';

const doneOrMissing = (value: string | null) =>
  value ? formatDateTime(value) : <span className="text-amber-600">미완료</span>;

/** 파트너 외주 정보 읽기 전용 요약 — 파트너 회사정보 화면과 관리자 파트너 상세가 같이 쓴다(D22). */
export const PartnerProfileSummary: FC<{ profile: PartnerSubcontractProfile }> = ({ profile }) => (
  <div className="divide-y divide-gray-100">
    <DetailRow
      label="발주 자격"
      value={
        <span
          className={`${statusBadgeClass} ${
            profile.orderEligible
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {profile.orderEligible ? '발주 가능' : '요건 미충족'}
        </span>
      }
    />
    <DetailRow label="사업자 유형" value={profile.businessType ? BUSINESS_TYPE_LABEL[profile.businessType] : '-'} />
    <DetailRow label="사업자등록번호" value={profile.businessRegistrationNumber ?? '-'} />
    <DetailRow label="대표자" value={profile.representativeName ?? '-'} />
    <DetailRow
      label="정산 계좌"
      value={
        profile.bankName
          ? `${profile.bankName} ${profile.bankAccountNumber ?? ''} (${profile.accountHolderName ?? ''})`
          : '-'
      }
    />
    <DetailRow label="예금주 확인" value={doneOrMissing(profile.accountVerifiedAt)} />
    <DetailRow label="외주 기본계약 동의" value={doneOrMissing(profile.subcontractTermsAgreedAt)} />
    <DetailRow label="개인정보 처리위탁 동의" value={doneOrMissing(profile.privacyConsignmentAgreedAt)} />
  </div>
);
