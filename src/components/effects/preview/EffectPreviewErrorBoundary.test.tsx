import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EffectPreviewErrorBoundary } from './EffectPreviewErrorBoundary';

const BrokenEffect = () => { throw new Error('renderer failed'); };

describe('EffectPreviewErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports the error and recovers when resetKey changes (예: 다시 재생 버튼)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onError = vi.fn();
    const { rerender } = render(
      <EffectPreviewErrorBoundary resetKey={1} onError={onError}><BrokenEffect /></EffectPreviewErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);

    rerender(
      <EffectPreviewErrorBoundary resetKey={2} onError={onError}><div>preview restarted</div></EffectPreviewErrorBoundary>,
    );
    expect(screen.getByText('preview restarted')).toBeInTheDocument();
  });
});
