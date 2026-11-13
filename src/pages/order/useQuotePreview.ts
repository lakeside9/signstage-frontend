import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import type { MarginSimulation, MarginSimulationRequest } from '../../types';

/**
 * 견적 계산 결과 미리보기 — 입력이 멈추고 잠시 뒤 영업 마진 시뮬레이션 API로 계산한다(저장하지 않는다).
 * 견적 작성과 범위 변경이 같이 쓴다. `blockedReason`이 있으면 요청하지 않고 그 문구를 안내로 돌려준다.
 */
export const useQuotePreview = (request: MarginSimulationRequest | null, blockedReason: string | null) => {
  const [preview, setPreview] = useState<MarginSimulation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestJson = blockedReason || !request ? null : JSON.stringify(request);

  useEffect(() => {
    if (!requestJson) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.post('/platform-admin/margin-simulations', JSON.parse(requestJson));
        if (cancelled) return;
        setPreview(response.data as MarginSimulation);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setPreview(null);
        setError(err instanceof Error ? err.message : '계산에 실패했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestJson]);

  return {
    preview: requestJson ? preview : null,
    error: blockedReason ?? error,
    isLoading: requestJson !== null && isLoading,
  };
};
