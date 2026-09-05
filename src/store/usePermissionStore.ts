import { create } from 'zustand';
import { api } from '../utils/api';

/**
 * 로그인한 플랫폼 관리자의 허용 권한키 집합 — signstage-docs
 * business/menu-and-action-permission-management-review.md 10장. `AdminLayout`이 마운트
 * 시점에 한 번 로드하고(12장 결정 #7, 우선 로그인 시점 1회 로드), 화면들은 `hasPermission(key)`로
 * 참조한다. 최종 판단은 항상 백엔드가 하고(2.3절), 여기서는 버튼을 안 보여주는 용도로만 쓴다.
 */
interface PermissionState {
  permissionKeys: string[];
  isLoaded: boolean;
  loadMyPermissions: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
  reset: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissionKeys: [],
  isLoaded: false,

  loadMyPermissions: async () => {
    try {
      const response = await api.get('/platform-admin/permissions/me');
      const permissionKeys = (response.data as { permissionKeys: string[] }).permissionKeys;
      set({ permissionKeys, isLoaded: true });
    } catch {
      // 조회 실패는 "권한 없음"으로 안전하게 처리한다 — 버튼이 안 보이는 정도이고,
      // 실제 호출은 어차피 백엔드가 다시 막는다(2.3절).
      set({ permissionKeys: [], isLoaded: true });
    }
  },

  hasPermission: (permissionKey) => get().permissionKeys.includes(permissionKey),

  reset: () => set({ permissionKeys: [], isLoaded: false }),
}));
