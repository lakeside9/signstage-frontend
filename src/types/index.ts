import type {
  CeremonyEffectTarget,
  CeremonyEffectTrigger,
} from '../utils/ceremonyEffectCatalog';

export type {
  AllSignaturesCompleteEffect,
  CeremonyEffectTarget,
  CeremonyEffectTrigger,
  SignatureCompleteEffect,
} from '../utils/ceremonyEffectCatalog';

/**
 * signstage-docs business/user-organization-design.md 7장의 platformRole 값과 맞춘다.
 */
export type PlatformRole = 'PLATFORM_SUPPORT' | 'PLATFORM_OPS' | 'PLATFORM_SUPER';

export interface PlatformAdminInfo {
  id: number;
  loginId: string;
  name: string;
  platformRole: PlatformRole;
}

/**
 * GET/PUT /api/identity/me 응답(IdentityDto.Response.Me)과 맞춘다.
 * loginId는 서버에서 수정할 수 없는 값이라 폼에서는 읽기 전용으로만 쓴다.
 */
export interface UserProfile {
  id: number;
  loginId: string;
  name: string;
  email: string;
  phone: string | null;
  languageCode: string;
  locale: string;
  timeZoneId: string;
  platformRole: PlatformRole | null;
}

/**
 * signstage-docs business/user-organization-design.md 5.1절 (a) 3단계 가입 흐름의 계정 상태.
 * PENDING(승인 대기)인 계정은 로그인할 수 없다.
 */
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'WITHDRAWN';

/** POST /api/identity/signup 응답(IdentityDto.Response.Signup)과 맞춘다. */
export interface SignupResult {
  id: number;
  loginId: string;
  status: UserStatus;
}

/** GET/PUT /api/organizations(/{id}) 응답(OrganizationDto.Response.Organization)과 맞춘다. */
export interface OrganizationSummary {
  id: number;
  name: string;
  code: string;
  status: string;
  defaultLanguageCode: string;
  defaultLocale: string;
  defaultTimeZoneId: string;
  billingCurrencyCode: string;
  createdAt: string;
  /** 호출한 사용자가 이 조직에서 가진 역할. OWNER만 조직 정보를 수정할 수 있다. */
  myRole: MemberRole;
}

/**
 * GET /api/organizations/{id}/history, GET /api/platform-admin/organizations/{id}/history 응답
 * (OrganizationDto.Response.OrganizationHistorySummary)과 맞춘다. 파트너 본인(OWNER)이 바꿨는지
 * 플랫폼 관리자가 바꿨는지는 createdBy로 구분한다(2026-08-30 — 두 경로 모두 같은 이력에 남는다).
 */
export interface OrganizationHistorySummary {
  id: number;
  name: string;
  code: string;
  status: OrganizationStatus;
  defaultLanguageCode: string;
  defaultLocale: string;
  defaultTimeZoneId: string;
  billingCurrencyCode: string;
  createdBy: number | null;
  createdAt: string;
}

/**
 * PUT /api/platform-admin/organizations/{id}/info 요청
 * (PlatformAdminOrganizationDto.Request.UpdateOrganizationInfo)과 맞춘다. code는 이 API로도
 * 바꾸지 않는다(OrganizationDto.Request.UpdateOrganization과 같은 제약).
 */
export interface UpdateOrganizationInfoRequest {
  organizationName: string;
  defaultLocale: string;
}

/**
 * feature.organization.entity.OrganizationCreationRequestStatus 값과 맞춘다.
 * signstage-docs business/organization-creation-approval-review.md 3.1절 — 조직은 더 이상
 * 즉시 만들어지지 않고 이 요청이 승인돼야 만들어진다.
 */
export type OrganizationCreationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/**
 * POST/GET/DELETE /api/organizations/requests 응답(OrganizationCreationRequestDto.Response.RequestSummary)과
 * 맞춘다. 요청 자체는 코드를 담지 않는다 — 코드는 승인 시점에 관리자가 정한다(3.3절).
 */
export interface OrganizationCreationRequestSummary {
  id: number;
  organizationName: string;
  note: string | null;
  status: OrganizationCreationRequestStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  organizationId: number | null;
  createdAt: string;
}

/**
 * GET/POST/PUT /api/platform-admin/organization-requests 응답
 * (PlatformAdminOrganizationRequestDto.Response.RequestSummary)과 맞춘다.
 */
export interface PlatformAdminOrganizationRequestSummary {
  id: number;
  requesterId: number;
  requesterLoginId: string;
  requesterName: string;
  organizationName: string;
  note: string | null;
  status: OrganizationCreationRequestStatus;
  rejectionReason: string | null;
  reviewerLoginId: string | null;
  reviewedAt: string | null;
  organizationId: number | null;
  createdAt: string;
}

/**
 * GET/PUT /api/platform-admin/users 응답(PlatformAdminUserDto.Response.UserSummary)과 맞춘다.
 */
export interface PlatformAdminUserSummary {
  id: number;
  loginId: string;
  name: string;
  /** 탈퇴 처리된 계정은 PII 마스킹으로 null이다(user-organization-design.md 8.2절). */
  email: string | null;
  phone: string | null;
  languageCode: string;
  locale: string;
  timeZoneId: string;
  status: UserStatus;
  platformRole: PlatformRole | null;
  locked: boolean;
  passwordResetRequired: boolean;
  createdAt: string;
}

/**
 * POST /api/platform-admin/users 응답(PlatformAdminUserDto.Response.CreatedUser)과 맞춘다.
 * temporaryPassword는 이 응답에만 담기고 서버에 저장되지 않는다 — 이 화면을 벗어나면
 * 다시 조회할 수 없으므로 화면에서 놓치지 않게 보여줘야 한다.
 */
export interface PlatformAdminCreatedUser {
  user: PlatformAdminUserSummary;
  temporaryPassword: string;
}

/** feature.platformadmin.entity.PlatformAdminAction 값과 맞춘다. */
export type PlatformAdminAction =
  | 'UPDATE_USER_STATUS'
  | 'UNLOCK_USER'
  | 'FORCE_PASSWORD_RESET'
  | 'CREATE_USER'
  | 'CREATE_ACCOUNT'
  | 'REVOKE_ACCOUNT'
  | 'UPDATE_ORGANIZATION_STATUS'
  | 'UPDATE_ORGANIZATION_INFO'
  | 'CREATE_ORGANIZATION'
  | 'FORCE_ADD_MEMBER'
  | 'FORCE_UPDATE_MEMBER_ROLE'
  | 'FORCE_REMOVE_MEMBER'
  | 'FORCE_WITHDRAW_USER'
  | 'UPDATE_ACCOUNT_ROLE'
  | 'REJECT_ORGANIZATION_REQUEST'
  | 'CREATE_BILLING_PLAN'
  | 'UPDATE_BILLING_PLAN'
  | 'CREATE_OPTIONAL_FEATURE'
  | 'UPDATE_OPTIONAL_FEATURE'
  | 'CREATE_CAPACITY_ADDON'
  | 'UPDATE_CAPACITY_ADDON'
  | 'UPDATE_CEREMONY_STATUS'
  | 'UPDATE_CEREMONY_FINAL_DISCOUNT'
  | 'UPDATE_ORGANIZATION_BILLING_PLAN_DISCOUNT'
  | 'UPDATE_ORGANIZATION_OPTIONAL_FEATURE_DISCOUNT'
  | 'UPDATE_ORGANIZATION_CAPACITY_ADDON_DISCOUNT'
  | 'APPROVE_CAPACITY_PURCHASE'
  | 'REJECT_CAPACITY_PURCHASE'
  | 'APPROVE_OPTIONAL_FEATURE_PURCHASE'
  | 'REJECT_OPTIONAL_FEATURE_PURCHASE'
  | 'CREATE_CEREMONY_EFFECT_DEFINITION'
  | 'UPDATE_CEREMONY_EFFECT_DEFINITION'
  | 'REORDER_CEREMONY_EFFECT_DEFINITIONS';

/**
 * GET /api/platform-admin/audit-logs 응답(PlatformAdminAuditLogDto.Response.AuditLogEntry)과 맞춘다.
 * adminLoginId/targetLoginId/organizationName은 조회 시점에 조인해 채운 표시용 값이다.
 */
