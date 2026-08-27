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
  locale: string;
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
  defaultLocale: string;
  createdAt: string;
  /** 호출한 사용자가 이 조직에서 가진 역할. OWNER만 조직 정보를 수정할 수 있다. */
  myRole: MemberRole;
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
  locale: string;
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
  | 'REJECT_OPTIONAL_FEATURE_PURCHASE';

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

/** GET /api/billing-plans 응답(BillingPlanDto.Response.BillingPlanSummary)과 맞춘다. */
export interface BillingPlanSummary {
  id: number;
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  maxSigners: number;
  maxTemplates: number;
  maxTestEvents: number;
  maxRehearsalEvents: number;
  maxMainEvents: number;
  /** 사용여부. false면 새 행사 생성/플랜 변경 대상에서 제외된다. */
  active: boolean;
  /** 이 플랜을 쓰는 행사(Ceremony) 수 — 카탈로그 관리 화면의 "사용 중" 경고용. */
  usageCount: number;
  optionalFeatureIds: number[];
  createdAt: string;
}

/**
 * GET /api/platform-admin/billing-plans/{id}/history 응답
 * (BillingPlanDto.Response.BillingPlanHistorySummary)과 맞춘다. 최신순이며, 각 행은 그 변경
 * 시점의 전체 상태 스냅샷이다.
 */
export interface BillingPlanHistorySummary {
  id: number;
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  maxSigners: number;
  maxTemplates: number;
  maxTestEvents: number;
  maxRehearsalEvents: number;
  maxMainEvents: number;
  active: boolean;
  createdBy: number;
  createdAt: string;
}

/**
 * POST /api/platform-admin/billing-plans 요청(BillingPlanDto.Request.CreatePlan)과 맞춘다.
 * optionalFeatureIds는 생성 시점에만 정하고 이후 불변이다.
 */
export interface CreateBillingPlanRequest {
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  maxSigners: number;
  maxTemplates: number;
  maxTestEvents: number;
  maxRehearsalEvents: number;
  maxMainEvents: number;
  optionalFeatureIds: number[];
}

/**
 * PUT /api/platform-admin/billing-plans/{id} 요청(BillingPlanDto.Request.UpdatePlan)과 맞춘다.
 * optionalFeatureIds는 불변이라 CreateBillingPlanRequest와 달리 여기엔 없다.
 */
export interface UpdateBillingPlanRequest {
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  maxSigners: number;
  maxTemplates: number;
  maxTestEvents: number;
  maxRehearsalEvents: number;
  maxMainEvents: number;
  active: boolean;
  /** 이 플랜에 기본으로 포함할 선택옵션 id 목록. 이제 수정 시에도 통째로 교체할 수 있다(9장 후속). */
  optionalFeatureIds: number[];
}

/** feature.ceremony.entity.OptionalFeatureCode 값과 맞춘다. */
export type OptionalFeatureCode =
  | 'SIGNER_FIELD_ZOOM'
  | 'ALL_SIGNED_FIREWORKS'
  | 'VIDEO_ATTENDANCE'
  | 'TABLET_RENTAL';

/** GET /api/optional-features 응답(OptionalFeatureDto.Response.OptionalFeatureSummary)과 맞춘다. */
export interface OptionalFeatureSummary {
  id: number;
  code: OptionalFeatureCode;
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  /** 사용여부. false면 새 추가구매 대상에서 제외된다. */
  active: boolean;
  /** 이 옵션이 프로젝터(전시용) 화면에 실제로 효과를 내는 종류인지 — 분류 정보일 뿐, 실제 동작은 projectorEffects.ts에 코드별로 구현돼 있어야 한다. */
  projectorEffect: boolean;
  /** 같은 값을 가진 다른 선택옵션과 한 CeremonyEvent에 동시 적용할 수 없다. null이면 배타 관계 없음. */
  exclusivityGroup: string | null;
  /** 이 옵션을 승인받아 쓰는 구매 건수 — 카탈로그 관리 화면의 "사용 중" 경고용. */
  usageCount: number;
  createdAt: string;
}

/**
 * GET /api/platform-admin/optional-features/{id}/history 응답
 * (OptionalFeatureDto.Response.OptionalFeatureHistorySummary)과 맞춘다.
 */
export interface OptionalFeatureHistorySummary {
  id: number;
  code: OptionalFeatureCode;
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  projectorEffect: boolean;
  exclusivityGroup: string | null;
  createdBy: number;
  createdAt: string;
}

