import { formatCurrency } from '../../utils/internationalization';
import type {
  BillingPlanDiscountPeriodRequest,
  DiscountType,
  PlanUnitProductLineSummary,
  UnitProductCategory,
  UnitProductPricePeriodRequest,
  UnitProductPricePeriodSummary,
  UnitProductType,
} from '../../types';

/**
 * 과금 카탈로그(플랜/단위 상품) 화면이 공유하는 상수·포맷터·순수 함수 — `components.tsx`(공유
 * 컴포넌트)와 분리해뒀다. 컴포넌트와 비컴포넌트 값을 한 파일에서 같이 export하면 Vite Fast
 * Refresh가 그 파일을 컴포넌트 모듈로 취급하지 못해 `react-refresh/only-export-components`
 * 린트 규칙에 걸린다.
 *
 * 옛 플랜/선택옵션/용량추가구매 3분리 상수는 `UnitProduct` 통합(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10)으로
 * 전부 이 파일 하나로 합쳐졌다 — 레거시 값(SIGNER_FIELD_ZOOM/ALL_SIGNED_FIREWORKS/
 * VIDEO_ATTENDANCE/TABLET_RENTAL)은 백엔드에 등록된 행이 0건이라 완전히 삭제됐고, 이중 청구
 * 위험 때문에 신규 등록을 따로 막던 ONSITE_SUPPORT/ONLINE_SUPPORT 제한도 구조적으로 필요 없어졌다
 * (타입 하나로 통합돼 표시용/용량용이 따로 존재하지 않는다) — 그래서 "등록 가능 코드 제한" 목록
 * 자체가 없어졌다.
 */

export const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100';

export const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

/** feature.ceremony.entity.UnitProductType 9종 전체 — 관리자가 등록 시 자유롭게 고른다(등록 가능 제한 없음). */
export const UNIT_PRODUCT_TYPE_OPTIONS: Array<{ value: UnitProductType; label: string }> = [
  { value: 'SIGNERS', label: '서명자' },
  { value: 'TEMPLATES', label: '템플릿' },
  { value: 'TEST_EVENTS', label: '테스트 행사' },
  { value: 'REHEARSAL_EVENTS', label: '리허설 행사' },
  { value: 'MAIN_EVENTS', label: '본행사' },
  { value: 'TABLETS', label: '태블릿' },
  { value: 'ONSITE_SUPPORT', label: '현장지원' },
  { value: 'ONLINE_SUPPORT', label: '온라인지원' },
  { value: 'EVENT_EFFECT_BUNDLE', label: '이벤트 효과 묶음' },
];

export const UNIT_PRODUCT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  UNIT_PRODUCT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export const UNIT_PRODUCT_CATEGORY_OPTIONS: Array<{ value: UnitProductCategory; label: string }> = [
  { value: 'ESSENTIAL', label: '필수' },
  { value: 'EQUIPMENT', label: '장비' },
  { value: 'PERSONNEL', label: '인력' },
  { value: 'APPLICATION', label: '애플리케이션' },
];

export const UNIT_PRODUCT_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  UNIT_PRODUCT_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

/** 타입별 기본 카테고리 제안값 — 등록 폼이 타입을 고르면 미리 채워주는 값일 뿐, 저장 시 강제하지 않는다. */
export const DEFAULT_CATEGORY_BY_TYPE: Record<UnitProductType, UnitProductCategory> = {
  SIGNERS: 'ESSENTIAL',
  TEMPLATES: 'ESSENTIAL',
  TEST_EVENTS: 'ESSENTIAL',
  REHEARSAL_EVENTS: 'ESSENTIAL',
  MAIN_EVENTS: 'ESSENTIAL',
  TABLETS: 'EQUIPMENT',
  ONSITE_SUPPORT: 'PERSONNEL',
  ONLINE_SUPPORT: 'PERSONNEL',
  EVENT_EFFECT_BUNDLE: 'APPLICATION',
};

/**
 * 카테고리로부터 "플랫폼 이용료" 기본값을 제안한다 — 백엔드
 * `UnitProductCategory#isSystemUsageFee()`의 기본 계산과 같은 규칙이다(2026-09-12, signstage-docs
 * business/onsite-support-negotiation-and-billing-classification-review.md 3.1절). 등록/수정
 * 폼이 카테고리를 고르면 미리 채워주는 제안값일 뿐 — 관리자가 체크박스로 자유롭게 override할
 * 수 있다.
 */
