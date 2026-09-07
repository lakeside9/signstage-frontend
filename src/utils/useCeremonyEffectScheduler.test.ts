import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCeremonyEffectScheduler } from './useCeremonyEffectScheduler';

type Request = {
  requestId: string;
  targetType: 'PROJECTOR' | 'SIGNER';
  triggerType: 'SIGNATURE_COMPLETED' | 'ALL_SIGNATURES_COMPLETED';
};

describe('useCeremonyEffectScheduler', () => {
  it('runs only one request and starts completion after the active signature ends', () => {
    const { result } = renderHook(() => useCeremonyEffectScheduler<Request>('PROJECTOR'));

    act(() => {
      result.current.enqueue({
        requestId: 'signature-1',
        targetType: 'PROJECTOR',
        triggerType: 'SIGNATURE_COMPLETED',
      });
      result.current.enqueue({
        requestId: 'completion-1',
        targetType: 'PROJECTOR',
        triggerType: 'ALL_SIGNATURES_COMPLETED',
      });
    });

    expect(result.current.activeRequest?.requestId).toBe('signature-1');

    act(() => result.current.completeActiveRequest('signature-1'));
    expect(result.current.activeRequest?.requestId).toBe('completion-1');
  });

  it('keeps projector and signer queues isolated', () => {
    const { result } = renderHook(() => ({
      projector: useCeremonyEffectScheduler<Request>('PROJECTOR'),
      signer: useCeremonyEffectScheduler<Request>('SIGNER'),
    }));

    act(() => {
      result.current.projector.enqueue({
        requestId: 'projector-1',
        targetType: 'PROJECTOR',
        triggerType: 'SIGNATURE_COMPLETED',
      });
      result.current.signer.enqueue({
        requestId: 'signer-1',
        targetType: 'SIGNER',
        triggerType: 'SIGNATURE_COMPLETED',
      });
    });

    expect(result.current.projector.activeRequest?.requestId).toBe('projector-1');
    expect(result.current.signer.activeRequest?.requestId).toBe('signer-1');

    act(() => result.current.projector.completeActiveRequest('projector-1'));
    expect(result.current.projector.activeRequest).toBeNull();
    expect(result.current.signer.activeRequest?.requestId).toBe('signer-1');
  });

  it('prioritizes completion requests without interrupting the active effect', () => {
    const { result } = renderHook(() => useCeremonyEffectScheduler<Request>('PROJECTOR'));

    act(() => {
      result.current.enqueue({ requestId: 'signature-1', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED' });
      result.current.enqueue({ requestId: 'signature-2', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED' });
      result.current.enqueue({ requestId: 'completion-1', targetType: 'PROJECTOR', triggerType: 'ALL_SIGNATURES_COMPLETED' });
    });

    act(() => result.current.completeActiveRequest('signature-1'));
    expect(result.current.activeRequest?.requestId).toBe('completion-1');
  });

  it('cancels active and pending requests only for the disabled trigger', () => {
    const { result } = renderHook(() => useCeremonyEffectScheduler<Request>('PROJECTOR'));
    act(() => {
      result.current.enqueue({ requestId: 'signature-1', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED' });
      result.current.enqueue({ requestId: 'signature-2', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED' });
      result.current.enqueue({ requestId: 'completion-1', targetType: 'PROJECTOR', triggerType: 'ALL_SIGNATURES_COMPLETED' });
      result.current.cancelByTrigger('SIGNATURE_COMPLETED');
    });

    expect(result.current.activeRequest?.requestId).toBe('completion-1');
  });
});
