import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventEffectRuntimeControls } from './EventEffectRuntimeControls';
import { api } from '../../../utils/api';
import type { CeremonyEventEffectSetting } from '../../../types';

vi.mock('../../../utils/api', () => ({ api: { put: vi.fn(), post: vi.fn() } }));

const apiPutMock = vi.mocked(api.put);

const setting = (overrides: Partial<CeremonyEventEffectSetting> = {}): CeremonyEventEffectSetting => ({
  targetType: 'PROJECTOR',
  triggerType: 'SIGNATURE_COMPLETED',
  effectCode: 'HIGHLIGHT',
  rendererKey: 'projector-signature-highlight',
  displayName: '서명란 강조',
  runtimeEnabled: true,
  manuallyTriggerable: false,
  ...overrides,
});

/** FE-EVENT-02 — signstage-docs business/ceremony-event-effect-implementation-tasks.md. */
describe('EventEffectRuntimeControls', () => {
  it('선택된 효과명과 trigger별 ON/OFF 상태를 표시하고, 선택 안 한 분류는 명확히 그렇게 표시한다', () => {
    render(
      <EventEffectRuntimeControls
        apiBasePath="/organizations/1/ceremonies/2/events/3"
        settings={[setting()]}
        onSettingsChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /서명란: 서명란 강조 ON/ })).toBeInTheDocument();
    expect(screen.getByText('전체 완료: 선택 안 함')).toBeInTheDocument();
  });

  it('토글하면 낙관적으로 즉시 바뀌고, PUT 요청 본문이 targetType/triggerType/runtimeEnabled를 담는다', async () => {
    apiPutMock.mockResolvedValue({ data: null });
    const onSettingsChange = vi.fn();
    render(
      <EventEffectRuntimeControls
        apiBasePath="/organizations/1/ceremonies/2/events/3"
        settings={[setting({ runtimeEnabled: true })]}
        onSettingsChange={onSettingsChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /서명란: 서명란 강조 ON/ }));

    expect(onSettingsChange).toHaveBeenCalledWith([expect.objectContaining({ runtimeEnabled: false })]);
    await waitFor(() => expect(apiPutMock).toHaveBeenCalledWith(
      '/organizations/1/ceremonies/2/events/3/effects/runtime',
      { targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', runtimeEnabled: false },
    ));
  });

  it('요청이 실패하면 낙관적으로 바꿨던 상태를 되돌린다', async () => {
    apiPutMock.mockRejectedValue(new Error('네트워크 오류'));
    const onSettingsChange = vi.fn();
    render(
      <EventEffectRuntimeControls
        apiBasePath="/organizations/1/ceremonies/2/events/3"
        settings={[setting({ runtimeEnabled: true })]}
        onSettingsChange={onSettingsChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /서명란: 서명란 강조 ON/ }));

    await waitFor(() => expect(onSettingsChange).toHaveBeenLastCalledWith(
      [expect.objectContaining({ runtimeEnabled: true })],
    ));
  });

  it('요청 중에는 같은 버튼 재클릭을 막는다(중복 클릭 방지)', async () => {
    let resolvePut: (() => void) | undefined;
    apiPutMock.mockReturnValue(new Promise((resolve) => {
      resolvePut = () => resolve({ data: null });
    }));
    render(
      <EventEffectRuntimeControls
        apiBasePath="/organizations/1/ceremonies/2/events/3"
        settings={[setting({ runtimeEnabled: true })]}
        onSettingsChange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /서명란: 서명란 강조 ON/ });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button); // 잠긴 동안 재클릭 — 무시돼야 한다

    resolvePut?.();
    await waitFor(() => expect(apiPutMock).toHaveBeenCalledTimes(1));
  });
});
