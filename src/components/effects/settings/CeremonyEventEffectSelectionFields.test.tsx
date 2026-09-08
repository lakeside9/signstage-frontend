import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CeremonyEventEffectSelectionFields } from './CeremonyEventEffectSelectionFields';
import { api } from '../../../utils/api';
import type { CeremonyEffectDefinition, CeremonyEffectSelection } from '../../../types';

vi.mock('../../../utils/api', () => ({ api: { get: vi.fn() } }));

/** ZOOM_BUNDLE_ID(1)은 SIGNATURE_COMPLETED 효과를, FIREWORKS_BUNDLE_ID(2)는 ALL_SIGNATURES_COMPLETED 효과를 연다. */
const ZOOM_BUNDLE_ID = 1;
const FIREWORKS_BUNDLE_ID = 2;

const definition = (
  id: number, code: string, triggerType: CeremonyEffectDefinition['triggerType'], optionalFeatureIds: number[],
): CeremonyEffectDefinition => ({
  id,
  code,
  targetType: 'PROJECTOR',
  triggerType,
  optionalFeatureIds,
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

const definitions = [
  definition(101, 'HIGHLIGHT', 'SIGNATURE_COMPLETED', [ZOOM_BUNDLE_ID]), // registry에 있음
  definition(102, 'UNKNOWN_SIGNATURE_EFFECT', 'SIGNATURE_COMPLETED', [ZOOM_BUNDLE_ID]), // registry에 없음 — 교집합에서 제외돼야 함
  definition(201, 'FIREWORKS', 'ALL_SIGNATURES_COMPLETED', [FIREWORKS_BUNDLE_ID]),
];

const apiGetMock = vi.mocked(api.get);

/**
 * FE-EVENT-01 — signstage-docs business/ceremony-event-effect-implementation-tasks.md.
 * 등록/수정 화면에 이식한 개별/전체 완료 효과 선택 UI 검증. 2026-09-08 재설계 이후로는
 * `OptionalFeatureCode` 고정값이 아니라 각 정의의 `optionalFeatureIds`와 `selectedFeatureIds`의
 * 교집합 유무로 노출/entitlement를 판단한다(효과 묶음이 관리자가 계속 추가하는 상품이라서).
 */
describe('CeremonyEventEffectSelectionFields', () => {
  it('선택한 선택옵션이 없으면 아무 그룹도 노출하지 않는다', async () => {
    apiGetMock.mockResolvedValue({ data: definitions });
    const onChange = vi.fn();
    render(
      <CeremonyEventEffectSelectionFields
        selectedFeatureIds={[]}
        value={[]}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/ceremony-effects'));
    expect(screen.queryByText(/효과$/)).not.toBeInTheDocument();
  });

  it('선택한 옵션이 여는 분류만 노출하고, Registry와 교집합인 정의만 옵션으로 보여준다', async () => {
    apiGetMock.mockResolvedValue({ data: definitions });
    render(
      <CeremonyEventEffectSelectionFields
        selectedFeatureIds={[ZOOM_BUNDLE_ID]}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText('개별 서명 확인 효과')).toBeInTheDocument();
    expect(screen.queryByText('전체 서명 완료 효과')).not.toBeInTheDocument(); // FIREWORKS_BUNDLE_ID 미선택

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'HIGHLIGHT 표시명' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: 'UNKNOWN_SIGNATURE_EFFECT 표시명' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '사용 안 함' })).toBeInTheDocument();
  });

  it('한 효과가 여러 묶음에 겹쳐 있어도, 그중 하나만 적용돼 있으면 노출된다(합집합 판정)', async () => {
    const overlapping = [definition(101, 'HIGHLIGHT', 'SIGNATURE_COMPLETED', [ZOOM_BUNDLE_ID, 99])];
    apiGetMock.mockResolvedValue({ data: overlapping });
    render(
      <CeremonyEventEffectSelectionFields
        selectedFeatureIds={[99]}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText('개별 서명 확인 효과')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'HIGHLIGHT 표시명' })).toBeInTheDocument();
    });
  });

  it('server catalog와 Registry 교집합이 비면 "사용 안 함"만 노출한다', async () => {
    apiGetMock.mockResolvedValue({ data: [definition(102, 'UNKNOWN_SIGNATURE_EFFECT', 'SIGNATURE_COMPLETED', [ZOOM_BUNDLE_ID])] });
    render(
      <CeremonyEventEffectSelectionFields
        selectedFeatureIds={[ZOOM_BUNDLE_ID]}
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
        selectedFeatureIds={[ZOOM_BUNDLE_ID]}
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
        selectedFeatureIds={[ZOOM_BUNDLE_ID]}
        value={initialValue}
        onChange={onChange}
      />,
    );
    await screen.findByText('개별 서명 확인 효과');

    rerender(
      <CeremonyEventEffectSelectionFields
        selectedFeatureIds={[]}
        value={initialValue}
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([]));
  });
});
