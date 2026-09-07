import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProjectorEffectPageFrame, TemplateFieldSummary } from '../../../types';
import { SignatureHighlightEffect } from './SignatureHighlightEffect';

const frame: ProjectorEffectPageFrame = { pageIndex: 0, x: 10, y: 20, width: 1000, height: 500 };

const field = (id: number, signerId: number, overrides: Partial<TemplateFieldSummary> = {}): TemplateFieldSummary => ({
  id,
  templateId: 1,
  signerId,
  fieldKey: `field-${id}`,
  pageIndex: 0,
  fieldIndex: id,
  fieldName: `서명 ${id}`,
  roleCode: null,
  signOrder: null,
  isRequired: true,
  xRatio: 0.1 * id,
  yRatio: 0.1,
  widthRatio: 0.2,
  heightRatio: 0.1,
  createdAt: '2026-09-07T00:00:00',
  ...overrides,
});

/**
 * FE-PROJECTOR-04 — "동일 signer의 여러 현재 표시 field가 모두 강조되는지 검증한다".
 * `SignatureHighlightEffect`는 `fields`를 `flatMap`으로 훑어 이 signerId가 배정된 필드를
 * 전부 박스로 만든다(find로 하나만 찾지 않는다) — 한 서명자가 같은 문서에 여러 서명란을
 * 가진 경우(예: 계약서 여러 곳에 서명) 전부 동시에 강조돼야 한다.
 */
describe('SignatureHighlightEffect', () => {
  it('highlights every field assigned to the signer, not just the first match', () => {
    render(
      <SignatureHighlightEffect
        requestId="signature-7-1"
        signerId={7}
        frames={[frame]}
        fields={[field(1, 7), field(2, 7), field(3, 99 /* 다른 서명자 — 강조 대상 아님 */)]}
      />,
    );

    expect(screen.getAllByTestId('projector-signature-highlight')).toHaveLength(2);
  });

  it('renders nothing when the signer has no field on any currently visible frame', () => {
    render(
      <SignatureHighlightEffect
        requestId="signature-7-1"
        signerId={7}
        frames={[{ ...frame, pageIndex: 5 }]} // 서명자의 필드는 pageIndex 0에 있음 — 지금 안 보이는 페이지
        fields={[field(1, 7)]}
      />,
    );

    expect(screen.queryByTestId('projector-signature-highlight')).not.toBeInTheDocument();
  });
});
