import type {
  AdminSalesOrderDetail,
  DiscountType,
  OrderScopeExtras,
  CustomerInvoiceStatus,
  CustomerInvoiceType,
  CustomerStatus,
  InspectionApprovalType,
  InspectionDeductionType,
  InspectionDisputeStatus,
  InspectionStatus,
  PartnerBusinessType,
  PartnerLedgerEntryType,
  PartnerOffsetStatus,
  PartnerOrderStatus,
  SalesOrderChangeStatus,
  PartnerPayoutStatus,
  SalesOrderAcceptanceChannel,
  SalesOrderStatus,
  SalesQuoteCustomItemRequest,
  SalesQuoteLine,
  UnitProductSummary,
  UnitProductType,
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

export const LEDGER_ENTRY_TYPE_LABEL: Record<PartnerLedgerEntryType, string> = {
  PAYABLE: '지급 의무',
  PAYMENT: '지급',
  OFFSET: '귀책 상계',
  ADJUSTMENT: '이의 조정',
};

/** 감액 유형(계약 기준표, D13) — 서버 InspectionDeductionType과 같다. 기준 비율은 서버에서 받는다. */
export const DEDUCTION_TYPE_LABEL: Record<InspectionDeductionType, string> = {
  LATE_START_MINOR: '시작 지연 30분 미만',
  LATE_START_MAJOR: '시작 지연 30분 이상',
  PARTIAL_SIGNING_FAILURE: '장비 하자로 일부 서명 불가',
  EVENT_NOT_PERFORMED: '행사 진행 불가',
  OTHER: '기타(건별 판단)',
};

/** 발주 금액의 이 비율을 넘는 감액은 PLATFORM_SUPER만 승인한다(서버 기본값 0.3). */
export const LARGE_DEDUCTION_RATE = 0.3;

export const DISPUTE_STATUS_LABEL: Record<InspectionDisputeStatus, string> = { OPEN: '이의 제기 중', RESOLVED: '이의 조정 완료' };

export const SALES_ORDER_CHANGE_STATUS_LABEL: Record<SalesOrderChangeStatus, string> = {
  PROPOSED: '진행 중',
  APPLIED: '반영',
  REJECTED: '파트너 거절',
  CANCELLED: '취소',
};

export const SALES_ORDER_CHANGE_STATUS_STYLE: Record<SalesOrderChangeStatus, string> = {
  PROPOSED: 'bg-amber-50 text-amber-700 border-amber-200',
  APPLIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

export const OFFSET_STATUS_LABEL: Record<PartnerOffsetStatus, string> = { PENDING: '정산 대기', APPLIED: '지급에 반영', CANCELLED: '취소' };

export const INVOICE_TYPE_LABEL: Record<CustomerInvoiceType, string> = { ADVANCE: '선금', BALANCE: '잔금' };

export const INVOICE_STATUS_LABEL: Record<CustomerInvoiceStatus, string> = {
  ISSUED: '입금 대기',
  PAID: '입금 완료',
  CANCELLED: '취소',
};

export const INVOICE_STATUS_STYLE: Record<CustomerInvoiceStatus, string> = {
  ISSUED: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

/** 브라우저 현지 날짜(YYYY-MM-DD). `days`일 뒤를 줄 수 있다. */
export const localIsoDate = (days = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

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

/** 추가 범위(예비 태블릿·리허설 별도일 인력·숙박)를 한 줄로 — 없으면 null(D23·D24·D26). */
export const formatScopeExtras = (extras: OrderScopeExtras): string | null => {
  const parts: string[] = [];
  if (extras.spareTabletCount > 0) parts.push(`예비 태블릿 ${extras.spareTabletCount}대`);
  if (extras.rehearsalStaffPersonDays > 0) parts.push(`리허설 별도일 ${extras.rehearsalStaffPersonDays}인·일`);
  if (extras.lodgingNights > 0) parts.push(`숙박 ${extras.lodgingNights}박 × ${extras.lodgingPersons}명`);
  return parts.length > 0 ? parts.join(' · ') : null;
};

/** 입력 중인 추가 범위(문자열). 비우면 0이다. */
export interface ScopeExtrasDraft {
  spareTabletCount: string;
  rehearsalStaffPersonDays: string;
  lodgingNights: string;
  lodgingPersons: string;
}

export const EMPTY_SCOPE_EXTRAS_DRAFT: ScopeExtrasDraft = {
  spareTabletCount: '', rehearsalStaffPersonDays: '', lodgingNights: '', lodgingPersons: '',
};

const draftNumber = (value: number) => (value > 0 ? String(value) : '');

export const toScopeExtrasDraft = (extras: OrderScopeExtras): ScopeExtrasDraft => ({
  spareTabletCount: draftNumber(extras.spareTabletCount),
  rehearsalStaffPersonDays: draftNumber(extras.rehearsalStaffPersonDays),
  lodgingNights: draftNumber(extras.lodgingNights),
  lodgingPersons: draftNumber(extras.lodgingPersons),
});

export const toScopeExtras = (draft: ScopeExtrasDraft): OrderScopeExtras => ({
  spareTabletCount: Number(draft.spareTabletCount) || 0,
  rehearsalStaffPersonDays: Number(draft.rehearsalStaffPersonDays) || 0,
  lodgingNights: Number(draft.lodgingNights) || 0,
  lodgingPersons: Number(draft.lodgingPersons) || 0,
});

/** 숙박은 박수·인원을 함께 넣거나 함께 비운다. */
export const isLodgingDraftValid = (draft: ScopeExtrasDraft) =>
  (Number(draft.lodgingNights) > 0) === (Number(draft.lodgingPersons) > 0);

/** 견적 금액 조정 입력 — 영업 할인(정액/퍼센트)과 공급가(부가세 별도) 절사 단위. 견적 작성·범위 변경·마진 시뮬레이션이 같이 쓴다. */
export interface QuoteAdjustmentDraft {
  discountType: DiscountType;
  discountAmount: string;
  discountRatePercent: string;
  truncationUnit: string;
}

export const EMPTY_QUOTE_ADJUSTMENT_DRAFT: QuoteAdjustmentDraft = {
  discountType: 'FIXED_AMOUNT', discountAmount: '', discountRatePercent: '', truncationUnit: '',
};

export const TRUNCATION_UNIT_OPTIONS = [
  { value: '', label: '절사 안 함' },
  { value: '10', label: '10원 미만 절사' },
  { value: '100', label: '100원 미만 절사' },
  { value: '1000', label: '1,000원 미만 절사' },
  { value: '10000', label: '10,000원 미만 절사' },
];

/** 저장된 수주에서 할인 방식·값과 절사 단위를 되살린다 — 정액 할인 금액은 할인 줄에서 읽는다. */
export const toQuoteAdjustmentDraft = (order: AdminSalesOrderDetail): QuoteAdjustmentDraft => {
  const discountLine = order.lines.find((line) => line.lineType === 'DISCOUNT');
  return {
    discountType: order.discountRatePercent !== null ? 'PERCENT' : 'FIXED_AMOUNT',
    discountAmount: discountLine && order.discountRatePercent === null ? String(Math.abs(discountLine.amount)) : '',
    discountRatePercent: order.discountRatePercent !== null ? String(order.discountRatePercent) : '',
    truncationUnit: order.truncationUnit !== null ? String(order.truncationUnit) : '',
  };
};

/** 할인 방식에 맞는 값만 보낸다. */
export const toQuoteAdjustment = (draft: QuoteAdjustmentDraft) => ({
  discountType: draft.discountType,
  discountAmount: draft.discountType === 'FIXED_AMOUNT' && draft.discountAmount !== '' ? Number(draft.discountAmount) : null,
  discountRatePercent: draft.discountType === 'PERCENT' && draft.discountRatePercent !== '' ? Number(draft.discountRatePercent) : null,
  truncationUnit: draft.truncationUnit === '' ? null : Number(draft.truncationUnit),
});

export const hasQuoteDiscount = (draft: QuoteAdjustmentDraft) =>
  draft.discountType === 'PERCENT' ? Number(draft.discountRatePercent) > 0 : Number(draft.discountAmount) > 0;

export const isDiscountRateValid = (draft: QuoteAdjustmentDraft) =>
  draft.discountType !== 'PERCENT' || (Number(draft.discountRatePercent) >= 0 && Number(draft.discountRatePercent) <= 100);

/** 입력 중인 직접 입력 항목 — 카탈로그에 없는 품목. 발주 단가를 비우면 0(플랫폼이 처리)이다. */
export interface CustomItemDraft {
  name: string;
  quantity: string;
  unitPrice: string;
  partnerUnitPrice: string;
}

export const EMPTY_CUSTOM_ITEM_DRAFT: CustomItemDraft = { name: '', quantity: '1', unitPrice: '', partnerUnitPrice: '' };

/** 저장된 견적 줄에서 직접 입력 항목을 다시 불러온다. */
export const toCustomItemDrafts = (lines: SalesQuoteLine[]): CustomItemDraft[] =>
  lines
    .filter((line) => line.lineType === 'CUSTOM_ITEM')
    .map((line) => ({
      name: line.name,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice),
      partnerUnitPrice: line.partnerUnitPrice ? String(line.partnerUnitPrice) : '',
    }));

/** 이름이 빈 줄은 보내지 않는다. */
export const toCustomItems = (drafts: CustomItemDraft[]): SalesQuoteCustomItemRequest[] =>
  drafts
    .filter((item) => item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      partnerUnitPrice: item.partnerUnitPrice === '' ? null : Number(item.partnerUnitPrice),
    }));

/** 이름을 넣은 줄은 수량 1 이상, 고객 단가를 넣어야 한다. */
export const isCustomItemDraftValid = (drafts: CustomItemDraft[]) =>
  drafts.every((item) => !item.name.trim() || (Number(item.quantity) > 0 && item.unitPrice !== ''));

/** 단위 상품 수량의 단위 — 고객 가격은 이 단위 1개당 단가이고, 견적 수량도 이 단위로 센다. */
export const UNIT_PRODUCT_QUANTITY_UNIT: Record<UnitProductType, string> = {
  SIGNERS: '명',
  TEMPLATES: '개',
  TEST_EVENTS: '회',
  REHEARSAL_EVENTS: '회',
  MAIN_EVENTS: '회',
  TABLETS: '대',
  WIFI_EQUIPMENT: '대',
  ONSITE_SUPPORT: '인·일',
  ONSITE_SUPPORT_REQUEST: '건',
  ONLINE_SUPPORT: '건',
  EVENT_EFFECT_BUNDLE: '묶음',
};

/**
 * 묶음 판매 안내 — 판매 단위가 1이면 null. 고객 가격은 개당 단가라 묶음 금액은 단가 × 판매 단위이고,
 * 견적 수량은 판매 단위의 배수로만 넣는다(직접 수주 추가구매와 같은 규칙).
 */
export const saleUnitHint = (product: Pick<UnitProductSummary, 'type' | 'saleUnitQuantity'>): string | null => {
  if (product.saleUnitQuantity <= 1) return null;
  const unit = UNIT_PRODUCT_QUANTITY_UNIT[product.type];
  const size = product.saleUnitQuantity;
  return `판매 단위 ${size}${unit} — 수량은 ${unit} 수로 ${size}, ${size * 2}, ${size * 3}…처럼 넣습니다.`;
};

/** 판매 단위의 배수가 아닌 옵션의 상품 — 없으면 undefined. */
export const findSaleUnitViolation = (
  options: Array<{ unitProductId: string; quantity: string }>,
  unitProducts: UnitProductSummary[],
): UnitProductSummary | undefined =>
  options
    .map((option) => ({ product: unitProducts.find((item) => String(item.id) === option.unitProductId), quantity: Number(option.quantity) }))
    .find(({ product, quantity }) => product !== undefined && quantity > 0 && quantity % product.saleUnitQuantity !== 0)
    ?.product;
