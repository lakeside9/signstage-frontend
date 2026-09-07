import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectorEffectsBoundary } from './ProjectorEffectsBoundary';

const BrokenEffect = () => { throw new Error('renderer failed'); };

describe('ProjectorEffectsBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('completes the failed request and recovers for the next request', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onError = vi.fn();
    const { rerender } = render(<ProjectorEffectsBoundary requestId="effect-1" onError={onError}><BrokenEffect /></ProjectorEffectsBoundary>);
    expect(onError).toHaveBeenCalledWith('effect-1');

    rerender(<ProjectorEffectsBoundary requestId="effect-2" onError={onError}><div>next effect</div></ProjectorEffectsBoundary>);
    expect(screen.getByText('next effect')).toBeInTheDocument();
  });
});
