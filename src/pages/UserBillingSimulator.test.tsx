import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBillingSimulator } from './UserBillingSimulator';
import { api } from '../utils/api';

vi.mock('../utils/api', () => ({ api: { get: vi.fn() } }));
vi.mock('../utils/internationalization', () => ({ formatCurrency: (value: number) => String(value) }));

const product = { id: 10, name: '서명자', type: 'SIGNERS', includedQuantity: 10,
  salePrice: 1000, saleUnitQuantity: 5, maxPurchaseQuantity: 10 };
const plan = { id: 1, name: '기본 플랜', subscription: false, subtotal: 10000,
  appliedPrice: 9000, partnerDiscount: true, products: [product] };

describe('판매사 과금 시뮬레이터', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValueOnce({ data: [{ id: 3 }] })
      .mockResolvedValueOnce({ data: { organizationName: '판매사', currencyCode: 'KRW',
        asOfDate: '2026-09-22', plans: [plan, { ...plan, id: 2, name: '다른 플랜' }],
        additionalProducts: [product, { ...product, id: 20, name: '플랜 외 상품', includedQuantity: 0 }] } });
  });
  afterEach(cleanup);

  it('판매 단위·한도를 적용하고 플랜 변경 시 추가 수량을 초기화한다', async () => {
    const { container } = render(<UserBillingSimulator />);
    await screen.findByText('판매사 전용 플랜 할인이 적용되었습니다.');
    const input = screen.getByRole('spinbutton', { name: '서명자 추가 구매 단위' });
    fireEvent.change(input, { target: { value: '1' } });
    expect(screen.getByRole('heading', { name: '추가 구매' })).toBeInTheDocument();
    expect(screen.getAllByText('1개당 1000')).toHaveLength(2);
    expect(screen.queryByText(/기본 포함 10개/)).not.toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('14000');
    fireEvent.change(input, { target: { value: '99' } });
    expect(input).toHaveValue(2);
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('19000');
    fireEvent.change(screen.getByLabelText('과금 플랜'), { target: { value: '2' } });
    expect(input).toHaveValue(null);
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('9000');
    expect(api.get).toHaveBeenCalledWith('/organizations/3/billing-simulator');
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/내부 마진|재량 할인/)).not.toBeInTheDocument();
  });

  it('조회 실패 시 금액을 표시하지 않는다', async () => {
    vi.mocked(api.get).mockReset().mockRejectedValue(new Error('조회 권한이 없습니다.'));
    render(<UserBillingSimulator />);
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 권한이 없습니다.');
    expect(screen.queryByText('예상 플랫폼 이용료')).not.toBeInTheDocument();
  });

  it('수량의 선행 0을 제거하고 빈 입력은 0으로 계산한다', async () => {
    const { container } = render(<UserBillingSimulator />);
    const input = await screen.findByRole('spinbutton', { name: '서명자 추가 구매 단위' });
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute('placeholder', '0');
    fireEvent.change(input, { target: { value: '01' } });
    expect((input as HTMLInputElement).value).toBe('1');
    fireEvent.change(input, { target: { value: '001' } });
    expect((input as HTMLInputElement).value).toBe('1');
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('14000');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('9000');
  });

  it('플랜에 없는 플랫폼 이용료 상품도 추가하고 플랜 상세에는 포함시키지 않는다', async () => {
    const { container } = render(<UserBillingSimulator />);
    const input = await screen.findByRole('spinbutton', { name: '플랜 외 상품 추가 구매 단위' });
    fireEvent.change(input, { target: { value: '1' } });
    expect(input).toHaveValue(1);
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('14000');
    expect(screen.getByRole('region', { name: '선택한 플랜 상세' })).not.toHaveTextContent('플랜 외 상품');
  });
});
