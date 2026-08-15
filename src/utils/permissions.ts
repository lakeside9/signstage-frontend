import type { PlatformRole } from '../types';

/**
 * PLATFORM_OPS 이상만 회원/조직 제어(상태 변경, 잠금 해제, 강제 비밀번호 재설정 등)를 할 수 있다 —
 * PLATFORM_SUPPORT는 조회만 가능. signstage-backend PlatformAdminUserService/
 * PlatformAdminOrganizationService의 *_CONTROL_ALLOWED_ROLES와 짝을 맞춘다.
 * 최종 판단은 항상 백엔드가 하고, 여기서는 불필요한 버튼을 안 보여주는 용도로만 쓴다.
 */
const PLATFORM_CONTROL_ALLOWED_ROLES: PlatformRole[] = ['PLATFORM_OPS', 'PLATFORM_SUPER'];

export const canManagePlatform = (platformRole: PlatformRole | null | undefined): boolean =>
  !!platformRole && PLATFORM_CONTROL_ALLOWED_ROLES.includes(platformRole);

/**
 * 플랫폼 관리자 계정 생성/해제는 PLATFORM_SUPER만 할 수 있다
 * (signstage-docs business/user-organization-design.md 7.2절).
 */
export const isPlatformSuper = (platformRole: PlatformRole | null | undefined): boolean =>
  platformRole === 'PLATFORM_SUPER';
