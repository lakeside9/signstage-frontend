import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RealtimeEventMessage } from '../types';
import { useProjectorEffectsController } from './useProjectorEffectsController';

const message = (
  type: RealtimeEventMessage['type'],
  payload: Record<string, unknown>,
  version: number | null = null,
): RealtimeEventMessage => ({ type, eventId: 1, occurredAt: '2026-09-07T00:00:00', payload, version });

describe('useProjectorEffectsController', () => {
  it('enqueues a completion request from ceremony.effect.requested and reports the event as handled', () => {
    const { result } = renderHook(() => useProjectorEffectsController());

    let handled = false;
    act(() => {
      handled = result.current.consumeRealtimeEvent(message('ceremony.effect.requested', {
        targetType: 'PROJECTOR',
        triggerType: 'ALL_SIGNATURES_COMPLETED',
        effectCode: 'FIREWORKS',
        rendererKey: 'projector-fireworks',
        requestId: 'auto-999',
        triggeredBy: 'auto',
      }, 999));
    });

    expect(handled).toBe(true);
    expect(result.current.activeRequest).toMatchObject({
      requestId: 'auto-999',
      effectCode: 'FIREWORKS',
      triggeredBy: 'auto',
      targetType: 'PROJECTOR',
      triggerType: 'ALL_SIGNATURES_COMPLETED',
    });
  });

  it('ignores ceremony.effect.requested for a non-PROJECTOR/non-celebration classification', () => {
    const { result } = renderHook(() => useProjectorEffectsController());

    act(() => {
      result.current.consumeRealtimeEvent(message('ceremony.effect.requested', {
        targetType: 'SIGNER',
        triggerType: 'ALL_SIGNATURES_COMPLETED',
        effectCode: 'FIREWORKS',
        requestId: 'auto-1',
      }));
    });

    expect(result.current.activeRequest).toBeNull();
  });

  it('does not enqueue SIGNATURE_COMPLETED before a setting snapshot has been applied', () => {
    const { result } = renderHook(() => useProjectorEffectsController());

    let handled = true;
    act(() => {
      handled = result.current.consumeRealtimeEvent(message('SIGNATURE_COMPLETED', {
        signerId: 10, signerName: '홍길동', completionId: '500',
      }, 500));
    });

    expect(handled).toBe(false); // 다른 화면 로직도 이 사실 이벤트를 계속 처리할 수 있어야 한다.
    expect(result.current.activeRequest).toBeNull();
  });

  it('enqueues SIGNATURE_COMPLETED once applySettings resolves an active effect for that trigger', () => {
    const { result } = renderHook(() => useProjectorEffectsController());

    act(() => {
      result.current.applySettings([
        {
          targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', effectCode: 'HIGHLIGHT',
          rendererKey: 'projector-signature-highlight', displayName: '하이라이트', runtimeEnabled: true, manuallyTriggerable: false,
        },
      ]);
    });
    act(() => {
      result.current.consumeRealtimeEvent(message('SIGNATURE_COMPLETED', {
        signerId: 10, signerName: '홍길동', completionId: '500',
      }, 500));
    });

    expect(result.current.activeRequest).toMatchObject({
      requestId: 'signature-10-500',
      effectCode: 'HIGHLIGHT',
      signerId: 10,
      completionId: '500',
    });
  });

  it('does not enqueue SIGNATURE_COMPLETED when the resolved trigger is runtime OFF', () => {
    const { result } = renderHook(() => useProjectorEffectsController());

    act(() => {
      result.current.applySettings([
        {
          targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', effectCode: 'HIGHLIGHT',
          rendererKey: 'projector-signature-highlight', displayName: '하이라이트', runtimeEnabled: false, manuallyTriggerable: false,
        },
      ]);
    });
    act(() => {
      result.current.consumeRealtimeEvent(message('SIGNATURE_COMPLETED', { signerId: 10, completionId: '500' }, 500));
    });

    expect(result.current.activeRequest).toBeNull();
  });

  it('ceremony.effect.setting.changed updates runtime state and cancels pending/active requests when turned off', () => {
    const { result } = renderHook(() => useProjectorEffectsController());

    act(() => {
      result.current.consumeRealtimeEvent(message('ceremony.effect.requested', {
        targetType: 'PROJECTOR', triggerType: 'ALL_SIGNATURES_COMPLETED', effectCode: 'FIREWORKS', requestId: 'auto-1',
      }));
    });
    expect(result.current.activeRequest?.requestId).toBe('auto-1');

    act(() => {
      result.current.consumeRealtimeEvent(message('ceremony.effect.setting.changed', {
        targetType: 'PROJECTOR', triggerType: 'ALL_SIGNATURES_COMPLETED', effectCode: 'FIREWORKS', runtimeEnabled: false,
      }, 42));
    });

    expect(result.current.activeRequest).toBeNull();
    expect(result.current.isRuntimeEnabled('ALL_SIGNATURES_COMPLETED')).toBe(false);
  });

  it('returns false and ignores legacy-only ALL_SIGNERS_COMPLETED (no double playback)', () => {
    const { result } = renderHook(() => useProjectorEffectsController());

    let handled = true;
    act(() => {
      handled = result.current.consumeRealtimeEvent(message('ALL_SIGNERS_COMPLETED', {}));
    });

    expect(handled).toBe(false);
    expect(result.current.activeRequest).toBeNull();
  });
});
