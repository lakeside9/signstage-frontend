import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CeremonyEventEffectSelectionFields } from './CeremonyEventEffectSelectionFields';
import { api } from '../../../utils/api';
import type { CeremonyEffectDefinition, CeremonyEffectSelection, OptionalFeatureSummary } from '../../../types';

vi.mock('../../../utils/api', () => ({ api: { get: vi.fn() } }));

const feature = (id: number, code: OptionalFeatureSummary['code']): OptionalFeatureSummary => ({
  id,
  code,
  name: code,
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

const definition = (id: number, code: string, triggerType: CeremonyEffectDefinition['triggerType']): CeremonyEffectDefinition => ({
  id,
  code,
  targetType: 'PROJECTOR',
  triggerType,
  requiredOptionalFeatureId: triggerType === 'SIGNATURE_COMPLETED' ? 1 : 2,
  displayName: `${code} 표시명`,
  description: null,
  rendererKey: `renderer-${code}`,
  enabled: true,
  userVisible: true,
  manuallyTriggerable: triggerType === 'ALL_SIGNATURES_COMPLETED',
  displayOrder: 10,
  configJson: null,
  createdAt: '2026-09-07T00:00:00',
});

const zoomFeature = feature(1, 'SIGNER_FIELD_ZOOM');
const fireworksFeature = feature(2, 'ALL_SIGNED_FIREWORKS');
const availableFeatures = [zoomFeature, fireworksFeature];

const definitions = [
  definition(101, 'HIGHLIGHT', 'SIGNATURE_COMPLETED'), // registry에 있음
  definition(102, 'UNKNOWN_SIGNATURE_EFFECT', 'SIGNATURE_COMPLETED'), // registry에 없음 — 교집합에서 제외돼야 함
  definition(201, 'FIREWORKS', 'ALL_SIGNATURES_COMPLETED'),
];

const apiGetMock = vi.mocked(api.get);

/**
 * FE-EVENT-01 — signstage-docs business/ceremony-event-effect-implementation-tasks.md.
 * 등록/수정 화면에 이식한 개별/전체 완료 효과 선택 UI 검증.
 */
describe('CeremonyEventEffectSelectionFields', () => {
  it('선택한 선택옵션이 없으면 아무 그룹도 노출하지 않는다', async () => {
    apiGetMock.mockResolvedValue({ data: definitions });
    const onChange = vi.fn();
    render(
      <CeremonyEventEffectSelectionFields
        availableFeatures={availableFeatures}
        selectedFeatureIds={[]}
        value={[]}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/ceremony-effects'));
    expect(screen.queryByText(/효과$/)).not.toBeInTheDocument();
  });

  it('선택한 옵션이 제공하는 분류만 노출하고, Registry와 교집합인 정의만 옵션으로 보여준다', async () => {
    apiGetMock.mockResolvedValue({ data: definitions });
    render(
      <CeremonyEventEffectSelectionFields
        availableFeatures={availableFeatures}
        selectedFeatureIds={[zoomFeature.id]}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText('개별 서명 확인 효과')).toBeInTheDocument();
    expect(screen.queryByText('전체 서명 완료 효과')).not.toBeInTheDocument(); // ALL_SIGNED_FIREWORKS 미선택

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'HIGHLIGHT 표시명' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: 'UNKNOWN_SIGNATURE_EFFECT 표시명' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '사용 안 함' })).toBeInTheDocument();
  });

  it('server catalog와 Registry 교집합이 비면 "사용 안 함"만 노출한다', async () => {
    apiGetMock.mockResolvedValue({ data: [definition(102, 'UNKNOWN_SIGNATURE_EFFECT', 'SIGNATURE_COMPLETED')] });
    render(
      <CeremonyEventEffectSelectionFields
        availableFeatures={availableFeatures}
        selectedFeatureIds={[zoomFeature.id]}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    await screen.findByText('개별 서명 확인 효과');
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('사용 안 함');
    });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('효과를 고르면 onChange가 해당 분류의 CeremonyEffectSelection을 담아 호출된다', async () => {
    apiGetMock.mockResolvedValue({ data: definitions });
    const onChange = vi.fn();
    render(
      <CeremonyEventEffectSelectionFields
        availableFeatures={availableFeatures}
        selectedFeatureIds={[zoomFeature.id]}
        value={[]}
        onChange={onChange}
      />,
    );

    const select = await screen.findByRole('combobox');
    await act(async () => {
      (select as HTMLSelectElement).value = '101';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith([
      { targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', effectId: 101 },
    ]);
  });

  it('옵션을 해제하면(selectedFeatureIds에서 빠지면) 종속 프리셋 선택도 즉시 해제한다', async () => {
    apiGetMock.mockResolvedValue({ data: definitions });
    const onChange = vi.fn();
    const initialValue: CeremonyEffectSelection[] = [
      { targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', effectId: 101 },
    ];
    const { rerender } = render(
      <CeremonyEventEffectSelectionFields
        availableFeatures={availableFeatures}
        selectedFeatureIds={[zoomFeature.id]}
        value={initialValue}
        onChange={onChange}
      />,
    );
    await screen.findByText('개별 서명 확인 효과');

    rerender(
      <CeremonyEventEffectSelectionFields
        availableFeatures={availableFeatures}
        selectedFeatureIds={[]}
        value={initialValue}
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([]));
  });
});
