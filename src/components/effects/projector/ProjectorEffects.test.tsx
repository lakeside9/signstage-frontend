import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectorEffects } from './ProjectorEffects';

const frame = { pageIndex: 0, x: 10, y: 20, width: 1000, height: 500 };
const field = {
  id: 1,
  templateId: 1,
  signerId: 7,
  fieldKey: 'field-1',
  pageIndex: 0,
  fieldIndex: 0,
  fieldName: '서명',
  roleCode: null,
  signOrder: null,
  isRequired: true,
  xRatio: 0.1,
  yRatio: 0.2,
  widthRatio: 0.3,
  heightRatio: 0.2,
  createdAt: '2026-09-07T00:00:00',
};
const onComplete = vi.fn();

describe('ProjectorEffects', () => {
  beforeEach(() => {
    onComplete.mockReset();
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows a highlight for every distinct signature completion request', () => {
    const { rerender } = render(
      <ProjectorEffects
        enabled
        eventStatus="STARTED"
        request={{
          kind: 'SIGNATURE_COMPLETED',
          signerId: 7,
          completionId: '1',
          requestId: 'signature-7-1',
          effectCode: 'HIGHLIGHT',
          targetType: 'PROJECTOR',
          triggerType: 'SIGNATURE_COMPLETED',
        }}
        frames={[frame]}
        fields={[field]}
        onComplete={onComplete}
      />,
    );
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByTestId('projector-signature-highlight')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1600));
    expect(screen.queryByTestId('projector-signature-highlight')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith('signature-7-1');

    rerender(
      <ProjectorEffects
        enabled
        eventStatus="STARTED"
        request={{
          kind: 'SIGNATURE_COMPLETED',
          signerId: 7,
          completionId: '2',
          requestId: 'signature-7-2',
          effectCode: 'HIGHLIGHT',
          targetType: 'PROJECTOR',
          triggerType: 'SIGNATURE_COMPLETED',
        }}
        frames={[frame]}
        fields={[field]}
        onComplete={onComplete}
      />,
    );
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByTestId('projector-signature-highlight')).toBeInTheDocument();
  });

  it('renders confetti for a celebration request', () => {
    render(
      <ProjectorEffects
        enabled
        eventStatus="STARTED"
        request={{
          kind: 'ALL_SIGNATURES_COMPLETED',
          requestId: 'auto-10',
          triggeredBy: 'auto',
          effectCode: 'CONFETTI',
          targetType: 'PROJECTOR',
          triggerType: 'ALL_SIGNATURES_COMPLETED',
        }}
        frames={[]}
        fields={[]}
        onComplete={onComplete}
      />,
    );

    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByTestId('projector-confetti-canvas')).toBeInTheDocument();
  });

  it.each([
    ['AIR_SHOT', 'projector-air-shot-canvas'],
    ['PAPER_REEL', 'projector-paper-reel-canvas'],
  ] as const)('renders the %s completion effect', (effectCode, testId) => {
    render(
      <ProjectorEffects
        enabled
        eventStatus="STARTED"
        request={{
          kind: 'ALL_SIGNATURES_COMPLETED',
          requestId: `auto-${effectCode}`,
          triggeredBy: 'auto',
          effectCode,
          targetType: 'PROJECTOR',
          triggerType: 'ALL_SIGNATURES_COMPLETED',
        }}
        frames={[]}
        fields={[]}
        onComplete={onComplete}
      />,
    );

    act(() => vi.advanceTimersByTime(0));
    expect(screen.getAllByTestId(testId).length).toBeGreaterThan(0);
  });

  it('ignores an unknown completion effect code and completes the request immediately', () => {
    render(
      <ProjectorEffects
        enabled
        eventStatus="STARTED"
        request={{
          kind: 'ALL_SIGNATURES_COMPLETED',
          requestId: 'auto-unknown',
          triggeredBy: 'auto',
          effectCode: 'UNKNOWN',
          targetType: 'PROJECTOR',
          triggerType: 'ALL_SIGNATURES_COMPLETED',
        }}
        frames={[]}
        fields={[]}
        onComplete={onComplete}
      />,
    );

    act(() => vi.advanceTimersByTime(0));
    expect(screen.queryByTestId('projector-confetti-canvas')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith('auto-unknown');
  });

  it('skips the completion effect and completes immediately when prefers-reduced-motion is set', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    render(
      <ProjectorEffects
        enabled
        eventStatus="STARTED"
        request={{
          kind: 'ALL_SIGNATURES_COMPLETED',
          requestId: 'auto-reduced-motion',
          triggeredBy: 'auto',
          effectCode: 'FIREWORKS',
          targetType: 'PROJECTOR',
          triggerType: 'ALL_SIGNATURES_COMPLETED',
        }}
        frames={[]}
        fields={[]}
        onComplete={onComplete}
      />,
    );

    act(() => vi.advanceTimersByTime(0));
    expect(onComplete).toHaveBeenCalledWith('auto-reduced-motion');
  });

  it('completes a request immediately instead of playing it when disabled', () => {
    render(
      <ProjectorEffects
        enabled={false}
        eventStatus="STARTED"
        request={{
          kind: 'SIGNATURE_COMPLETED',
          signerId: 7,
          completionId: '1',
          requestId: 'signature-7-1',
          effectCode: 'HIGHLIGHT',
          targetType: 'PROJECTOR',
          triggerType: 'SIGNATURE_COMPLETED',
        }}
        frames={[frame]}
        fields={[field]}
        onComplete={onComplete}
      />,
    );

    act(() => vi.advanceTimersByTime(0));
    expect(screen.queryByTestId('projector-signature-highlight')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith('signature-7-1');
  });
});
