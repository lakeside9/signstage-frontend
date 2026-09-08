import { useCallback, useRef, useState } from 'react';
import type { CeremonyEffectTarget, CeremonyEffectTrigger } from './ceremonyEffectCatalog';

export interface SchedulableEffectRequest {
  requestId: string;
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
}

const MAX_PENDING_REQUESTS = 20;
const MAX_DEDUP_KEYS = 200;

const triggerPriority: Record<CeremonyEffectTrigger, number> = {
  EVENT_FINISHED: 300,
  ALL_SIGNATURES_COMPLETED: 200,
  SIGNATURE_COMPLETED: 100,
};

const priorityOf = (request: SchedulableEffectRequest): number => (
  triggerPriority[request.triggerType]
);

export const useCeremonyEffectScheduler = <T extends SchedulableEffectRequest>(
  targetType: CeremonyEffectTarget,
) => {
  const activeRef = useRef<T | null>(null);
  const pendingRef = useRef<T[]>([]);
  const seenRequestIdsRef = useRef(new Set<string>());
  const [activeRequest, setActiveRequest] = useState<T | null>(null);

  const enqueue = useCallback((request: T) => {
    if (request.targetType !== targetType) return false;
    if (seenRequestIdsRef.current.has(request.requestId)) return false;

    seenRequestIdsRef.current.add(request.requestId);
    if (seenRequestIdsRef.current.size > MAX_DEDUP_KEYS) {
      const oldest = seenRequestIdsRef.current.values().next().value;
      if (oldest) seenRequestIdsRef.current.delete(oldest);
    }

    if (!activeRef.current) {
      activeRef.current = request;
      setActiveRequest(request);
      return true;
    }

    pendingRef.current = [...pendingRef.current, request]
      .sort((left, right) => priorityOf(right) - priorityOf(left))
      .slice(0, MAX_PENDING_REQUESTS);
    return true;
  }, [targetType]);

  const completeActiveRequest = useCallback((requestId: string) => {
    if (activeRef.current?.requestId !== requestId) return;
    const next = pendingRef.current.shift() ?? null;
    activeRef.current = next;
    setActiveRequest(next);
  }, []);

  const clear = useCallback(() => {
    activeRef.current = null;
    pendingRef.current = [];
    setActiveRequest(null);
  }, []);

  const cancelByTrigger = useCallback((triggerType: CeremonyEffectTrigger) => {
    pendingRef.current = pendingRef.current.filter(request => request.triggerType !== triggerType);
    if (activeRef.current?.triggerType !== triggerType) return;
    const next = pendingRef.current.shift() ?? null;
    activeRef.current = next;
    setActiveRequest(next);
  }, []);

  return {
    activeRequest,
    enqueue,
    completeActiveRequest,
    clear,
    cancelByTrigger,
  };
};
