import { formatCurrency } from '../../utils/internationalization';
import type { CapacityType, CatalogPricePeriodRequest, DiscountType, OptionalFeatureCategory, OptionalFeatureCode } from '../../types';

/**
 * 과금 카탈로그(플랜/선택옵션/용량 추가구매) 3개 타입이 공유하는 상수·포맷터·순수 함수 —
 * `components.tsx`(공유 컴포넌트)와 분리해뒀다. 컴포넌트와 비컴포넌트 값을 한 파일에서 같이
 * export하면 Vite Fast Refresh가 그 파일을 컴포넌트 모듈로 취급하지 못해
 * `react-refresh/only-export-components` 린트 규칙에 걸린다.
 */

export const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100';

export const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

// VIDEO_ATTENDANCE(화상 참석)는 실제 효과 로직이 아직 없어(별도 트랙에서 검토 중) 이 화면에서는
// 다루지 않는다 — signstage-docs business/ceremony-billing-options-review.md 참고.
// TABLET_RENTAL(태블릿 대여)은 프로젝터 효과가 없는 순수 안내/표시용 옵션이라, 선택옵션 카탈로그를
// 전시화면/서명화면에 실제 효과를 내는 항목으로 좁히면서 신규 등록 대상에서 뺐다(2026-08-30) —
// signstage-docs business/optional-feature-display-scope-and-plan-capacity-addon-review.md 3장.
// SIGNER_FIELD_ZOOM/ALL_SIGNED_FIREWORKS는 EVENT_EFFECT_BUNDLE로 통합되면서 더 이상 신규
// 등록하지 않는다(2026-09-08) — signstage-docs
// business/ceremony-event-effect-implementation-tasks.md 참고. 라벨 맵(OPTIONAL_FEATURE_CODE_LABEL
// 등)에는 이미 등록된 행/이력을 계속 정상 표시해야 해서 남겨둔다.
// ONSITE_SUPPORT(현장지원)/ONLINE_SUPPORT(온라인지원)는 2026-09-08엔 태블릿 대여와 같은 "표시용
// 옵션 + 수량 추가구매" 패턴의 신규 품목으로 등록 가능 목록에 들어갔었으나, 이게 TABLET_RENTAL이
// 2026-08-30에 바로 그 이유(화면 효과 없는 표시용 옵션과 수량 추가구매가 각자 독립 판매돼 근거
// 없는 이중 청구 위험)로 제외됐던 것과 같은 문제를 재도입한 것으로 뒤늦게 확인돼, 2026-09-09에
// 다시 뺐다 — signstage-docs business/optional-feature-capacity-addon-pairing-review.md 8장.
// 실제 지원 건수는 CapacityType.ONSITE_SUPPORT/ONLINE_SUPPORT 용량 추가구매로만 판매한다.
export const MANAGEABLE_OPTIONAL_FEATURE_CODES: OptionalFeatureCode[] = ['EVENT_EFFECT_BUNDLE'];

export const OPTIONAL_FEATURE_CODE_LABEL: Record<string, string> = {
  SIGNER_FIELD_ZOOM: '서명 하이라이트',
  ALL_SIGNED_FIREWORKS: '폭죽 효과',
  EVENT_EFFECT_BUNDLE: '이벤트 효과 묶음',
  TABLET_RENTAL: '태블릿 대여',
  ONSITE_SUPPORT: '현장지원',
  ONLINE_SUPPORT: '온라인지원',
};

export const OPTIONAL_FEATURE_CATEGORY_OPTIONS: Array<{ value: OptionalFeatureCategory; label: string }> = [
  { value: 'EQUIPMENT', label: '장비' },
  { value: 'PERSONNEL', label: '인력' },
  { value: 'APPLICATION', label: '애플리케이션' },
];

export const OPTIONAL_FEATURE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  OPTIONAL_FEATURE_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

/** 코드별 기본 카테고리 — signstage-docs business/ceremony-support-services-billing-review.md 4.3/4.5절. */
export const DEFAULT_CATEGORY_BY_CODE: Record<string, OptionalFeatureCategory> = {
  SIGNER_FIELD_ZOOM: 'APPLICATION',
  ALL_SIGNED_FIREWORKS: 'APPLICATION',
  EVENT_EFFECT_BUNDLE: 'APPLICATION',
  TABLET_RENTAL: 'EQUIPMENT',
  ONSITE_SUPPORT: 'PERSONNEL',
  ONLINE_SUPPORT: 'PERSONNEL',
};

/** 효과 하나를 "targetType/triggerType 코드" 형태로 간단히 보여준다(예: "PROJECTOR · SIGNATURE_COMPLETED"). */
export const EFFECT_TRIGGER_LABEL: Record<string, string> = {
  SIGNATURE_COMPLETED: '개별 서명 완료',
  ALL_SIGNATURES_COMPLETED: '전체 서명 완료',
  EVENT_FINISHED: '행사 종료',
};

