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
