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
  | 'REJECT_ORGANIZATION_REQUEST';

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
  maxMainEvents: number;
  optionalFeatureIds: number[];
  createdAt: string;
}

/** feature.ceremony.entity.OptionalFeatureCode 값과 맞춘다. */
export type OptionalFeatureCode = 'SIGNER_FIELD_ZOOM' | 'ALL_SIGNED_FIREWORKS' | 'VIDEO_ATTENDANCE';

/** GET /api/optional-features 응답(OptionalFeatureDto.Response.OptionalFeatureSummary)과 맞춘다. */
export interface OptionalFeatureSummary {
  id: number;
  code: OptionalFeatureCode;
  name: string;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
  createdAt: string;
}

/** feature.ceremony.entity.CapacityType 값과 맞춘다. */
export type CapacityType = 'SIGNERS' | 'TEMPLATES' | 'TEST_EVENTS' | 'MAIN_EVENTS';

/** GET /api/capacity-addons 응답(CapacityAddOnDto.Response.CapacityAddOnSummary)과 맞춘다. */
export interface CapacityAddOnSummary {
  id: number;
  capacityType: CapacityType;
  unitAmount: number;
  supplyPrice: number;
  salePrice: number;
  discountType: DiscountType;
  discountValue: number;
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
export interface CeremonySummary {
  id: number;
  organizationId: number;
  billingPlanId: number;
  title: string;
  createdBy: number;
  createdAt: string;
}

/** POST .../capacity-purchases 요청(CeremonyDto.Request.PurchaseCapacity)과 맞춘다. */
export interface PurchaseCapacityRequest {
  capacityAddOnId: number;
  quantity: number;
}

/** POST .../capacity-purchases 응답(CeremonyDto.Response.CapacityPurchaseSummary)과 맞춘다. */
export interface CapacityPurchaseSummary {
  id: number;
  ceremonyId: number;
  capacityAddOnId: number;
  quantity: number;
  purchasedSalePrice: number;
  purchasedDiscountType: DiscountType;
  purchasedDiscountValue: number;
  createdAt: string;
}

/** POST .../optional-feature-purchases 요청(CeremonyDto.Request.PurchaseOptionalFeature)과 맞춘다. */
export interface PurchaseOptionalFeatureRequest {
  optionalFeatureId: number;
}

/** POST .../optional-feature-purchases 응답(CeremonyDto.Response.OptionalFeaturePurchaseSummary)과 맞춘다. */
export interface OptionalFeaturePurchaseSummary {
  id: number;
  ceremonyId: number;
  optionalFeatureId: number;
  purchasedSalePrice: number;
  purchasedDiscountType: DiscountType;
  purchasedDiscountValue: number;
  createdAt: string;
}

/** feature.ceremony.entity.CeremonyEventType 값과 맞춘다. */
export type CeremonyEventType = 'TEST' | 'MAIN';

/** feature.ceremony.entity.CeremonyEventStatus 값과 맞춘다. 전이는 앞으로만 간다(역행 없음). */
export type CeremonyEventStatus = 'DRAFT' | 'READY' | 'STARTED' | 'FINISHED';

/** POST .../events 요청(CeremonyEventDto.Request.CreateCeremonyEvent)과 맞춘다. */
export interface CreateCeremonyEventRequest {
  name: string;
  eventType: CeremonyEventType;
  venue: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  description: string | null;
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

/** feature.ceremony.service.CeremonyRealtimeNotifier가 보내는 "type" 값과 맞춘다. */
export type RealtimeEventType =
  | 'EVENT_STATUS_CHANGED'
  | 'SIGNATURE_COMPLETED'
  | 'SIGNATURE_CLEARED'
  | 'SIGNATURE_REPLACED';

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

/** POST .../signers 요청(SignerDto.Request.CreateSigner)과 맞춘다. */
export interface CreateSignerRequest {
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
  createdAt: string;
}

/** feature.ceremony.entity.TemplateDocumentRole 값과 맞춘다. */
export type TemplateDocumentRole = 'CONTRACT' | 'EXHIBITION';

/** feature.ceremony.entity.TemplateStatus 값과 맞춘다. */
export type TemplateStatus = 'DRAFT' | 'COMPLETED';

/**
 * POST(multipart)/GET .../templates(/{id}) 응답(TemplateDto.Response.TemplateSummary)과 맞춘다.
 * 업로드 자체는 `title`/`documentRole`(문자열 그대로)/`file`을 FormData로 보낸다 — 별도 요청
 * DTO 타입이 없다(백엔드가 `@RequestParam`으로 직접 받음).
 */
export interface TemplateSummary {
  id: number;
  ceremonyId: number;
  title: string;
  documentRole: TemplateDocumentRole;
  originalFilename: string;
  status: TemplateStatus;
  createdAt: string;
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
  eventStatus: CeremonyEventStatus;
  signerId: number;
  signerName: string;
  requiredFields: PortalRequiredFieldStatus[];
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
