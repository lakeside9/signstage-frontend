import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CeremonyEffectDefinitionForm } from './CeremonyEffectDefinitionForm';
import type { CeremonyEffectFormValue } from './CeremonyEffectDefinitionForm';
import type { OptionalFeatureSummary } from '../../../types';

const feature = (id: number, name: string): OptionalFeatureSummary => ({
  id,
  code: 'SIGNER_FIELD_ZOOM',
  name,
  currencyCode: 'KRW',
  supplyPrice: 0,
  salePrice: 0,
  discountType: 'FIXED_AMOUNT',
  discountValue: 0,
  taxCode: 'TAX_FREE',
  active: true,
  projectorEffect: true,
  exclusivityGroup: null,
  usageCount: 0,
  createdAt: '2026-09-07T00:00:00',
});

const editValue: CeremonyEffectFormValue = {
  code: 'HIGHLIGHT',
  targetType: 'PROJECTOR',
  triggerType: 'SIGNATURE_COMPLETED',
  requiredOptionalFeatureId: 1,
  displayName: '서명란 강조',
  description: '',
  rendererKey: 'projector-signature-highlight',
  enabled: true,
  userVisible: true,
  manuallyTriggerable: false,
  configJsonDraft: '',
};

/** FE-ADMIN-02 — signstage-docs business/ceremony-event-effect-implementation-tasks.md. */
describe('CeremonyEffectDefinitionForm', () => {
  it('등록 모드에서는 코드/대상/실행시점/Renderer/필요옵션을 편집할 수 있다', () => {
    render(
      <CeremonyEffectDefinitionForm
        mode="create"
        optionalFeatures={[feature(1, 'SIGNER_FIELD_ZOOM')]}
        saving={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('예: SPARKLE')).toBeEnabled();
    expect(screen.getByPlaceholderText('예: projector-sparkle')).toBeEnabled();
  });

  it('수정 모드에서는 code/대상/실행시점/Renderer/필요옵션이 읽기 전용이다', () => {
    render(
      <CeremonyEffectDefinitionForm
        mode="edit"
        initialValue={editValue}
        optionalFeatures={[feature(1, '서명란 확대')]}
        saving={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('예: SPARKLE')).toBeDisabled();
    expect(screen.getByPlaceholderText('예: projector-sparkle')).toBeDisabled();
    expect(screen.getByDisplayValue('서명란 확대')).toBeDisabled(); // 필요 선택옵션 read-only input
  });

  it('효과 코드 형식이 잘못되면 제출을 막고 오류 메시지를 보여준다', () => {
    const onSubmit = vi.fn();
    render(
      <CeremonyEffectDefinitionForm
        mode="create"
        optionalFeatures={[feature(1, 'SIGNER_FIELD_ZOOM')]}
        saving={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('예: SPARKLE'), { target: { value: 'sparkle-1' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/영문 대문자, 숫자, 밑줄만/)).toBeInTheDocument();
  });

  it('설정 JSON 원문이 배열이면 제출을 막는다', () => {
    const onSubmit = vi.fn();
    render(
      <CeremonyEffectDefinitionForm
        mode="edit"
        initialValue={editValue}
        optionalFeatures={[feature(1, 'SIGNER_FIELD_ZOOM')]}
        saving={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('예: {"durationMs":1600}'), { target: { value: '[1,2,3]' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/올바른 객체 형식이어야/)).toBeInTheDocument();
  });

  it('유효한 값이면 onSubmit에 다듬어진 값을 담아 호출한다', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CeremonyEffectDefinitionForm
        mode="edit"
        initialValue={editValue}
        optionalFeatures={[feature(1, 'SIGNER_FIELD_ZOOM')]}
        saving={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      code: 'HIGHLIGHT',
      displayName: '서명란 강조',
      configJsonDraft: '',
    }));
  });
});
