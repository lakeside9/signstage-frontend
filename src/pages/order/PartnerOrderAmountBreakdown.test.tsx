import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PartnerOrderAmountBreakdown } from './components';

const amount = {
  currencyCode: 'KRW',
  baseFee: 300_000,
  tabletCount: 15,
  tabletUnitRate: 40_000,
  wifiCount: 0,
  wifiUnitRate: 0,
  onsiteStaffPersonDays: 0,
  onsiteStaffDayRate: 300_000,
  regionSurcharge: 0,
  adjustmentAmount: 0,
  totalAmount: 1_200_000,
  customItemAmount: 300_000,
};

describe('PartnerOrderAmountBreakdown', () => {
  it('직접 입력 항목 내역을 주면 품목별로 수량 × 발주 단가를 보여준다(발주 단가가 없는 품목도)', () => {
    render(
      <PartnerOrderAmountBreakdown
        {...amount}
        customItems={[
          { name: '태블릿 거치대 대여', quantity: 15, partnerUnitPrice: 20_000 },
          { name: '현수막', quantity: 1, partnerUnitPrice: null },
        ]}
      />,
    );

    expect(screen.getByText('직접 입력 · 태블릿 거치대 대여 15 × ₩20,000').parentElement).toHaveTextContent('₩300,000');
    expect(screen.getByText('직접 입력 · 현수막 1 × ₩0').parentElement).toHaveTextContent('₩0');
    expect(screen.queryByText('직접 입력 항목')).not.toBeInTheDocument();
  });

  it('내역이 없으면 합계 한 줄로 보여준다', () => {
    render(<PartnerOrderAmountBreakdown {...amount} />);

    expect(screen.getByText('직접 입력 항목')).toBeInTheDocument();
  });
});