export const defaultPlatformUsageFeeByCategory = (category: UnitProductCategory): boolean =>
  category === 'ESSENTIAL' || category === 'APPLICATION';

/**
 * 필수 5종 — 플랜 목록 화면의 "한도(서명자/템플릿/테스트/리허설/본행사)" 요약 열이 고정 순서로
 * 보여주는 데 쓴다(`AdminBillingPlanList.tsx`). 예전엔 이 5종만 기본 포함 수량을 가질 수 있다는
 * 제약(`PLAN_INCLUDABLE_UNIT_PRODUCT_TYPES`)과 같은 목록이었지만, 그 제약은 폐지됐다 — 지금은
 * 순수하게 "행사 등록 한도로 쓰이는 타입이라 목록에서 한눈에 보여줄 값"이라는 표시용 의미만
 * 남았다.
 */
export const ESSENTIAL_UNIT_PRODUCT_TYPES: UnitProductType[] = [
  'SIGNERS',
  'TEMPLATES',
  'TEST_EVENTS',
  'REHEARSAL_EVENTS',
  'MAIN_EVENTS',
];

/** 효과 하나를 "targetType/triggerType 코드" 형태로 간단히 보여준다(예: "PROJECTOR · SIGNATURE_COMPLETED"). */
export const EFFECT_TRIGGER_LABEL: Record<string, string> = {
  SIGNATURE_COMPLETED: '개별 서명 완료',
  ALL_SIGNATURES_COMPLETED: '전체 서명 완료',
  EVENT_FINISHED: '행사 종료',
};

/**
 * 수량이 0 또는 1로만 의미가 있는 토글형 타입 — 백엔드 `UnitProductType.isToggle()`과 같은 집합
 * (signstage-docs business/billing-catalog-unit-product-model-redesign-review.md 11장,
 * 2026-09-10). 플랜 등록/수정 화면이 이 타입의 기본 포함 수량 입력 상한을 1로 제한하는 데 쓴다
 * — 서버도 같은 규칙을 강제한다(`BillingPlanService#resolveUnitProducts`).
 *
 * <p>예전엔 "필수 5종만 기본 포함 수량을 가질 수 있다"(`PLAN_INCLUDABLE_UNIT_PRODUCT_TYPES`)는
 * 제한이 있었는데, 재설계 과정에서 생긴 의도치 않은 회귀로 확인돼(태블릿/현장지원/온라인지원도
 * 예전엔 자유롭게 수량을 가질 수 있어야 했다) 폐지했다 — 이제 모든 타입이 제한 없이 수량을 가질
 * 수 있고, `EVENT_EFFECT_BUNDLE`만 이 상수로 상한(1)을 걷는다.
 */
export const TOGGLE_UNIT_PRODUCT_TYPES: UnitProductType[] = ['EVENT_EFFECT_BUNDLE'];

/**
 * 플랜이 포함하는 단위 상품 줄들의 소계 — `Σ(unitProduct.salePrice × includedQuantity)`, 백엔드
 * `BillingPlanService`가 "오늘 가격" 계산에 쓰는 것과 같은 식이다(3.3절). 플랜 자체는 가격이
 * 없으므로 목록/상세/등록 화면이 "판매가" 대신 이 값을 보여준다. 오늘 유효한 판매가격 기간이
 * 없는 줄(salePrice=null)은 0으로 취급한다.
 */
export const planSubtotal = (lines: PlanUnitProductLineSummary[]): number =>
  lines.reduce((sum, line) => sum + (line.salePrice ?? 0) * line.includedQuantity, 0);

export const formatPrice = (value: number, currencyCode = 'KRW') => formatCurrency(value, currencyCode);

/** 공급가는 nullable이다("원가 미상") — signstage-docs business/billing-catalog-zero-base-schema-redesign-review.md 결정(2026-09-08, 항목 G). */
export const formatSupplyPrice = (value: number | null, currencyCode = 'KRW') =>
  value === null ? '미상' : formatPrice(value, currencyCode);

export const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatPrice(discountValue);

