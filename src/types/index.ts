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
