import { act, render, screen } from '@testing-library/react';
import { useEffect, type FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCeremonyEffectScheduler } from '../../../utils/useCeremonyEffectScheduler';
import type { ProjectorEffectRequest } from '../../../types';
import { ProjectorEffects } from './ProjectorEffects';
import { ProjectorEffectsBoundary } from './ProjectorEffectsBoundary';

vi.mock('./projectorEffectRegistry', async () => {
  const actual = await vi.importActual<typeof import('./projectorEffectRegistry')>('./projectorEffectRegistry');
  return {
    ...actual,
    signatureEffectRegistry: {
      ...actual.signatureEffectRegistry,
      HIGHLIGHT: () => { throw new Error('renderer exploded'); },
    },
  };
});

/**
 * FE-CORE-04 — "Renderer 오류 시 active request를 완료 처리하고 다음 큐로 진행한다"를
 * 실제 조합(scheduler + ProjectorEffects + ProjectorEffectsBoundary)으로 검증한다. 개별
 * 단위 테스트(ProjectorEffectsBoundary.test.tsx)는 boundary 자체의 재활용만 확인하므로,
 * 여기서는 "깨진 효과가 큐를 막지 않고 다음 요청으로 넘어간다"는 통합 동작을 확인한다.
 */
const Harness: FC<{ requests: ProjectorEffectRequest[] }> = ({ requests }) => {
  const { activeRequest, enqueue, completeActiveRequest } = useCeremonyEffectScheduler<ProjectorEffectRequest>('PROJECTOR');

  useEffect(() => {
    requests.forEach(enqueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProjectorEffectsBoundary requestId={activeRequest?.requestId} onError={completeActiveRequest}>
      <ProjectorEffects
        enabled
        eventStatus="STARTED"
        request={activeRequest}
        frames={[]}
        fields={[]}
        onComplete={completeActiveRequest}
      />
      <div data-testid="active-request-id">{activeRequest?.requestId ?? 'none'}</div>
    </ProjectorEffectsBoundary>
  );
};

describe('ProjectorEffects + ProjectorEffectsBoundary integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('advances the queue to the next request when the active renderer throws', () => {
    render(
      <Harness
        requests={[
          {
            kind: 'SIGNATURE_COMPLETED', requestId: 'signature-1-1', signerId: 1, completionId: '1',
            effectCode: 'HIGHLIGHT', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED',
          },
          {
            kind: 'SIGNATURE_COMPLETED', requestId: 'signature-2-1', signerId: 2, completionId: '1',
            effectCode: 'HIGHLIGHT', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('active-request-id')).toHaveTextContent('signature-1-1');

    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByTestId('active-request-id')).toHaveTextContent('signature-2-1');
  });
});
