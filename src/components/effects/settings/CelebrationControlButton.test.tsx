import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CelebrationControlButton } from './CelebrationControlButton';
import { api } from '../../../utils/api';
import type { CeremonyEventEffectSetting } from '../../../types';

vi.mock('../../../utils/api', () => ({ api: { post: vi.fn() } }));

const apiPostMock = vi.mocked(api.post);

const setting = (overrides: Partial<CeremonyEventEffectSetting> = {}): CeremonyEventEffectSetting => ({
  targetType: 'PROJECTOR',
  triggerType: 'ALL_SIGNATURES_COMPLETED',
  effectCode: 'FIREWORKS',
  rendererKey: 'projector-fireworks',
  displayName: '축하 불꽃놀이',
  runtimeEnabled: true,
  manuallyTriggerable: true,
  ...overrides,
});

/** FE-EVENT-03 — signstage-docs business/ceremony-event-effect-implementation-tasks.md. */
describe('CelebrationControlButton', () => {
  it('runtime OFF면 렌더링하지 않는다', () => {
    const { container } = render(
      <CelebrationControlButton apiBasePath="/organizations/1/ceremonies/2/events/3" setting={setting({ runtimeEnabled: false })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('수동 실행 불가능한 효과면 렌더링하지 않는다', () => {
    const { container } = render(
      <CelebrationControlButton apiBasePath="/organizations/1/ceremonies/2/events/3" setting={setting({ manuallyTriggerable: false })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('확인 dialog 후에만 서버 API(targetType/triggerType)를 호출하고, 관리자 화면 자체에서 효과를 재생하지 않는다', async () => {
    apiPostMock.mockResolvedValue({ data: null });
    render(<CelebrationControlButton apiBasePath="/organizations/1/ceremonies/2/events/3" setting={setting()} />);

    fireEvent.click(screen.getByRole('button', { name: /축하 불꽃놀이 실행/ }));
    // 확인 전에는 아직 호출되지 않는다.
    expect(apiPostMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '실행' }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith(
      '/organizations/1/ceremonies/2/events/3/effects/trigger',
      { targetType: 'PROJECTOR', triggerType: 'ALL_SIGNATURES_COMPLETED' },
    ));
    // 이 화면은 재생 명령만 보낼 뿐, canvas/DOM 효과 렌더러를 직접 마운트하지 않는다.
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('요청 중 버튼을 잠근다', async () => {
    let resolvePost: (() => void) | undefined;
    apiPostMock.mockReturnValue(new Promise((resolve) => {
      resolvePost = () => resolve({ data: null });
    }));
    render(<CelebrationControlButton apiBasePath="/organizations/1/ceremonies/2/events/3" setting={setting()} />);

    fireEvent.click(screen.getByRole('button', { name: /축하 불꽃놀이 실행/ }));
    fireEvent.click(screen.getByRole('button', { name: '실행' }));

    expect(screen.getByRole('button', { name: /축하 불꽃놀이 실행/ })).toBeDisabled();
    resolvePost?.();
    await waitFor(() => expect(screen.getByRole('button', { name: /축하 불꽃놀이 실행/ })).not.toBeDisabled());
  });
});