export const CAPACITY_TYPE_OPTIONS: Array<{ value: CapacityType; label: string }> = [
  { value: 'SIGNERS', label: '서명자' },
  { value: 'TEMPLATES', label: '템플릿' },
  { value: 'TEST_EVENTS', label: '테스트 행사' },
  { value: 'REHEARSAL_EVENTS', label: '리허설 행사' },
  { value: 'MAIN_EVENTS', label: '본행사' },
  { value: 'TABLETS', label: '태블릿' },
  { value: 'ONSITE_SUPPORT', label: '현장지원' },
  { value: 'ONLINE_SUPPORT', label: '온라인지원' },
];

export const CAPACITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CAPACITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * 용량 추가구매 상품의 표시 카테고리 — `OptionalFeature.category`와 같은 enum 값을 코드 매핑으로
 * 재사용한다. 원래 태블릿/현장지원/온라인지원은 짝이 되는 표시용 `OptionalFeature`의 category를
 * 빌려 쓰는 구조였는데, 그 표시용 옵션들이 이중 청구 위험으로 제거되면서(2026-09-09,
 * signstage-docs business/optional-feature-capacity-addon-pairing-review.md 8장) `CapacityAddOn`
 * 쪽에서 카테고리를 보여줄 다른 소스가 필요해졌다 — `AdminBillingSimulator.tsx`가 이미 쓰던 것과
 * 같은 코드 매핑 방식을 여기로 옮겨 목록/상세 화면에서 공유한다. 플랜 기본 포함 5종(서명자 등)은
 * 이 3분류(장비/인력/애플리케이션)에 속하지 않아 값이 없다(매핑에서 빠짐 — 화면은 '—'로 표시).
 */
export const CAPACITY_TYPE_CATEGORY: Partial<Record<CapacityType, OptionalFeatureCategory>> = {
  TABLETS: 'EQUIPMENT',
  ONSITE_SUPPORT: 'PERSONNEL',
  ONLINE_SUPPORT: 'PERSONNEL',
};

/**
 * 플랜이 기본 포함할 수 있는 용량 종류 — 백엔드 CapacityType.isPlanIncludable()과 같은 집합이다
 * (signstage-docs business/billing-catalog-zero-base-schema-redesign-review.md 결정, 2026-09-08,
 * 항목 B). TABLETS/ONSITE_SUPPORT/ONLINE_SUPPORT는 플랜 기본 포함 개념이 없어(항상 0에서 시작,
 * 용량 추가구매로만 증가) 제외한다.
 */
export const PLAN_NON_INCLUDABLE_CAPACITY_TYPES: CapacityType[] = ['TABLETS', 'ONSITE_SUPPORT', 'ONLINE_SUPPORT'];
export const PLAN_CAPACITY_TYPE_OPTIONS = CAPACITY_TYPE_OPTIONS.filter(
  (option) => !PLAN_NON_INCLUDABLE_CAPACITY_TYPES.includes(option.value),
);

/** 새 플랜 초안의 한도 기본값 — 등록 가능한 용량 종류 전부를 0으로 채워 시작한다. */
export const emptyPlanCapacities = (): Record<string, number> =>
  Object.fromEntries(PLAN_CAPACITY_TYPE_OPTIONS.map((option) => [option.value, 0]));

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
 * 관여하지 않는다 — 조직×품목 할인 오버라이드·행사 건별 재량 할인·세금은 조직/행사가 정해져야
 * 계산할 수 있어 카탈로그 등록 단계에서는 반영할 수 없다("이 상품 자체의 할인만 적용한 값"일 뿐,
 * 실제 청구액이 아니다). 그래서 통화별 반올림 정책(`CurrencyPolicy`) 없이 소수점 없는 정수로만
 * 근사한다 — 정밀한 반올림이 필요한 값이 아니라 오입력을 걸러내기 위한 참고용 미리보기이기 때문.
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

export const EMPTY_PERIOD_DRAFT = (): CatalogPricePeriodRequest => ({
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
});

/** 빈 문자열 입력을 "그룹 없음"(null)으로 정규화한다 — 폼 입력값은 항상 문자열로 다루는 게 controlled input에 편해서다. */
export const normalizeExclusivityGroup = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** 목록 화면 공통 페이지 크기 — 카탈로그 API가 서버 페이지네이션을 지원하지 않아(글로벌 카탈로그,
 * 조직 스코프 없이 인증된 사용자면 누구나 조회) 클라이언트 사이드로 자른다. */
export const CATALOG_PAGE_SIZE = 20;