/**
 * 판매가에 할인을 적용한 예상 최종가 — 화면 표시 전용 미리보기다(저장하지 않는다, signstage-docs
 * business/billing-catalog-pricing-input-validation-review.md 3.4절, 2026-09-09 결정). 백엔드
 * `MoneyCalculator.applyDiscount`와 같은 공식(정률/정액, 0 미만 clamp)이지만 실제 청구 계산에는
 * 관여하지 않는다. 단위 상품 자체는 할인이 없어(2026-09-10 결정) 플랜 할인 미리보기에서만 쓴다.
 */
export const calculateFinalPrice = (salePrice: number, discountType: DiscountType, discountValue: number): number => {
  const discount = discountType === 'PERCENT' ? (salePrice * discountValue) / 100 : discountValue;
  return Math.max(0, Math.round(salePrice - discount));
};

export const PERIOD_STATUS_LABEL: Record<string, string> = {
  PENDING: '판매예정',
  ON_SALE: '판매중',
  EXPIRED: '판매종료',
  INACTIVE: '사용중지',
  NO_ACTIVE_PERIOD: '유효 기간 없음',
};

export const PERIOD_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
  ON_SALE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
  INACTIVE: 'bg-gray-100 text-gray-500 border-gray-200',
  NO_ACTIVE_PERIOD: 'bg-red-50 text-red-700 border-red-200',
};

export const todayIsoDate = () => new Date().toISOString().slice(0, 10);

/** 단위 상품 판매가격 기간 초안 — 할인 필드가 없다(플랜 할인 기간은 `EMPTY_PLAN_DISCOUNT_PERIOD_DRAFT` 참고). */
export const EMPTY_UNIT_PRODUCT_PERIOD_DRAFT = (): UnitProductPricePeriodRequest => ({
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
});

/** 플랜 할인 기간 초안 — 단위 상품과 달리 가격 필드가 없고 할인 필드만 갖는다(3.3절). */
export const EMPTY_PLAN_DISCOUNT_PERIOD_DRAFT = (): BillingPlanDiscountPeriodRequest => ({
  discountType: 'PERCENT',
  discountValue: 0,
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
});

/** 빈 문자열 입력을 "그룹 없음"(null)으로 정규화한다 — 폼 입력값은 항상 문자열로 다루는 게 controlled input에 편해서다. */
export const normalizeExclusivityGroup = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** 빈 문자열 입력을 "설명 없음"(null)으로 정규화한다 — normalizeExclusivityGroup과 같은 이유(2026-09-11). */
export const normalizeDescription = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** 목록 화면 공통 페이지 크기 — 카탈로그 API가 서버 페이지네이션을 지원하지 않아(글로벌 카탈로그,
 * 조직 스코프 없이 인증된 사용자면 누구나 조회) 클라이언트 사이드로 자른다. */
export const CATALOG_PAGE_SIZE = 20;

const addOneDay = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const subOneDay = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * 단위 상품 판매가격 기간 사이의 "공백"(그 날짜 범위에 유효한 기간이 하나도 없는 구간)을
 * 찾는다 — 겹침은 서버가 막지만(`checkNoOverlap`) 공백은 안 막아서, 관리자가 실수로 기간
 * 사이를 비워두면 그 날짜에 플랜을 선택한 파트너가 예전엔 조용히 0원으로 스냅샷됐다
 * (signstage-docs business/ceremony-plan-price-snapshot-consistency-review.md 3.1절,
 * 2026-09-11 결정 — "예방"은 경고만, 차단은 안 한다: 의도적으로 판매를 중지하고 싶은 기간이
 * 있을 수 있어서다). 마지막 기간이 "무기한"이 아니면 그 이후도 공백으로 잡는다(끝이 없는
 * 미래 공백).
 */
export const findUnitProductPricePeriodGaps = (
  periods: UnitProductPricePeriodSummary[],
): Array<{ from: string; to: string | null }> => {
  const sorted = [...periods].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const gaps: Array<{ from: string; to: string | null }> = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.effectiveTo === null) continue; // 무기한 — 그 뒤로 공백이 생길 수 없다.
    const gapStart = addOneDay(current.effectiveTo);
    if (gapStart >= next.effectiveFrom) continue; // 맞닿아 있거나 겹침 — 공백 없음.
    gaps.push({ from: gapStart, to: subOneDay(next.effectiveFrom) });
  }

  const last = sorted[sorted.length - 1];
  if (last && last.effectiveTo !== null) {
    gaps.push({ from: addOneDay(last.effectiveTo), to: null });
  }

  return gaps;
};
