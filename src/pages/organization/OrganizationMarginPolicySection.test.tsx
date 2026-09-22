import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationMarginPolicySection } from './OrganizationMarginPolicySection';
import { api } from '../../utils/api';

const mocks = vi.hoisted(() => ({ showSnackbar: vi.fn(), allowed: true }));
vi.mock('../../utils/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../store/usePermissionStore', () => ({ usePermissionStore: (selector: (s: unknown) => unknown) =>
  selector({ hasPermission: () => mocks.allowed }) }));
vi.mock('../../store/useSnackbarStore', () => ({ useSnackbarStore: (selector: (s: unknown) => unknown) =>
  selector({ showSnackbar: mocks.showSnackbar }) }));

const policy = { id: 7, marginType: 'PERCENT', marginValue: 10, effectiveFrom: '2026-09-01',
  effectiveTo: '2026-09-30', status: 'ACTIVE', currencyCode: 'KRW', timeZoneId: 'Asia/Seoul' };

function fillDates(from: string, to: string) {
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: from } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: to } });
}

describe('기간별 재판매 마진', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowed = true;
    vi.mocked(api.get).mockResolvedValue({ data: [policy] });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.put).mockResolvedValue({ data: {} });
  });
  afterEach(cleanup);

  it('파트너 자신의 기간별 목록과 상태를 표시한다', async () => {
    render(<OrganizationMarginPolicySection organizationId="1" />);
    expect(await screen.findByText('2026-09-30')).toBeInTheDocument();
    expect(screen.getByText('적용 중')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/organizations/1/margin-policy/periods');
  });

  it('0% 정책을 기간과 함께 추가한다', async () => {
    render(<OrganizationMarginPolicySection organizationId="1" />);
    await screen.findByText('10%');
    fireEvent.click(screen.getByRole('button', { name: '기간 추가' }));
    fillDates('2026-10-01', '2026-10-31');
    fireEvent.change(screen.getByLabelText('마진 값'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/organizations/1/margin-policy/periods', {
      marginType: 'PERCENT', marginValue: 0, effectiveFrom: '2026-10-01', effectiveTo: '2026-10-31',
    }));
    await screen.findByText('10%');
  });

  it('종료일과 시작일이 같은 중복 기간은 저장하지 않는다', async () => {
    render(<OrganizationMarginPolicySection organizationId="1" />);
    await screen.findByText('10%');
    fireEvent.click(screen.getByRole('button', { name: '기간 추가' }));
    fillDates('2026-09-30', '2026-10-31');
    fireEvent.change(screen.getByLabelText('마진 값'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(api.post).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).toHaveBeenCalledWith(expect.stringContaining('기간이 겹칩니다'), 'error');
  });

  it('종료일 없는 기존 정책을 종료일 있는 정책으로 수정한다', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ ...policy, effectiveTo: null }] });
    render(<OrganizationMarginPolicySection organizationId="1" />);
    await screen.findByText('종료일 없음 (기존 정책)');
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    fillDates('2026-09-01', '2026-09-30');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/organizations/1/margin-policy/periods/7', {
      marginType: 'PERCENT', marginValue: 10, effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30',
    }));
    await screen.findByText('10%');
  });

  it('권한이 없으면 조회하거나 표시하지 않는다', () => {
    mocks.allowed = false;
    const { container } = render(<OrganizationMarginPolicySection organizationId="1" />);
    expect(container).toBeEmptyDOMElement();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('종료일을 생략하여 저장하고 서버가 반환한 최대 날짜를 표시한다', async () => {
    render(<OrganizationMarginPolicySection organizationId="1" />);
    await screen.findByText('10%');
    fireEvent.click(screen.getByRole('button', { name: '기간 추가' }));
    fillDates('2026-10-01', '');
    expect(screen.getByLabelText('종료일')).not.toBeRequired();
    expect(screen.getByLabelText('종료일')).toHaveAttribute('max', '9999-12-31');
    fireEvent.change(screen.getByLabelText('마진 값'), { target: { value: '0' } });
    vi.mocked(api.get).mockResolvedValue({ data: [policy, { ...policy, id: 8, effectiveFrom: '2026-10-01', effectiveTo: '9999-12-31' }] });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/organizations/1/margin-policy/periods', {
      marginType: 'PERCENT', marginValue: 0, effectiveFrom: '2026-10-01', effectiveTo: null,
    }));
    expect(await screen.findByText('9999-12-31')).toBeInTheDocument();
  });

  it('조회 실패를 빈 정책 목록으로 표시하지 않는다', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('조회 실패'));
    render(<OrganizationMarginPolicySection organizationId="1" />);
    await screen.findByRole('button', { name: '목록 다시 불러오기' });
    expect(screen.getByRole('button', { name: '기간 추가' })).toBeDisabled();
    expect(screen.queryByText('등록된 마진 정책이 없습니다.')).not.toBeInTheDocument();
  });

  it('겹치지 않는 과거 기간과 중간 공백에도 추가할 수 없다', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [policy,
      { ...policy, id: 8, effectiveFrom: '2026-11-01', effectiveTo: '2026-11-30' }] });
    render(<OrganizationMarginPolicySection organizationId="1" />);
    await screen.findByText('2026-11-30');
    expect(screen.getByText(/과거 기간이나 중간 공백에 추가할 수 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '기간 추가' }));
    fireEvent.change(screen.getByLabelText('마진 값'), { target: { value: '0' } });
    for (const month of ['08', '10']) {
      fillDates(`2026-${month}-01`, `2026-${month}-31`);
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      expect(mocks.showSnackbar).toHaveBeenLastCalledWith(
        '새 시작일은 기존 정책의 가장 늦은 종료일(2026-11-30)보다 뒤여야 합니다.', 'error');
    }
    expect(api.post).not.toHaveBeenCalled();
  });

  it('최대 종료일 정책은 먼저 수정하도록 안내한다', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ ...policy, effectiveTo: '9999-12-31' }] });
    render(<OrganizationMarginPolicySection organizationId="1" />);
    expect(await screen.findByText('새 기간을 추가하려면 기존 정책의 종료일(9999-12-31)을 먼저 수정해주세요.')).toBeInTheDocument();
  });
});
