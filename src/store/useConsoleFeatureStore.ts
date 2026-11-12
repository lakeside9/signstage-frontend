import { create } from 'zustand';
import { api } from '../utils/api';

/**
 * 조직 콘솔 기능 설정 — 파트너 직접 수주 보류(signstage-docs
 * business/platform-order-partner-subcontract-review.md D29 안 A). 꺼져 있으면 행사 직접 등록,
 * 플랜·추가구매, 고객 견적, 현장지원 요청, 구독·마진 화면을 숨긴다. 서버도 같은 설정으로 API를
 * 막으므로 여기서는 버튼을 안 보여주는 용도로만 쓴다. 불러오기 전과 실패 시에는 꺼진 것으로 본다.
 */
interface ConsoleFeatureState {
  partnerDirectOrderEnabled: boolean;
  loadConsoleFeatures: () => Promise<void>;
  /** 플랫폼 관리자가 데모 조직을 운영할 때 — 서버가 관리자 토큰은 통과시키므로 화면도 연다. */
  enableForPlatformAdmin: () => void;
}

export const useConsoleFeatureStore = create<ConsoleFeatureState>((set) => ({
  partnerDirectOrderEnabled: false,

  loadConsoleFeatures: async () => {
    try {
      const response = await api.get('/organizations/me/features');
      set({ partnerDirectOrderEnabled: (response.data as { partnerDirectOrderEnabled: boolean }).partnerDirectOrderEnabled });
    } catch {
      set({ partnerDirectOrderEnabled: false });
    }
  },

  enableForPlatformAdmin: () => set({ partnerDirectOrderEnabled: true }),
}));