/** POST /api/platform-admin/optional-features 요청(OptionalFeatureDto.Request.CreateOptionalFeature)과 맞춘다. */
export interface CreateOptionalFeatureRequest {
  code: OptionalFeatureCode;
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  /** 생략하면(undefined) 백엔드 기본값 true. */
  projectorEffect?: boolean;
  exclusivityGroup?: string | null;
}

/**
 * PUT /api/platform-admin/optional-features/{id} 요청(OptionalFeatureDto.Request.UpdateOptionalFeature)과
 * 맞춘다. code는 생성 후 불변이라 CreateOptionalFeatureRequest와 달리 여기엔 없다.
 */
export interface UpdateOptionalFeatureRequest {
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  projectorEffect: boolean;
  exclusivityGroup: string | null;
}

/** feature.ceremony.entity.CapacityType 값과 맞춘다. */
export type CapacityType = 'SIGNERS' | 'TEMPLATES' | 'TEST_EVENTS' | 'REHEARSAL_EVENTS' | 'MAIN_EVENTS' | 'TABLETS';

/**
 * GET /api/capacity-addons 응답(CapacityAddOnDto.Response.CapacityAddOnSummary)과 맞춘다.
 * secondaryCapacityType이 있으면 묶음 상품이다(예: "서명자+태블릿" — capacityType=SIGNERS,
 * secondaryCapacityType=TABLETS). 구매 1건으로 두 용량이 함께 늘어난다.
 */
export interface CapacityAddOnSummary {
  id: number;
  capacityType: CapacityType;
  unitAmount: number;
  secondaryCapacityType: CapacityType | null;
  secondaryUnitAmount: number | null;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  /** 사용여부. false면 새 추가구매 대상에서 제외된다. */
  active: boolean;
  /** 이 상품을 승인받아 쓰는 구매 건수 — 카탈로그 관리 화면의 "사용 중" 경고용. */
  usageCount: number;
  createdAt: string;
}

/**
 * GET /api/platform-admin/capacity-addons/{id}/history 응답
 * (CapacityAddOnDto.Response.CapacityAddOnHistorySummary)과 맞춘다.
 */
export interface CapacityAddOnHistorySummary {
  id: number;
  capacityType: CapacityType;
  unitAmount: number;
  secondaryCapacityType: CapacityType | null;
  secondaryUnitAmount: number | null;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  createdBy: number;
  createdAt: string;
}

/** POST /api/platform-admin/capacity-addons 요청(CapacityAddOnDto.Request.CreateCapacityAddOn)과 맞춘다. */
export interface CreateCapacityAddOnRequest {
  capacityType: CapacityType;
  unitAmount: number;
  /** 묶음 상품일 때만 지정한다(예: "서명자+태블릿"). 없으면 단일 상품. */
  secondaryCapacityType?: CapacityType | null;
  secondaryUnitAmount?: number | null;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
}

/**
 * PUT /api/platform-admin/capacity-addons/{id} 요청(CapacityAddOnDto.Request.UpdateCapacityAddOn)과
 * 맞춘다. capacityType/secondaryCapacityType은 생성 후 불변이라 여기엔 없다 — 묶음 여부를
 * 바꾸려면 새 상품을 등록해야 한다. 원래 묶음 상품이었다면 secondaryUnitAmount는 필수다.
 */
export interface UpdateCapacityAddOnRequest {
  unitAmount: number;
  secondaryUnitAmount?: number | null;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
}

// 조직×품목 세밀 할인 오버라이드(OrganizationDiscountDto) — signstage-docs
// business/organization-event-discount-pricing-review.md 4.1절(2026-08-21 재검토) 참고.
// 오버라이드 행이 없으면(조직별 할인 화면에 안 나타나면) 카탈로그 자체 할인값을 그대로 쓴다.

/** PUT .../billing-discounts/{plans|optional-features|capacity-addons}/{id} 요청과 맞춘다. */
export interface SetOrganizationDiscountRequest {
  discountType: DiscountType;
  discountValue: number;
}

/** GET .../billing-discounts 응답 중 플랜 오버라이드 한 건(OrganizationDiscountDto.Response.BillingPlanDiscountSummary)과 맞춘다. */
export interface OrganizationBillingPlanDiscountSummary {
  id: number;
  organizationId: number;
  billingPlanId: number;
  billingPlanName: string;
  discountType: DiscountType;
  discountValue: number;
  createdAt: string;
}

/** 선택옵션 오버라이드 한 건(OrganizationDiscountDto.Response.OptionalFeatureDiscountSummary)과 맞춘다. */
export interface OrganizationOptionalFeatureDiscountSummary {
  id: number;
  organizationId: number;
  optionalFeatureId: number;
  optionalFeatureName: string;
  discountType: DiscountType;
  discountValue: number;
  createdAt: string;
}

