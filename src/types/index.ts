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
