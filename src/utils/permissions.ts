import type { PlatformRole } from '../types';

/**
 * PLATFORM_OPS 이상만 회원 상태를 변경(승인/거절/비활성화)할 수 있다 — PLATFORM_SUPPORT는 조회만 가능.
 * signstage-backend PlatformAdminUserService.STATUS_CHANGE_ALLOWED_ROLES와 짝을 맞춘다.
 * 최종 판단은 항상 백엔드가 하고, 여기서는 불필요한 버튼을 안 보여주는 용도로만 쓴다.
 */
const STATUS_CHANGE_ALLOWED_ROLES: PlatformRole[] = ['PLATFORM_OPS', 'PLATFORM_SUPER'];

export const canChangeMemberStatus = (platformRole: PlatformRole | null | undefined): boolean =>
  !!platformRole && STATUS_CHANGE_ALLOWED_ROLES.includes(platformRole);
