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

/** POST/GET /api/organizations 응답(OrganizationDto.Response.Organization)과 맞춘다. */
export interface OrganizationSummary {
  id: number;
  name: string;
  code: string;
  status: string;
  defaultLocale: string;
  createdAt: string;
}

/**
 * GET/PUT /api/platform-admin/users 응답(PlatformAdminUserDto.Response.UserSummary)과 맞춘다.
 */
export interface PlatformAdminUserSummary {
  id: number;
  loginId: string;
  name: string;
  email: string;
  phone: string | null;
  locale: string;
  status: UserStatus;
  platformRole: PlatformRole | null;
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
