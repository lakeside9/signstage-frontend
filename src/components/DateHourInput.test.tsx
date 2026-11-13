import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateHourInput } from './DateHourInput';

describe('DateHourInput', () => {
  it('날짜와 시만 보여주고, 시를 바꾸면 분은 00으로 합친다', () => {
    const onChange = vi.fn();
    render(<DateHourInput value="2026-11-15T18:00" onChange={onChange} className="" />);

    expect(screen.getByDisplayValue('2026-11-15')).toBeInTheDocument();
    expect(screen.getByLabelText('시')).toHaveValue('18');

    fireEvent.change(screen.getByLabelText('시'), { target: { value: '09' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-11-15T09:00');
  });

  it('날짜를 바꾸면 고른 시를 유지하고, 날짜를 지우면 값을 비운다', () => {
    const onChange = vi.fn();
    render(<DateHourInput value="2026-11-15T09:00" onChange={onChange} className="" />);

    fireEvent.change(screen.getByDisplayValue('2026-11-15'), { target: { value: '2026-11-20' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-11-20T09:00');

    fireEvent.change(screen.getByDisplayValue('2026-11-15'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('날짜가 없으면 시를 고를 수 없다', () => {
    render(<DateHourInput value="" onChange={vi.fn()} className="" />);

    expect(screen.getByLabelText('시')).toBeDisabled();
  });
});