export interface PlatformAdminAuditLogEntry {
  id: number;
  adminUserId: number;
  adminLoginId: string | null;
  action: PlatformAdminAction;
  targetUserId: number | null;
  targetLoginId: string | null;
  organizationId: number | null;
  organizationName: string | null;
  detail: string | null;
  requestPath: string | null;
  createdAt: string;
}

/**
 * GET /api/platform-admin/menus 응답 하나(MenuDto.Response.MenuNode)와 맞춘다 — signstage-docs
 * business/menu-and-action-permission-management-review.md 7.1/10장. 호출자의 역할이 허용하지
 * 않는 메뉴는 서버가 이미 걸러 응답에서 뺀다.
 */
export interface MenuNode {
  id: number;
  menuKey: string;
  labelKey: string;
  label: string;
  path: string | null;
  iconKey: string | null;
  displayOrder: number;
  children: MenuNode[];
}

/**
 * GET /api/platform-admin/menus/admin?console= 응답 하나(MenuDto.Response.MenuAdminRow)와
 * 맞춘다 — 메뉴 관리 화면 전용, 역할 필터링 없이 평면 목록으로 내려온다.
 */
export interface MenuAdminRow {
  id: number;
  parentMenuId: number | null;
  menuKey: string;
  labelKey: string;
  label: string;
  path: string | null;
  iconKey: string | null;
  displayOrder: number;
  active: boolean;
}

/**
 * GET /api/platform-admin/permissions/me 또는 GET /api/organizations/me/permissions
 * 응답(PermissionDto.Response.MyPermissions)과 맞춘다. roleValue는 축에 따라 PlatformRole
 * 또는 MemberRole 값을 담아 string으로 둔다(조직 멤버십이 없으면 null).
 */
export interface MyPermissions {
  roleAxis: string;
  roleValue: string | null;
  permissionKeys: string[];
}

/** 관리 화면의 역할×권한 매트릭스 한 행(PermissionDto.Response.PermissionMatrixRow)과 맞춘다. */
export interface PermissionMatrixRow {
  permissionDefinitionId: number;
  permissionKey: string;
  permissionType: 'MENU' | 'ACTION';
  labelKey: string;
  displayOrder: number;
  roleAllowances: PermissionRoleAllowance[];
}

/** roleValue는 축에 따라 PlatformRole 또는 MemberRole 값이다. */
export interface PermissionRoleAllowance {
  roleValue: string;
  allowed: boolean;
}

/** signstage-docs business/user-organization-design.md 3.2절의 organizations.status 값과 맞춘다. */
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL';

/** feature.organization.entity.MemberRole 값과 맞춘다. */
export type MemberRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

/** feature.organization.entity.MemberStatus 값과 맞춘다. */
export type MemberStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';

/**
 * GET/POST/PUT/DELETE /api/organizations/{organizationId}/members(...) 응답과 맞춘다
 * (MemberDto.Response.MemberSummary). 형태는 {@link PlatformAdminMemberSummary}와 같지만,
 * 백엔드가 조직 사용자용/플랫폼 관리자용 DTO를 따로 두는 것과 같은 이유로 타입도 나눈다.
 */
export interface MemberSummary {
  id: number;
  organizationId: number;
  userId: number;
  loginId: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string | null;
}

/** GET /api/platform-admin/users/{userId} 응답(PlatformAdminUserDto.Response.UserDetail)과 맞춘다. */
export interface PlatformAdminUserDetail {
  user: PlatformAdminUserSummary;
  organizations: PlatformAdminOrganizationMembership[];
}

export interface PlatformAdminOrganizationMembership {
  organizationId: number;
  organizationName: string;
  organizationCode: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string | null;
}

/**
 * GET /api/platform-admin/users/{userId}/login-history 응답과 맞춘다.
 * PLATFORM_OPS 이상만 조회할 수 있다(signstage-docs business/login-security.md 6장).
 */
export interface PlatformAdminLoginHistoryEntry {
  id: number;
  loginIdInput: string;
  status: string;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
}

/**
 * GET /api/platform-admin/users/{userId}/history 응답
 * (PlatformAdminUserDto.Response.UserHistorySummary)과 맞춘다. 회원 본인이 바꿨는지 플랫폼
 * 관리자가 바꿨는지는 createdBy로 구분한다(2026-08-30). 비밀번호(해시)는 절대 포함하지 않는다.
 */
export interface PlatformAdminUserHistorySummary {
  id: number;
  loginId: string;
  name: string;
  email: string | null;
  phone: string | null;
  languageCode: string;
  locale: string;
  timeZoneId: string;
  status: UserStatus;
  platformRole: PlatformRole | null;
  passwordResetRequired: boolean;
  createdBy: number | null;
  createdAt: string;
}

/**
 * GET/PUT/DELETE /api/platform-admin/organizations/{organizationId}/members 응답과 맞춘다
 * (PlatformAdminMemberDto.Response.MemberSummary).
 */
export interface PlatformAdminMemberSummary {
  id: number;
  organizationId: number;
  userId: number;
  loginId: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string | null;
}

/**
 * GET /api/platform-admin/organizations 응답(PlatformAdminOrganizationDto.Response.OrganizationSummary)과 맞춘다.
 */
export interface PlatformAdminOrganizationSummary {
  id: number;
  name: string;
  code: string;
  status: OrganizationStatus;
  defaultLocale: string;
  activeMemberCount: number;
  createdAt: string;
  /**
   * 데모 조직 여부 — signstage-docs
   * business/demo-account-exhibition-signer-preview-review.md 11장(2026-09-09). 데모 조직에서는
   * 플랫폼 관리자가 실제 조직 멤버가 아니어도 행사를 직접 관리할 수 있다.
   */
  isDemo: boolean;
}

/** core.web.PageResponse<T> 응답 규약과 맞춘다(backend-coding-convention.md 10장). */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

// ── 행사(Ceremony) ──────────────────────────────────────────────────────
// signstage-docs business/ceremony-feature-migration-review.md,
// business/ceremony-billing-options-review.md 결정을 구현한 signstage-backend
// feature.ceremony 패키지 DTO와 맞춘다.

/** feature.ceremony.entity.DiscountType 값과 맞춘다. */
export type DiscountType = 'PERCENT' | 'FIXED_AMOUNT';

/**
 * feature.ceremony.entity.UnitProductType 값과 맞춘다 — 옛 `OptionalFeatureCode`+`CapacityType`을
 * 통합했다(signstage-docs business/billing-catalog-unit-product-model-redesign-review.md 결정,
 * 2026-09-10). 레거시 값(SIGNER_FIELD_ZOOM/ALL_SIGNED_FIREWORKS/VIDEO_ATTENDANCE/TABLET_RENTAL)은
 * 유지하지 않고 완전히 제거했다 — 백엔드에 등록된 행이 0건이라 역직렬화 부담이 없었다.
 *
 * `EVENT_EFFECT_BUNDLE`은 한 타입을 여러 `UnitProductSummary` 행이 공유한다(예: "3종"/"5종"
 * 묶음, 3.6절) — 묶음이 실제로 여는 효과 목록은 각 행의 `effectDefinitionIds`가 갖는다.
 */
export type UnitProductType =
  | 'SIGNERS'
  | 'TEMPLATES'
  | 'TEST_EVENTS'
  | 'REHEARSAL_EVENTS'
  | 'MAIN_EVENTS'
  | 'TABLETS'
  | 'ONSITE_SUPPORT'
  | 'ONLINE_SUPPORT'
  | 'EVENT_EFFECT_BUNDLE';

/**
 * feature.ceremony.entity.UnitProductCategory 값과 맞춘다. 옛 `OptionalFeatureCategory`
 * (EQUIPMENT/PERSONNEL/APPLICATION)에 필수 5종을 위한 `ESSENTIAL`을 더했다(2026-09-10 결정,
 * 3.2절) — `AdminBillingSimulator.tsx`가 화면 전용으로 쓰던 "필수옵션" 버킷을 정식 분류로
 * 승격했다.
 */