/** 용량 추가구매 오버라이드 한 건(OrganizationDiscountDto.Response.CapacityAddOnDiscountSummary)과 맞춘다. */
export interface OrganizationCapacityAddOnDiscountSummary {
  id: number;
  organizationId: number;
  capacityAddOnId: number;
  capacityType: CapacityType;
  unitAmount: number;
  discountType: DiscountType;
  discountValue: number;
  createdAt: string;
}

/**
 * GET /api/platform-admin/organizations/{organizationId}/billing-discounts 응답
 * (OrganizationDiscountDto.Response.OrganizationDiscountOverview)과 맞춘다. 세 카탈로그 종류의
 * 오버라이드를 한 번에 받는다.
 */
export interface OrganizationDiscountOverview {
  billingPlanDiscounts: OrganizationBillingPlanDiscountSummary[];
  optionalFeatureDiscounts: OrganizationOptionalFeatureDiscountSummary[];
  capacityAddOnDiscounts: OrganizationCapacityAddOnDiscountSummary[];
}

// 조직×품목 할인 오버라이드 변경 이력 — 카탈로그(BillingPlanHistorySummary 등)처럼 구조화된
// 이력 테이블이다. 설정(생성/수정) 시점마다, 그리고 제거 시점에(removed=true, 그 직전 값) 한
// 건씩 쌓인다. GET .../billing-discounts/{plans|optional-features|capacity-addons}/{id}/history
// 응답과 맞춘다.

export interface OrganizationBillingPlanDiscountHistorySummary {
  id: number;
  organizationId: number;
  billingPlanId: number;
  billingPlanName: string;
  discountType: DiscountType;
  discountValue: number;
  removed: boolean;
  createdBy: number;
  createdAt: string;
}

export interface OrganizationOptionalFeatureDiscountHistorySummary {
  id: number;
  organizationId: number;
  optionalFeatureId: number;
  optionalFeatureName: string;
  discountType: DiscountType;
  discountValue: number;
  removed: boolean;
  createdBy: number;
  createdAt: string;
}

