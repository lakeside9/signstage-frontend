import type {
  CustomerStatus,
  InspectionApprovalType,
  InspectionStatus,
  PartnerBusinessType,
  PartnerLedgerEntryType,
  PartnerOrderStatus,
  PartnerPayoutStatus,
  SalesOrderAcceptanceChannel,
  SalesOrderStatus,
  ServiceRegion,
} from '../../types';
import { formatCurrency } from '../../utils/internationalization';

/*
 * 플랫폼 수주·파트너 발주 화면 공용 라벨·포맷 — signstage-docs
 * business/platform-order-partner-subcontract-review.md 12장.
 */

export const REGION_LABEL: Record<ServiceRegion, string> = {
  CAPITAL: '수도권',
  CHUNGCHEONG_GANGWON: '충청·강원',
  YEONGNAM_HONAM: '영남·호남',
  JEJU_ISLAND: '제주·도서',
};

export const REGION_OPTIONS = Object.entries(REGION_LABEL).map(([value, label]) => ({
  value: value as ServiceRegion,
  label,
}));

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = { ACTIVE: '거래중', INACTIVE: '중지' };

export const SALES_ORDER_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  QUOTED: '견적',
  ACCEPTED: '수주 확정',
  CANCELLED: '취소',
};

export const SALES_ORDER_STATUS_STYLE: Record<SalesOrderStatus, string> = {
  QUOTED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

export const ACCEPTANCE_CHANNEL_LABEL: Record<SalesOrderAcceptanceChannel, string> = {
  CUSTOMER_LINK: '고객 견적 링크',
  PLATFORM_RECORDED: '관리자 기록',
};

export const PARTNER_ORDER_STATUS_LABEL: Record<PartnerOrderStatus, string> = {
  ISSUED: '응답 대기',
  ACCEPTED: '수락',
  REJECTED: '거절',
  EXPIRED: '기한 만료',
  CANCELLED: '취소',
};

export const PARTNER_ORDER_STATUS_STYLE: Record<PartnerOrderStatus, string> = {
  ISSUED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  EXPIRED: 'bg-gray-50 text-gray-500 border-gray-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = { PENDING: '검수 대기', APPROVED: '검수 승인' };

export const INSPECTION_STATUS_STYLE: Record<InspectionStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const INSPECTION_APPROVAL_TYPE_LABEL: Record<InspectionApprovalType, string> = {
  MANUAL: '플랫폼 승인',
  DEEMED: '기한 경과 승인 간주',
};

export const PAYOUT_STATUS_LABEL: Record<PartnerPayoutStatus, string> = {
  CONFIRMED: '지급 대기',
  PAID: '지급 완료',
  CANCELLED: '취소',
};

export const PAYOUT_STATUS_STYLE: Record<PartnerPayoutStatus, string> = {
  CONFIRMED: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

export const LEDGER_ENTRY_TYPE_LABEL: Record<PartnerLedgerEntryType, string> = { PAYABLE: '지급 의무', PAYMENT: '지급' };

/** 지난달(yyyy-MM, 브라우저 현지 기준) — 월 정산은 지난달까지만 된다. */
export const previousMonth = () => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const BUSINESS_TYPE_LABEL: Record<PartnerBusinessType, string> = {
  GENERAL: '일반과세자',
  SIMPLIFIED: '간이과세자',
  INDIVIDUAL: '개인(사업자 아님)',
};

export const PLATFORM_CURRENCY_CODE = 'KRW';

export const formatMoney = (value: number | null | undefined, currencyCode = PLATFORM_CURRENCY_CODE) =>
  value === null || value === undefined ? '-' : formatCurrency(value, currencyCode);

/**
 * 일정·발주 응답 기한처럼 현지 벽시계로 저장된 시각("YYYY-MM-DDTHH:mm[:ss]")을 시간대 변환 없이
 * 그대로 보여준다 — `formatDateTime`은 UTC로 보고 변환하므로 여기 쓰면 9시간 어긋난다.
 */
export const formatWallDateTime = (value: string | null | undefined) =>
  value ? value.replace('T', ' ').slice(0, 16) : '-';

export const formatSchedule = (startsAt: string | null | undefined, endsAt: string | null | undefined) => {
  if (!startsAt && !endsAt) return '미정';
  if (startsAt && endsAt && startsAt.slice(0, 10) === endsAt.slice(0, 10)) {
    return `${formatWallDateTime(startsAt)} ~ ${endsAt.slice(11, 16)}`;
  }
  return `${formatWallDateTime(startsAt)} ~ ${formatWallDateTime(endsAt)}`;
};

/** 빈 문자열은 null로 보낸다(백엔드 선택 필드). */
export const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

export const OPEN_END_DATE = '9999-12-31';

export const formatPeriod = (effectiveFrom: string, effectiveTo: string | null) =>
  `${effectiveFrom} ~ ${!effectiveTo || effectiveTo === OPEN_END_DATE ? '종료일 없음' : effectiveTo}`;

export const isPeriodOpen = (effectiveTo: string | null) => !effectiveTo || effectiveTo === OPEN_END_DATE;

export const statusBadgeClass = 'inline-block px-2 py-0.5 rounded-full text-xs font-medium border';