export type UnitProductCategory = 'ESSENTIAL' | 'EQUIPMENT' | 'PERSONNEL' | 'APPLICATION';

/**
 * 단위 상품 판매가격 기간 하나 — 행 하나 = 기간 하나(다중 버전, TaxPolicy/조직 할인
 * 오버라이드와 같은 방식). 단위 상품은 할인을 갖지 않는다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10, 3.5절) —
 * 옛 `CatalogPricePeriodSummary`(플랜/선택옵션/용량추가구매 공유)와 달리 discountType/
 * discountValue가 없다.
 */
export interface UnitProductPricePeriodSummary {
  id: number;
  currencyCode: string;
  supplyPrice: number | null;
  salePrice: number;
  taxCode: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** PENDING(판매예정)/ON_SALE(판매중)/EXPIRED(판매종료)/INACTIVE(사용중지, 기간 안이지만 active=false). */
  status: string;
  createdAt: string;
}

/** 판매가격 기간의 생성/수정/삭제 이력 한 행 — removed=true면 "이 시점에 기간이 제거됐다"는 뜻. */
export interface UnitProductPricePeriodHistorySummary {
  id: number;
  currencyCode: string;
  supplyPrice: number | null;
  salePrice: number;
  taxCode: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  removed: boolean;
  createdBy: number;
  createdAt: string;
}