export interface OrganizationCapacityAddOnDiscountHistorySummary {
  id: number;
  organizationId: number;
  capacityAddOnId: number;
  capacityType: CapacityType;
  unitAmount: number;
  discountType: DiscountType;
  discountValue: number;
  removed: boolean;
  createdBy: number;
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
 */
export interface EstimatedTotal {
  planAppliedPrice: number;
  capacityPurchasesTotal: number;
  optionalFeaturePurchasesTotal: number;
  subtotal: number;
  finalDiscountType: DiscountType;
  finalDiscountValue: number;
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
 * GET .../plan/history 응답(CeremonyDto.Response.PlanHistorySummary)과 맞춘다. 최신순이며,
 * 각 행은 그 변경 시점 플랜의 이름/가격/한도 스냅샷이다 — 카탈로그가 나중에 바뀌어도 안 바뀐다.
 */
export interface CeremonyPlanHistorySummary {
  id: number;
  billingPlanId: number;
  planName: string;
  planSupplyPrice: number;
  planSalePrice: number;
  planDiscountType: DiscountType;
  planDiscountValue: number;
  planMaxSigners: number;
  planMaxTemplates: number;
  planMaxTestEvents: number;
  planMaxRehearsalEvents: number;
  planMaxMainEvents: number;
  createdBy: number;
  createdAt: string;
}

/** POST .../capacity-purchases 요청(CeremonyDto.Request.PurchaseCapacity)과 맞춘다. */
export interface PurchaseCapacityRequest {
  capacityAddOnId: number;
  quantity: number;
}

/**
 * feature.ceremony.entity.PurchaseStatus 값과 맞춘다. 요청 즉시 PENDING으로 생기고,
 * 플랫폼 관리자가 APPROVED로 승인해야 유효 한도/구매한 선택옵션 집계에 반영된다.
 */
export type PurchaseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * GET/POST .../capacity-purchases 응답(CeremonyDto.Response.CapacityPurchaseSummary)과 맞춘다.
 * 요청자 본인이 볼 수 있는 이력이다.
 */
export interface CapacityPurchaseSummary {
  id: number;
  ceremonyId: number;
  capacityAddOnId: number;
  quantity: number;
  /** 구매 시점 단가 스냅샷 — 카탈로그 단가가 나중에 바뀌어도 안 바뀐다(9장). */
  purchasedUnitAmount: number;
  /** 묶음 상품(예: "서명자+태블릿")이었을 때만 값이 있다 — 구매 시점 보조 용량 단가 스냅샷. */
  purchasedSecondaryUnitAmount: number | null;
  purchasedSalePrice: number;
  purchasedDiscountType: DiscountType;
  purchasedDiscountValue: number;
  status: PurchaseStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
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

/** POST .../optional-feature-purchases 요청(CeremonyDto.Request.PurchaseOptionalFeature)과 맞춘다. */
export interface PurchaseOptionalFeatureRequest {
  optionalFeatureId: number;
}

/**
 * GET/POST .../optional-feature-purchases 응답(CeremonyDto.Response.OptionalFeaturePurchaseSummary)과
 * 맞춘다. 요청자 본인이 볼 수 있는 이력이다.
 */
export interface OptionalFeaturePurchaseSummary {
  id: number;
  ceremonyId: number;
  optionalFeatureId: number;
  /** 구매 시점 이름 스냅샷 — 카탈로그 이름이 나중에 바뀌어도 안 바뀐다(9장). */
  purchasedName: string;
  purchasedSalePrice: number;
  purchasedDiscountType: DiscountType;
  purchasedDiscountValue: number;
  status: PurchaseStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * GET/POST/PUT /api/platform-admin/capacity-purchases 응답
 * (PlatformAdminCeremonyPurchaseDto.Response.CapacityPurchaseRequestSummary)과 맞춘다.
 */
export interface PlatformAdminCapacityPurchaseRequestSummary {
  id: number;
  requesterId: number;
  requesterLoginId: string;
  organizationId: number;
  ceremonyId: number;
  ceremonyTitle: string;
  capacityAddOnId: number;
  quantity: number;
  purchasedSalePrice: number;
  status: PurchaseStatus;
  rejectionReason: string | null;
  reviewerLoginId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * GET/POST/PUT /api/platform-admin/optional-feature-purchases 응답
 * (PlatformAdminCeremonyPurchaseDto.Response.OptionalFeaturePurchaseRequestSummary)과 맞춘다.
 */
export interface PlatformAdminOptionalFeaturePurchaseRequestSummary {
  id: number;
  requesterId: number;
  requesterLoginId: string;
  organizationId: number;
  ceremonyId: number;
  ceremonyTitle: string;
  optionalFeatureId: number;
  purchasedSalePrice: number;
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
  | 'SIGNATURE_COMPLETE'
  | 'SIGNATURE_CLEAR'
  | 'SIGNATURE_REPLACE'
  | 'GENERATE_RESULTS';

/**
 * feature.ceremony.service.CeremonyRealtimeNotifier가 보내는 "type" 값과 맞춘다.
 * `SIGNATURE_STROKE_SUBMITTED`는 행사제어/프로젝터 화면의 실시간 펜 궤적 렌더링 전용이다
 * (payload: signerId/templateFieldId/strokeSeq/rawData) — legacy처럼 "확정 이벤트만
 * 전파"하던 정책을 이번에 뒤집었다. `ALL_SIGNERS_COMPLETED`(payload 없음)는 그 이벤트의
 * 필수 서명자 전원이 방금 완료로 전환된 순간에만 온다 — 프로젝터의 폭죽(ALL_SIGNED_FIREWORKS)
 * 연출 트리거 전용이다(`pages/projectorEffects.ts`).
 */
export type RealtimeEventType =
  | 'EVENT_STATUS_CHANGED'
  | 'SIGNATURE_COMPLETED'
  | 'SIGNATURE_CLEARED'
  | 'SIGNATURE_REPLACED'
  | 'SIGNATURE_STROKE_SUBMITTED'
  | 'ALL_SIGNERS_COMPLETED';

/**
 * WebSocket(STOMP) `/topic/events/{eventId}/state` 메시지 봉투(RealtimeEventDto)와 맞춘다.
 * `payload`는 `type`마다 모양이 달라(EVENT_STATUS_CHANGED: previousStatus/newStatus,
 * SIGNATURE_COMPLETED/REPLACED: signerId/signerName, SIGNATURE_CLEARED: signerId/
 * templateFieldId) 느슨하게 `Record<string, unknown>`으로 두고 처리부에서 타입 단언한다.
 */
export interface RealtimeEventMessage {
  type: RealtimeEventType;
  eventId: number;
  occurredAt: string;
  payload: Record<string, unknown>;
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
  /** 이 하위 행사에 적용된 선택옵션 코드 — 서명 하이라이트/폭죽 같은 프로젝터 전용 연출 효과의 on/off 판단에 쓴다. */
  appliedOptionalFeatureCodes: OptionalFeatureCode[];
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
