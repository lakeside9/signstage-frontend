import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectPreviewDialog } from './EffectPreviewDialog';

const onClose = vi.fn();

/** FE-ADMIN-03 — signstage-docs business/ceremony-event-effect-implementation-tasks.md. */
describe('EffectPreviewDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    onClose.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a signature effect against the sample signature field', () => {
    render(<EffectPreviewDialog open effect={{
      code: 'HIGHLIGHT',
      displayName: '서명란 강조',
      targetType: 'PROJECTOR',
      triggerType: 'SIGNATURE_COMPLETED',
      rendererKey: 'projector-signature-highlight',
    }} onClose={onClose} />);

    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole('dialog', { name: '서명란 강조 미리보기' })).toBeInTheDocument();
    expect(screen.getByTestId('projector-signature-highlight')).toBeInTheDocument();
  });

  it('contains a completion effect inside the preview stage', () => {
    render(<EffectPreviewDialog open effect={{
      code: 'CONFETTI',
      displayName: '축하 색종이',
      targetType: 'PROJECTOR',
      triggerType: 'ALL_SIGNATURES_COMPLETED',
      rendererKey: 'projector-confetti',
    }} onClose={onClose} />);

    act(() => vi.advanceTimersByTime(0));

    const stage = screen.getByTestId('effect-preview-stage');
    expect(stage.contains(screen.getByTestId('projector-confetti-canvas'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '정지' }));
    expect(screen.queryByTestId('projector-confetti-canvas')).not.toBeInTheDocument();
  });

  it('isolates an effect without a deployed renderer', () => {
    render(<EffectPreviewDialog open effect={{
      code: 'NOT_DEPLOYED',
      displayName: '미배포 효과',
      targetType: 'SIGNER',
      triggerType: 'EVENT_FINISHED',
      rendererKey: 'signer-not-deployed',
    }} onClose={onClose} />);

    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByText(/배포된 Renderer가 없어/)).toBeInTheDocument();
  });

  it('설정 JSON 원문이 유효한 객체가 아니면 미리볼 수 없다는 안내를 보여준다', () => {
    render(<EffectPreviewDialog open effect={{
      code: 'HIGHLIGHT',
      displayName: '서명란 강조',
      targetType: 'PROJECTOR',
      triggerType: 'SIGNATURE_COMPLETED',
      rendererKey: 'projector-signature-highlight',
      configJson: '[1,2,3]', // 배열은 객체가 아니라 거부돼야 한다
    }} onClose={onClose} />);

    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByText(/올바른 객체 형식이어야/)).toBeInTheDocument();
  });

  it('ESC를 누르면 닫힌다', () => {
    render(<EffectPreviewDialog open effect={{
      code: 'HIGHLIGHT',
      displayName: '서명란 강조',
      targetType: 'PROJECTOR',
      triggerType: 'SIGNATURE_COMPLETED',
      rendererKey: 'projector-signature-highlight',
    }} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