/** POST/PUT /api/platform-admin/unit-products/{id}/periods[/{periodId}] 요청과 맞춘다. */
export interface UnitProductPricePeriodRequest {
  currencyCode?: string;
  supplyPrice: number | null;
  salePrice: number;
  taxCode?: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * GET /api/unit-products 응답(UnitProductDto.Response.UnitProductSummary)과 맞춘다 — 옛
 * `OptionalFeatureSummary`+`CapacityAddOnSummary` 통합. 가격 관련 필드는 "오늘" 기준 유효한
 * 판매가격 기간 값이다 — 기간 사이 공백으로 오늘 유효한 기간이 없으면 전부 null이고
 * periodStatus가 "NO_ACTIVE_PERIOD"다. 기간 전체(과거/현재/예정) 목록·CRUD는 별도 엔드포인트
 * (.../periods)로 관리한다.
 */
export interface UnitProductSummary {
  id: number;
  type: UnitProductType;
  name: string;
  /** 같은 값을 가진 다른 단위 상품과 한 CeremonyEvent에 동시 적용할 수 없다. null이면 배타 관계 없음. */
  exclusivityGroup: string | null;
  category: UnitProductCategory;
  /** 이 단위 상품을 승인받아 쓰는 구매 건수 — 카탈로그 관리 화면의 "사용 중" 경고용. */
  usageCount: number;
  /** 이 묶음이 여는 이벤트 효과 id 목록. `type`이 `EVENT_EFFECT_BUNDLE`가 아니면 항상 빈 배열이다. */
  effectDefinitionIds: number[];
  createdAt: string;
  currencyCode: string | null;
  supplyPrice: number | null;
  salePrice: number | null;
  taxCode: string | null;
  /** 사용여부(오늘 유효한 기간의 값). false거나 null이면 새 선택/구매 대상에서 제외된다. */
  active: boolean | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  periodStatus: string;
}

/**
 * GET /api/platform-admin/unit-products/{id}/history 응답
 * (UnitProductDto.Response.UnitProductHistorySummary)과 맞춘다. 이름/배타그룹/분류가 바뀔
 * 때마다 한 행씩 쌓인다(가격/사용여부 변경 이력은 판매가격 기간 이력 참고).
 */
export interface UnitProductHistorySummary {
  id: number;
  type: UnitProductType;
  name: string;
  category: UnitProductCategory;
  exclusivityGroup: string | null;
  createdBy: number;
  createdAt: string;
}

/**
 * POST /api/platform-admin/unit-products 요청(UnitProductDto.Request.CreateUnitProduct)과
 * 맞춘다. 정체성(type/name/category 등)과 최초 판매가격 기간을 함께 만든다.
 */
export interface CreateUnitProductRequest {
  type: UnitProductType;
  name: string;
  category: UnitProductCategory;
  exclusivityGroup?: string | null;
  currencyCode?: string;
  supplyPrice: number | null;
  salePrice: number;
  taxCode?: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  /**
   * 이 묶음이 열어주는 이벤트 효과 목록 — `type`이 `EVENT_EFFECT_BUNDLE`일 때만 의미가
   * 있다. 생략하면(undefined) 빈 묶음으로 시작한다.
   */
  effectDefinitionIds?: number[];
}

/**
 * PUT /api/platform-admin/unit-products/{id} 요청(UnitProductDto.Request.UpdateUnitProduct)과
 * 맞춘다. type은 생성 후 불변이라 CreateUnitProductRequest와 달리 여기엔 없다. 가격/사용여부/
 * 판매기간은 여기서 다루지 않는다 — UnitProductPricePeriodRequest 기간 단위 API로 관리한다.
 */
export interface UpdateUnitProductRequest {
  name: string;
  exclusivityGroup: string | null;
  category: UnitProductCategory;
  /**
   * 이 묶음이 열어주는 이벤트 효과 목록을 통째로 교체한다(delete-all-then-recreate) —
   * `type`이 `EVENT_EFFECT_BUNDLE`일 때만 의미가 있다. 생략하면(undefined) 기존 구성을
   * 그대로 둔다. 빈 배열을 명시적으로 보내면 전부 해제한다.
   */
  effectDefinitionIds?: number[];
}

/** 플랜이 포함하는 단위 상품 한 줄 요청 — POST/PUT 플랜 요청이 통째로 담아 보낸다. */
export interface PlanUnitProductLine {
  unitProductId: number;
  /** 기본 포함 수량 — 0 이상. 0이면 "기본 미포함, 추가구매로만 확보". */
  includedQuantity: number;
  /** 이 플랜을 쓰는 행사가 이 단위 상품을 추가구매 후보로 고를 수 있는지(안 A 큐레이션). */
  purchasable: boolean;
}

/** 플랜이 포함하는 단위 상품 한 줄 응답 — 목록/상세/이력 화면이 공유한다. */
export interface PlanUnitProductLineSummary {
  unitProductId: number;
  unitProductType: UnitProductType;
  unitProductName: string;
  unitProductCategory: UnitProductCategory;
  includedQuantity: number;
  purchasable: boolean;
  /** "오늘" 기준 단위 상품 자체의 판매가(할인 없음) — 플랜 이력 스냅샷 행에서는 null이다. */
  salePrice: number | null;
  currencyCode: string | null;
}

/**
 * GET /api/billing-plans 응답(BillingPlanDto.Response.BillingPlanSummary)과 맞춘다. 플랜은
 * 더 이상 자기 가격을 갖지 않는다 — "오늘 가격"은 `unitProducts`(포함 단위상품 × 수량) 합계에
 * 이 응답의 할인 필드를 한 번 적용해 계산한다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10). 할인 관련
 * 필드는 "오늘" 기준 유효한 할인 기간 값이다 — 기간 사이 공백으로 오늘 유효한 기간이 없으면
 * 전부 null이고 periodStatus가 "NO_ACTIVE_PERIOD"다. 기간 전체(과거/현재/예정) 목록·CRUD는
 * 별도 엔드포인트(.../periods)로 관리한다.
 */
export interface BillingPlanSummary {
  id: number;
  name: string;
  unitProducts: PlanUnitProductLineSummary[];
  /** 이 플랜을 쓰는 행사(Ceremony) 수 — 카탈로그 관리 화면의 "사용 중" 경고용. */
  usageCount: number;
  createdAt: string;
  discountType: DiscountType | null;
  discountValue: number | null;
  /** 사용여부(오늘 유효한 기간의 값). false거나 null이면 새 행사 생성/플랜 변경 대상에서 제외된다. */
  active: boolean | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  periodStatus: string;
}

/**
 * GET /api/platform-admin/billing-plans/{id}/history 응답
 * (BillingPlanDto.Response.BillingPlanHistorySummary)과 맞춘다. 최신순 — 이름/단위 상품
 * 구성이 바뀔 때마다 한 행씩 쌓인다(할인/사용여부 변경 이력은 할인 기간 이력 참고).
 */
export interface BillingPlanHistorySummary {
  id: number;
  name: string;
  unitProducts: PlanUnitProductLineSummary[];
  createdBy: number;
  createdAt: string;
}

/**
 * POST /api/platform-admin/billing-plans 요청(BillingPlanDto.Request.CreatePlan)과 맞춘다.
 * 정체성(name)과 단위 상품 구성, 최초 할인 기간을 함께 만든다.
 */
export interface CreateBillingPlanRequest {
  name: string;
  /** 이 플랜이 포함하는 단위 상품 구성 전체(생략하면 빈 목록). */
  unitProducts?: PlanUnitProductLine[];
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * PUT /api/platform-admin/billing-plans/{id} 요청(BillingPlanDto.Request.UpdatePlan)과 맞춘다.
 * 할인/사용여부/판매기간은 여기서 다루지 않는다 — BillingPlanDiscountPeriodRequest 기간 단위
 * API로 관리한다.
 */
export interface UpdateBillingPlanRequest {
  name: string;
  /** 단위 상품 구성을 통째로 교체한다(생략하면 빈 목록 — 전부 뺀다는 뜻). */
  unitProducts?: PlanUnitProductLine[];
}

/**
 * 플랜 할인 기간 하나 — 옛 `CatalogPricePeriodSummary`(가격+할인)를 대체한다. 플랜은 가격이
 * 없으므로 할인 필드만 남는다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10, 3.3절).
 */
export interface BillingPlanDiscountPeriodSummary {
  id: number;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  createdAt: string;
}

/** 할인 기간의 생성/수정/삭제 이력 한 행 — removed=true면 "이 시점에 기간이 제거됐다"는 뜻. */
export interface BillingPlanDiscountPeriodHistorySummary {
  id: number;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  removed: boolean;
  createdBy: number;
  createdAt: string;
}

/** POST/PUT /api/platform-admin/billing-plans/{id}/periods[/{periodId}] 요청과 맞춘다. */
export interface BillingPlanDiscountPeriodRequest {
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

// 조직×플랜 세밀 할인 오버라이드(OrganizationDiscountDto) — signstage-docs
// business/organization-event-discount-pricing-review.md 4.1절(2026-08-21 재검토) 참고.
// 오버라이드 행이 없으면(조직별 할인 화면에 안 나타나면) 카탈로그 자체 할인값을 그대로 쓴다.
// 조직×선택옵션/조직×용량추가구매 오버라이드는 폐지됐다(signstage-docs
// business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10, 4장) —
// 단위 상품 자체는 할인이 없으므로 오버라이드할 대상이 없어졌다. 조직별 할인은 이제 플랜에만 있다.

/**
 * POST/PUT .../billing-discounts/plans/{id}[/periods/{periodId}] 요청과 맞춘다 — 행 하나가
 * 기간 하나(다중 버전, 안 B). signstage-docs
 * business/organization-discount-override-security-and-validity-period-review.md 결정
 * #4(2026-09-08). effectiveFrom은 서버가 생성(POST) 시 생략을 허용하고 이 조직의
 * defaultTimeZoneId 기준 오늘로 채운다(결정 #5, 2026-09-10) — 이 화면은 편집 UX상 항상
 * 값을 채워 보내므로 타입은 그대로 필수로 둔다.
 */
export interface SetOrganizationDiscountRequest {
  discountType: DiscountType;
  discountValue: number;
  /** yyyy-MM-dd */
  effectiveFrom: string;
  /** yyyy-MM-dd, null이면 무기한 */
  effectiveTo: string | null;
}

/** PENDING(예정)/ACTIVE(적용 중)/EXPIRED(만료됨) — 서버가 계산해 내려준다. */
export type OrganizationDiscountPeriodStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED';

/** GET .../billing-discounts 응답 중 플랜 오버라이드 기간 한 건(OrganizationDiscountDto.Response.BillingPlanDiscountSummary)과 맞춘다. */
export interface OrganizationBillingPlanDiscountSummary {
  id: number;
  organizationId: number;
  organizationName: string;
  billingPlanId: number;
  billingPlanName: string;
  discountType: DiscountType;
  discountValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: OrganizationDiscountPeriodStatus;
  createdAt: string;
}

/**
 * GET /api/platform-admin/organizations/{organizationId}/billing-discounts 응답
 * (OrganizationDiscountDto.Response.OrganizationDiscountOverview)과 맞춘다 — 이제 플랜
 * 오버라이드 하나뿐이다.
 */
export interface OrganizationDiscountOverview {
  billingPlanDiscounts: OrganizationBillingPlanDiscountSummary[];
}

// 조직×플랜 할인 오버라이드 변경 이력 — 카탈로그(BillingPlanHistorySummary 등)처럼 구조화된
// 이력 테이블이다. 설정(생성/수정) 시점마다, 그리고 제거 시점에(removed=true, 그 직전 값) 한
// 건씩 쌓인다. GET .../billing-discounts/plans/{id}/history 응답과 맞춘다.

export interface OrganizationBillingPlanDiscountHistorySummary {
  id: number;
  organizationId: number;
  billingPlanId: number;
  billingPlanName: string;
  discountType: DiscountType;
  discountValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  removed: boolean;
  createdBy: number;
  createdAt: string;
}

/**
 * GET /api/platform-admin/ceremonies(조직 횡단 목록) 응답 한 건
 * (PlatformAdminCeremonyDiscountDto.Response.CeremonyDiscountSummary)과 맞춘다 —
 * signstage-docs business/discount-management-screen-separation-review.md.
 */
export interface CeremonyDiscountSummary {
  id: number;
  organizationId: number;
  organizationName: string;
  title: string;
  status: CeremonyStatus;
  finalDiscountType: DiscountType;
  finalDiscountValue: number;
  createdAt: string;
}

/** POST /api/organizations/{organizationId}/ceremonies 요청(CeremonyDto.Request.CreateCeremony)과 맞춘다. */
export interface CreateCeremonyRequest {
  billingPlanId: number;
  title: string;
}

/**
 * GET/POST /api/organizations/{organizationId}/ceremonies(/{id}) 응답
 * (CeremonyDto.Response.CeremonySummary)과 맞춘다.
 */
/**
 * feature.ceremony.entity.CeremonyStatus 값과 맞춘다. 하위 행사(CeremonyEvent)의 상태와는
 * 별개다 — 이 Ceremony 아래 본행사(MAIN)가 전부 끝나고 결과 PDF까지 생성되면 COMPLETED로
 * 자동 전이하고, 그 뒤로는 하위 데이터가 조회만 가능해진다.
 *
 * DRAFT는 플랜 확정 전 상태다(signstage-docs business/ceremony-plan-confirmation-review.md) —
 * 새로 만든 행사는 이 상태로 시작하고, 이 상태에서만 플랜을 바꿀 수 있다. "플랜 확정"으로
 * DRAFT → IN_PROGRESS로 단방향 전이하면 그때부터 서명자/문서/하위 행사를 등록할 수 있다.
 */
export type CeremonyStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export interface CeremonySummary {
  id: number;
  organizationId: number;
  billingPlanId: number;
  currencyCode: string;
  currencyFractionDigits: number;
  timeZoneId: string;
  title: string;
  description: string | null;
  status: CeremonyStatus;
  organizingInstitution: string | null;
  organizingDepartment: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** 품목 할인과 별개로 이 행사 건에만 매기는 관리자 재량 할인. 기본값은 "할인 없음"이다. */
  finalDiscountType: DiscountType;
  finalDiscountValue: number;
  createdBy: number;
  createdAt: string;
}

/**
 * PUT .../final-discount 요청(CeremonyDto.Request.ApplyFinalDiscount)과 맞춘다. 플랫폼
 * 관리자(PLATFORM_OPS 이상) 전용이고, 플랜이 확정된(IN_PROGRESS) 행사에만 적용할 수 있다.
 */
export interface ApplyFinalDiscountRequest {
  discountType: DiscountType;
  discountValue: number;
}

/**
 * GET .../estimated-total 응답(CeremonyDto.Response.EstimatedTotal)과 맞춘다. 품목 할인 →
 * subtotal → 행사 건별 할인의 2단 순차 차감 결과다. 실제 결제/청구서 발행 기능은 아직 없다.
 * 단위 상품은 할인이 없으므로(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10) 옛
 * capacityPurchasesTotal/optionalFeaturePurchasesTotal 2종은 unitProductPurchasesTotal
 * 하나로 합쳐졌다.
 */
export interface EstimatedTotal {
  planAppliedPrice: number;
  unitProductPurchasesTotal: number;
  subtotal: number;
  finalDiscountType: DiscountType;
  finalDiscountValue: number;
  currencyCode: string;
  fractionDigits: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  finalTotal: number;
}

/**
 * PUT /api/organizations/{organizationId}/ceremonies/{ceremonyId} 요청
 * (CeremonyDto.Request.UpdateCeremony)과 맞춘다. 플랜은 여기서 바꿀 수 없다(생성 시점에 고정).
 */
export interface UpdateCeremonyRequest {
  title: string;
  description: string | null;
  organizingInstitution: string | null;
  organizingDepartment: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

/**
 * PUT .../plan 요청(CeremonyDto.Request.ChangePlan)과 맞춘다. 플랜 확정 전(DRAFT)에만
 * 허용된다.
 */
export interface ChangeCeremonyPlanRequest {
  billingPlanId: number;
}

/**
 * 플랜 변경 이력 한 줄 — 그 시점 플랜이 포함하던 단위 상품 하나의 수량+가격 스냅샷
 * (CeremonyDto.Response.PlanHistoryLineSummary)과 맞춘다.
 */
export interface CeremonyPlanHistoryLineSummary {
  unitProductId: number;
  unitProductType: UnitProductType;
  unitProductName: string;
  includedQuantity: number;
  purchasable: boolean;
  currencyCode: string;
  snapshotSalePrice: number;
  snapshotTaxCode: string;
}

/**
 * GET .../plan/history 응답(CeremonyDto.Response.PlanHistorySummary)과 맞춘다. 최신순이며,
 * 각 행은 그 변경 시점 플랜의 이름/할인/단위 상품 구성 스냅샷이다 — 카탈로그가 나중에 바뀌어도
 * 안 바뀐다(signstage-docs business/billing-catalog-unit-product-model-redesign-review.md
 * 결정, 2026-09-10 — 옛 capacities/가격 고정 필드 구조를 대체).
 */
export interface CeremonyPlanHistorySummary {
  id: number;
  billingPlanId: number;
  planName: string;
  planDiscountType: DiscountType;
  planDiscountValue: number;
  lines: CeremonyPlanHistoryLineSummary[];
  createdBy: number;
  createdAt: string;
}

/**
 * feature.ceremony.entity.PurchaseStatus 값과 맞춘다. 요청 즉시 PENDING으로 생기고,
 * 플랫폼 관리자가 APPROVED로 승인해야 유효 한도/구매한 단위 상품 집계에 반영된다.
 */
export type PurchaseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** POST .../unit-product-purchases 요청 한 줄(CeremonyDto.Request.PurchaseUnitProductLine)과 맞춘다. */
export interface PurchaseUnitProductLine {
  unitProductId: number;
  quantity: number;
}

/**
 * POST .../unit-product-purchases 요청(CeremonyDto.Request.PurchaseUnitProducts)과 맞춘다 —
 * 여러 단위 상품 줄을 한 번에 담는 장바구니형 요청이다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10). 옛
 * PurchaseCapacityRequest/PurchaseOptionalFeatureRequest 2종을 대체한다.
 */
export interface PurchaseUnitProductsRequest {
  lines: PurchaseUnitProductLine[];
}

/**
 * GET .../capacity-status 응답(CeremonyDto.Response.CapacityStatus)과 맞춘다. 서명자/문서양식/
 * 하위 행사 등록 화면이 "등록할 수 있는 개수"를 보여주는 데 쓴다. 플랜이 없는 행사는
 * Integer.MAX_VALUE(2147483647)로 온다 — "무제한"으로 표시한다.
 */
export interface CapacityStatus {
  signerLimit: number;
  templateLimit: number;
  testEventLimit: number;
  rehearsalEventLimit: number;
  mainEventLimit: number;
}

/**
 * 단위 상품 추가구매 요청 한 줄 — 구매 시점 스냅샷(CeremonyDto.Response.UnitProductPurchaseLineSummary)과
 * 맞춘다.
 */
export interface UnitProductPurchaseLineSummary {
  id: number;
  unitProductId: number;
  unitProductType: UnitProductType;
  quantity: number;
  currencyCode: string;
  /** 구매 시점 이름 스냅샷 — 카탈로그 이름이 나중에 바뀌어도 안 바뀐다(9장). */
  purchasedName: string;
  purchasedSalePrice: number;
  purchasedTaxCode: string;
}

/**
 * GET/POST .../unit-product-purchases 응답(CeremonyDto.Response.UnitProductPurchaseSummary)과
 * 맞춘다. 요청자 본인이 볼 수 있는 이력이다 — 장바구니형 요청이라 승인/반려도 요청에 담긴
 * 줄 전체 단위다. 옛 CapacityPurchaseSummary/OptionalFeaturePurchaseSummary 2종을 대체한다.
 */
export interface UnitProductPurchaseSummary {
  id: number;
  ceremonyId: number;
  lines: UnitProductPurchaseLineSummary[];
  status: PurchaseStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * GET/POST/PUT /api/platform-admin/unit-product-purchases 응답
 * (PlatformAdminCeremonyPurchaseDto.Response.UnitProductPurchaseRequestSummary)과 맞춘다 — 옛
 * PlatformAdminCapacityPurchaseRequestSummary/PlatformAdminOptionalFeaturePurchaseRequestSummary
 * 2종을 대체한다.
 */
export interface PlatformAdminUnitProductPurchaseRequestSummary {
  id: number;
  requesterId: number;
  requesterLoginId: string;
  organizationId: number;
  ceremonyId: number;
  ceremonyTitle: string;
  lines: UnitProductPurchaseLineSummary[];
  status: PurchaseStatus;
  rejectionReason: string | null;
  reviewerLoginId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * feature.ceremony.entity.CeremonyEventType 값과 맞춘다. REHEARSAL은 2026-08-27 legacy 포팅 —
 * 과금 용량 한도는 TEST와 별도인 자기 버킷을 쓴다(백엔드 CapacityType.REHEARSAL_EVENTS).
 */
export type CeremonyEventType = 'TEST' | 'REHEARSAL' | 'MAIN';

/**
 * feature.ceremony.entity.CeremonyEventStatus 값과 맞춘다. 전이는 앞으로만 간다(역행 없음).
 * FORCE_FINISHED(2026-08-27 legacy 포팅)는 STARTED인 TEST/REHEARSAL 행사를 서명 완료 여부와
 * 무관하게 관리자가 강제로 끝냈을 때만 나온다 — MAIN에는 없다.
 */
export type CeremonyEventStatus = 'DRAFT' | 'READY' | 'STARTED' | 'FINISHED' | 'FORCE_FINISHED';

/**
 * POST .../events 요청(CeremonyEventDto.Request.CreateCeremonyEvent)과 맞춘다.
 * `optionalFeatureIds`를 생략하면(undefined) 백엔드가 아무 옵션도 적용하지 않는다 — 등록
 * 화면에서 바로 적용 선택옵션을 켤 수 있게 5라운드에서 추가했다.
 */
export interface CreateCeremonyEventRequest {
  name: string;
  eventType: CeremonyEventType;
  venue: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  description: string | null;
  optionalFeatureIds?: number[];
  /** 생략하면(undefined) 아무 효과도 선택하지 않는다(BE-SETTING-02). */
  effectSelections?: CeremonyEffectSelection[];
}

/**
 * PUT .../events/{eventId} 요청(CeremonyEventDto.Request.UpdateCeremonyEvent)과 맞춘다.
 * `optionalFeatureIds`를 생략하면(undefined) 기존 적용 목록을 그대로 두고, 빈 배열을
 * 명시적으로 보내면 전부 해제한다.
 */
export interface UpdateCeremonyEventRequest {
  name: string;
  venue: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  description: string | null;
  optionalFeatureIds?: number[];
  /** 생략하면(undefined) 기존 선택을 그대로 두고, 빈 배열을 명시적으로 보내면 전부 해제한다. */
  effectSelections?: CeremonyEffectSelection[];
}

/** PUT .../events/{eventId}/optional-features 요청(CeremonyEventDto.Request.UpdateOptionalFeatures)과 맞춘다. */
export interface UpdateOptionalFeaturesRequest {
  optionalFeatureIds: number[];
}

/** POST .../events/{eventId}/templates 요청(CeremonyEventDto.Request.MapTemplate)과 맞춘다. */
export interface MapTemplateRequest {
  templateId: number;
  documentRole: TemplateDocumentRole;
}

/**
 * GET/POST .../events/{eventId}/templates 응답(CeremonyEventDto.Response.CeremonyTemplateSummary)과
 * 맞춘다. Template ↔ CeremonyEvent 매핑이다 — documentRole은 매핑 시점에 별도로 지정하는 값이라
 * Template 자신의 documentRole과 다를 수 있다.
 */
export interface CeremonyTemplateSummary {
  id: number;
  ceremonyEventId: number;
  templateId: number;
  documentRole: TemplateDocumentRole;
  createdAt: string;
}

/**
 * GET .../events/{eventId}/signature-status 응답(CeremonyEventDto.Response.SignerCompletionStatus)과
 * 맞춘다. `POST .../finish`가 실제로 검사하는 것과 같은 기준(감사 로그의 최신
 * SIGNATURE_COMPLETE 여부)이다 — 행사제어 화면은 "서명란에 스트로크가 있는가"로 자체 근사
 * 판정하지 않고 이 값을 그대로 써야 한다(안 그러면 스트로크는 있지만 `/complete` 호출이
 * 실패해 감사 로그엔 안 남은 경우를 놓쳐 "화면엔 완료로 보이는데 행사 종료가 거부되는"
 * 불일치가 생긴다).
 */
export interface SignerCompletionStatus {
  signerId: number;
  completed: boolean;
}

/**
 * GET/POST /api/organizations/{organizationId}/ceremonies/{ceremonyId}/events(/{id}) 응답
 * (CeremonyEventDto.Response.CeremonyEventSummary)과 맞춘다. accessKey는 서명자 포털/WebSocket
 * 구독 인가에 쓰인다(4라운드 이후에 의미가 생긴다).
 */
export interface CeremonyEventSummary {
  id: number;
  ceremonyId: number;
  name: string;
  eventType: CeremonyEventType;
  status: CeremonyEventStatus;
  venue: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  accessKey: string;
  description: string | null;
  optionalFeatureIds: number[];
  /** 하위 행사 목록의 표시 순서 — 위/아래 이동 버튼이 이 값을 그대로 다시 인덱싱해 저장한다(2026-08-27 legacy 포팅). */
  displayOrder: number;
  createdAt: string;
}

/** feature.ceremony.entity.ActorType 값과 맞춘다. */
export type CeremonyActorType = 'ADMIN' | 'SIGNER';

/** feature.ceremony.entity.CeremonyEventAction 값과 맞춘다. */
export type CeremonyEventAction =
  | 'START_EVENT'
  | 'FINISH_EVENT'
  | 'FORCE_FINISH_EVENT'
  | 'SIGNATURE_COMPLETE'
  | 'SIGNATURE_CLEAR'
  | 'SIGNATURE_REPLACE'
  | 'GENERATE_RESULTS'
  | 'EFFECT_AUTO_TRIGGERED'
  | 'EFFECT_MANUAL_TRIGGERED'
  | 'EFFECT_RUNTIME_CHANGED';

/**
 * feature.ceremony.service.CeremonyRealtimeNotifier가 보내는 "type" 값과 맞춘다.
 * `SIGNATURE_STROKE_SUBMITTED`는 행사제어/프로젝터 화면의 실시간 펜 궤적 렌더링 전용이다
 * (payload: signerId/templateFieldId/strokeSeq/rawData) — legacy처럼 "확정 이벤트만
 * 전파"하던 정책을 이번에 뒤집었다. `ALL_SIGNERS_COMPLETED`(payload 없음)는 그 이벤트의
 * 필수 서명자 전원이 방금 완료로 전환된 순간에만 온다 — 구 frontend 호환용 "사실" 이벤트라
 * 신규 frontend는 이걸로 효과를 실행하지 않는다(`ceremony.effect.requested`만 재생한다,
 * signstage-docs business/ceremony-event-effect-implementation-tasks.md PRE-04).
 * `ceremony.effect.requested`/`ceremony.effect.setting.changed`는 이벤트 효과
 * 전용(BE-RUNTIME) — 대문자 "사실" 이벤트와 다르게 점(dot) 표기를 쓴다.
 */
export type RealtimeEventType =
  | 'EVENT_STATUS_CHANGED'
  | 'SIGNATURE_COMPLETED'
  | 'SIGNATURE_CLEARED'
  | 'SIGNATURE_REPLACED'
  | 'SIGNATURE_STROKE_SUBMITTED'
  | 'ALL_SIGNERS_COMPLETED'
  | 'ceremony.effect.requested'
  | 'ceremony.effect.setting.changed';

/**
 * WebSocket(STOMP) `/topic/events/{eventId}/state` 메시지 봉투(RealtimeEventDto)와 맞춘다.
 * `payload`는 `type`마다 모양이 달라(EVENT_STATUS_CHANGED: previousStatus/newStatus,
 * SIGNATURE_COMPLETED/REPLACED: signerId/signerName, SIGNATURE_CLEARED: signerId/
 * templateFieldId) 느슨하게 `Record<string, unknown>`으로 두고 처리부에서 타입 단언한다.
 * `version`은 단조 증가 순번 — 효과 요청/runtime 변경/서명 완료는 그 사건의 감사 로그 id,
 * 그 외 기존 "사실" 이벤트는 전환 기간 동안 `null`이다(PRE-04).
 */
export interface RealtimeEventMessage {
  type: RealtimeEventType;
  eventId: number;
  occurredAt: string;
  payload: Record<string, unknown>;
  version: number | null;
}

/**
 * GET /api/ceremony-effects, GET/POST .../platform-admin/ceremony-effects(/{id}) 응답
 * (CeremonyEffectDefinitionDto.Response.CeremonyEffectDefinitionSummary)과 맞춘다 —
 * signstage-docs business/ceremony-event-effect-implementation-tasks.md BE-CATALOG/FE-CORE-01.
 */
export interface CeremonyEffectDefinition {
  id: number;
  code: string;
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
  /**
   * 이 효과를 포함한 단위 상품(EVENT_EFFECT_BUNDLE 묶음) id 목록 — 여러 묶음에 겹쳐 속할 수
   * 있다(2026-09-08). 필드명은 옛 `OptionalFeatureCode` 시절 그대로다 — 2026-09-10
   * `UnitProduct` 통합 때 백엔드 DTO 필드명은 바꾸지 않았다(응답 JSON 키 `optionalFeatureIds`
   * 그대로).
   */
  optionalFeatureIds: number[];
  displayName: string;
  description: string | null;
  rendererKey: string;
  enabled: boolean;
  userVisible: boolean;
  manuallyTriggerable: boolean;
  displayOrder: number;
  configJson: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * POST /api/platform-admin/ceremony-effects 요청
 * (CeremonyEffectDefinitionDto.Request.CreateCeremonyEffectDefinition)과 맞춘다.
 * `code`/`targetType`/`triggerType`/`rendererKey`는 등록 후 불변이라 이 요청에만 있고
 * 아래 Update 요청에는 없다. 이 효과를 여는 단위 상품(EVENT_EFFECT_BUNDLE 묶음) 구성은 이
 * 요청이 갖지 않는다 — `UnitProductService` 쪽에서 `effectDefinitionIds`로 관리한다
 * (2026-09-08 결정, 2026-09-10 `UnitProduct` 통합으로 소속 이전).
 */
export interface CreateCeremonyEffectDefinitionRequest {
  code: string;
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
  displayName: string;
  description: string | null;
  rendererKey: string;
  manuallyTriggerable?: boolean;
  configJson?: Record<string, unknown> | null;
}

/** PUT /api/platform-admin/ceremony-effects/{id} 요청(CeremonyEffectDefinitionDto.Request.UpdateCeremonyEffectDefinition)과 맞춘다. */
export interface UpdateCeremonyEffectDefinitionRequest {
  displayName: string;
  description: string | null;
  enabled: boolean;
  userVisible: boolean;
  manuallyTriggerable: boolean;
  configJson?: Record<string, unknown> | null;
}

/**
 * PUT /api/platform-admin/ceremony-effects/order 요청
 * (CeremonyEffectDefinitionDto.Request.ReorderCeremonyEffectDefinitions)과 맞춘다. `orderedIds`는
 * 이 (targetType, triggerType) 그룹의 id 전체 집합과 정확히 같아야 한다(서버가 크기·포함
 * 여부를 모두 검사한다 — 일부만 보내면 EFFECT_DEFINITION_ORDER_GROUP_MISMATCH).
 */
export interface ReorderCeremonyEffectDefinitionsRequest {
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
  orderedIds: number[];
}

/**
 * PUT .../events/{eventId}/effects/settings 요청 안의 항목 하나
 * (CeremonyEventEffectSettingDto.Request.EffectSelection)와 맞춘다 —
 * `CreateCeremonyEvent`/`UpdateCeremonyEvent` 요청의 `effectSelections`도 이 타입의 배열을
 * 그대로 쓴다(BE-SETTING-02, 여러 요청이 공유하는 DTO). `effectId`가 null이면 이 분류를
 * 해제(NONE)한다.
 */
export interface CeremonyEffectSelection {
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
  effectId: number | null;
}

/**
 * GET .../events/{eventId}/effects/settings, GET /api/projector/events/{eventAccessKey}/effects/settings
 * 응답(CeremonyEventEffectSettingDto.Response.EffectSettingSummary)과 맞춘다 — 조직 스코프
 * 조회와 공개 프로젝터 snapshot이 같은 모양을 쓴다(PRE-04).
 */
export interface CeremonyEventEffectSetting {
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
  effectCode: string;
  rendererKey: string;
  displayName: string;
  runtimeEnabled: boolean;
  manuallyTriggerable: boolean;
}

/**
 * 프로젝터 화면에서 문서 페이지 한 장이 실제로 화면에 그려진 위치·크기(px) — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-CORE-03. `ProjectorView`가 이미
 * 갖고 있는 지역 `PageFrame` 개념과 같은 모양이라, FE-PROJECTOR에서 그대로 넘겨 쓸 수 있다.
 */
export interface ProjectorEffectPageFrame {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `useCeremonyEffectScheduler`/`ProjectorEffects`가 다루는 재생 요청 하나 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-CORE-02/03. `effectCode`는 항상
 * 채워져 있다 — `useProjectorEffectsController`가 요청을 만드는 시점에 이미
 * `CeremonyEventEffectSetting`으로 해석해 넣어 둔다(SIGNATURE_COMPLETED는 설정 스냅샷에서,
 * ALL_SIGNATURES_COMPLETED는 `ceremony.effect.requested` payload에서). `ProjectorEffects`는
 * 이 값이 로컬 Registry에 없으면 그 즉시 완료 처리하고 다음 큐로 넘어간다.
 */
export interface ProjectorEffectRequest {
  kind: CeremonyEffectTrigger;
  requestId: string;
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
  effectCode: string;
  signerId?: number;
  completionId?: string;
  triggeredBy?: 'auto' | 'manual';
}

/**
 * GET .../events/{eventId}/logs 응답(CeremonyEventLogDto.Response.CeremonyEventLogSummary)과 맞춘다.
 * append-only 감사 로그다.
 */
export interface CeremonyEventLogSummary {
  id: number;
  ceremonyEventId: number;
  actorType: CeremonyActorType;
  actorId: number;
  eventAction: CeremonyEventAction;
  targetSignerId: number | null;
  message: string | null;
  createdAt: string;
}

/**
 * PUT .../signers/display-orders, .../templates/display-orders, .../events/display-orders
 * 요청(DisplayOrderRequest.UpdateDisplayOrders)과 맞춘다 — 세 컨트롤러가 같은 모양을
 * 공유한다. 목록 화면의 위/아래 이동 버튼이 전체 배열을 원하는 순서로 다시 인덱싱해
 * 통째로 보낸다(2026-08-27 legacy 포팅).
 */
export interface UpdateDisplayOrdersRequest {
  items: { id: number; displayOrder: number }[];
}

/** POST .../signers 요청(SignerDto.Request.CreateSigner)과 맞춘다. */
export interface CreateSignerRequest {
  name: string;
  position: string | null;
  affiliation: string | null;
  roleCode: string | null;
}

/** PUT .../signers/{signerId} 요청(SignerDto.Request.UpdateSigner)과 맞춘다. accessKey는 여기서 바꾸지 않는다. */
export interface UpdateSignerRequest {
  name: string;
  position: string | null;
  affiliation: string | null;
  roleCode: string | null;
}

/**
 * GET/POST .../signers(/{id}) 응답(SignerDto.Response.SignerSummary)과 맞춘다. accessKey는
 * 서명자 포털 접속에 쓰인다(4라운드 이후에 의미가 생긴다).
 */
export interface SignerSummary {
  id: number;
  ceremonyId: number;
  name: string;
  position: string | null;
  affiliation: string | null;
  roleCode: string | null;
  accessKey: string;
  /** 서명자 목록의 표시 순서 — 위/아래 이동 버튼이 이 값을 그대로 다시 인덱싱해 저장한다(2026-08-27 legacy 포팅). */
  displayOrder: number;
  /** 시작/종료된 하위 행사에 배정돼 수정이 막힌 서명자면 true. */
  locked: boolean;
  /** 서명란 배정/서명·감사 기록이 있어 삭제할 수 없는 서명자면 false — 삭제 버튼을 숨긴다. */
  deletable: boolean;
  createdAt: string;
}

/**
 * POST(multipart) .../signers/excel-upload 응답(SignerDto.Response.ExcelUploadResult)과
 * 맞춘다. 이름이 빈 행은 등록되지 않고 skippedRows로 알려준다. 엑셀 양식 다운로드
 * (GET .../signers/excel-template)는 별도 요청/응답 타입이 없다 — blob으로 그대로 받는다.
 */
export interface SignerExcelUploadResult {
  createdSigners: SignerSummary[];
  skippedRows: SkippedSignerRow[];
}

export interface SkippedSignerRow {
  /** 엑셀의 실제 행 번호(1행=헤더, 2행부터 데이터). */
  rowNumber: number;
  reason: string;
}

/** feature.ceremony.entity.TemplateDocumentRole 값과 맞춘다. */
export type TemplateDocumentRole = 'CONTRACT' | 'EXHIBITION';

/** feature.ceremony.entity.TemplateStatus 값과 맞춘다. */
export type TemplateStatus = 'DRAFT' | 'COMPLETED';

/**
 * POST(multipart)/GET .../templates(/{id}) 응답(TemplateDto.Response.TemplateSummary)과 맞춘다.
 * 업로드 자체는 `title`/`documentRole`(문자열 그대로)/`file`을 FormData로 보낸다 — 별도 요청
 * DTO 타입이 없다(백엔드가 `@RequestParam`으로 직접 받음). status는 서명란 배치 화면의
 * "설정 완료"를 눌러야 COMPLETED로 바뀐다(POST .../complete) — 완료되면 서명란을 더 이상
 * 바꿀 수 없다(읽기 전용).
 */
export interface TemplateSummary {
  id: number;
  ceremonyId: number;
  title: string;
  documentRole: TemplateDocumentRole;
  originalFilename: string;
  status: TemplateStatus;
  /** 문서 양식 목록의 표시 순서 — 위/아래 이동 버튼이 이 값을 그대로 다시 인덱싱해 저장한다(2026-08-27 legacy 포팅). */
  displayOrder: number;
  fieldCount: number;
  /** 시작/종료된 하위 행사에 매핑돼 수정이 막힌 문서 양식이면 true. */
  locked: boolean;
  /** 하위 행사에 매핑돼 있어 삭제할 수 없는 문서 양식이면 false — 삭제 버튼을 숨긴다. */
  deletable: boolean;
  createdAt: string;
}

/** PUT .../templates/{templateId} 요청(TemplateDto.Request.UpdateTemplate)과 맞춘다. */
export interface UpdateTemplateRequest {
  title: string;
  documentRole: TemplateDocumentRole;
}

/** POST .../templates/{templateId}/fields 요청(TemplateFieldDto.Request.CreateTemplateField)과 맞춘다. */
export interface CreateTemplateFieldRequest {
  fieldKey: string;
  pageIndex: number;
  fieldIndex: number;
  fieldName: string;
  roleCode: string | null;
  signOrder: number | null;
  isRequired: boolean | null;
  signerId: number | null;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

/**
 * PUT .../templates/{templateId}/fields 요청(TemplateFieldDto.Request.SetFields)과 맞춘다.
 * 서명란 배치 화면의 "저장" — diff 없이 항상 전체 배열을 통째로 보낸다.
 */
export interface SetFieldsRequest {
  fields: CreateTemplateFieldRequest[];
}

/** GET .../templates/{templateId}/info 응답(TemplateDto.Response.TemplateInfo)과 맞춘다. */
export interface TemplateInfo {
  pageCount: number;
  width: number | null;
  height: number | null;
}

// ── 서명자 포털(공개, JWT 없음) ─────────────────────────────────────────
// feature.ceremony.controller.SignerPortalController DTO와 맞춘다. eventAccessKey/
// signerAccessKey 소지만으로 접근하는 공개 API라 이 타입들은 인증 컨텍스트와 무관하다.

/**
 * GET /api/portal/events/{eventAccessKey}/signers/{signerAccessKey} 응답 중 requiredFields
 * 원소(SignerPortalDto.Response.RequiredFieldStatus)와 맞춘다. 좌표는 없다 — 포털은 좌표가
 * 있는 TemplateField 조회 API(JWT 필요)를 못 부른다(SignaturePad가 필드 박스 역할을 대신함).
 */
export interface PortalRequiredFieldStatus {
  templateFieldId: number;
  templateId: number;
  fieldName: string;
  pageIndex: number;
  hasStroke: boolean;
}

/** GET /api/portal/events/{eventAccessKey}/signers/{signerAccessKey} 응답과 맞춘다. */
export interface PortalContext {
  eventId: number;
  eventName: string;
  /** 서명자 포털 도구모음의 구분 뱃지에 쓴다(2026-08-27 legacy 포팅). */
  eventType: CeremonyEventType;
  eventStatus: CeremonyEventStatus;
  signerId: number;
  signerName: string;
  signerPosition: string | null;
  signerAffiliation: string | null;
  requiredFields: PortalRequiredFieldStatus[];
}

/**
 * GET .../contract 응답(SignerPortalDto.Response.PortalContractDocument)과 맞춘다. 서명용
 * (CONTRACT) 문서를 통째로 배경에 깔고 그 위에 서명란을 오버레이로 그리기 위한 정보다 —
 * `fields`는 이 서명자 본인 것만이 아니라 문서에 배치된 전체 서명란이다(legacy
 * `SignerView.tsx`처럼 남의 서명란도 흐리게 함께 보여준다). CONTRACT 매핑이 없으면 `null`.
 */
export interface PortalContractDocument {
  templateId: number;
  title: string;
  pageCount: number;
  width: number | null;
  height: number | null;
  fields: TemplateFieldSummary[];
}

/** POST .../strokes 요청(SignerPortalDto.Request.SubmitStroke)과 맞춘다. */
export interface SubmitStrokeRequest {
  templateFieldId: number;
  strokeSeq: number;
  rawData: string;
}

/** POST .../strokes 응답(SignerPortalDto.Response.StrokeSubmitted)과 맞춘다. */
export interface StrokeSubmitted {
  id: number;
  templateFieldId: number;
  strokeSeq: number;
  createdAt: string;
}

/** feature.ceremony.entity.CeremonyResultType 값과 맞춘다. */
export type CeremonyResultType = 'CONTRACT' | 'EXHIBITION';

/**
 * GET/POST .../events/{eventId}/results 응답(CeremonyResultDto.Response.CeremonyResultSummary)과
 * 맞춘다. 이벤트당 결과물 종류(CONTRACT/EXHIBITION)별로 1회만 생성된다.
 */
export interface CeremonyResultSummary {
  id: number;
  ceremonyEventId: number;
  templateId: number;
  resultType: CeremonyResultType;
  originalFilename: string;
  fileSize: number;
  checksum: string;
  createdAt: string;
}

/**
 * POST /api/verification/documents 응답(DocumentVerificationDto.Response.VerificationResult)과
 * 맞춘다. `verified=false`면 나머지 필드는 전부 `null`이다(신원 노출 없음, 공개 API).
 */
export interface DocumentVerificationResult {
  verified: boolean;
  resultType: CeremonyResultType | null;
  ceremonyTitle: string | null;
  eventName: string | null;
  generatedAt: string | null;
  verifiedAt: string | null;
}

/**
 * GET/POST .../templates/{templateId}/fields 응답(TemplateFieldDto.Response.TemplateFieldSummary)과
 * 맞춘다. 좌표 4종은 페이지 기준 0~1 비율, 좌상단 원점이다(signstage-backend
 * feature.ceremony.support.SignatureOverlayRenderer와 같은 좌표계).
 */
export interface TemplateFieldSummary {
  id: number;
  templateId: number;
  signerId: number | null;
  fieldKey: string;
  pageIndex: number;
  fieldIndex: number;
  fieldName: string;
  roleCode: string | null;
  signOrder: number | null;
  isRequired: boolean;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  createdAt: string;
}

/**
 * GET .../events/{eventId}/strokes, GET /api/projector/events/{eventAccessKey}/strokes
 * 응답(StrokeDataDto.Response.StrokeSummary)과 맞춘다. `rawData`는 필드 박스 기준 0~1 좌표
 * JSON 배열 문자열(`[[x,y],...]`) — `MappedDocumentPreview`가 파싱해서 Konva Line으로 그린다.
 */
export interface StrokeSummary {
  id: number;
  signerId: number;
  templateFieldId: number;
  strokeSeq: number;
  rawData: string;
  createdAt: string;
}

/**
 * GET /api/projector/events/{eventAccessKey} 응답(ProjectorDto.Response.ProjectorContext)과
 * 맞춘다. 공개 프로젝터 화면(전시용 화면) 전용 — JWT 없이 eventAccessKey 소지만으로 조회한다.
 */
export interface ProjectorContext {
  eventId: number;
  eventName: string;
  /** 전시용 화면 도구모음의 구분 뱃지에 쓴다(2026-08-27 legacy 포팅). */
  eventType: CeremonyEventType;
  eventStatus: CeremonyEventStatus;
  eventAccessKey: string;
  exhibition: ProjectorExhibitionDocument | null;
  /**
   * 이 하위 행사에 실제로 적용된 단위 상품 유형(`UnitProductType.name()`) 목록 — 옛
   * `OptionalFeatureCode.name()` 목록을 대체한다(signstage-docs
   * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10).
   * **CUTOVER-03 이후 프런트에서는 더 이상 읽지 않는다** — 서명 하이라이트/폭죽 같은
   * 프로젝터 전용 연출은 이제 이벤트 효과 설정(`CeremonyEventEffectSetting`)과
   * `useProjectorEffectsController`가 대신 판단한다. 백엔드 `ProjectorService`가 이 필드를
   * 여전히 내려주므로(구 이벤트 adapter 정리 전이라 아직 지우지 않았다) 타입만 남겨
   * 배선(wire) 형태를 그대로 반영해 둔다.
   */
  appliedOptionalFeatureCodes: UnitProductType[];
}

export interface ProjectorExhibitionDocument {
  templateId: number;
  title: string;
  pageCount: number;
  width: number | null;
  height: number | null;
  fields: TemplateFieldSummary[];
  signers: ProjectorSignerInfo[];
}

export interface ProjectorSignerInfo {
  id: number;
  name: string;
}
