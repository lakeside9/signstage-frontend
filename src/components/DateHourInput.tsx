import type { FC } from 'react';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));

/** 날짜만 고르고 시를 아직 안 골랐을 때 채우는 시. */
const DEFAULT_HOUR = '18';

interface DateHourInputProps {
  /** "YYYY-MM-DDTHH:00" 형식(비어 있으면 미정). 분은 항상 00이다. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className: string;
}

/**
 * 날짜와 시(0~23시)만 받는 입력 — 분·초가 필요 없는 기한(파트너 발주 응답 기한 등)에 쓴다. 브라우저 기본
 * `datetime-local`은 분까지 고르게 해서, 날짜는 달력으로, 시는 드롭다운으로 따로 받아 "YYYY-MM-DDTHH:00"으로 합친다.
 * 시는 날짜를 고른 뒤에만 고를 수 있다(날짜 없이 시만 있는 값은 만들지 않는다).
 */
export const DateHourInput: FC<DateHourInputProps> = ({ value, onChange, disabled = false, className }) => {
  const datePart = value ? value.slice(0, 10) : '';
  const hourPart = value ? value.slice(11, 13) : '';

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <input
          type="date"
          value={datePart}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}T${hourPart || DEFAULT_HOUR}:00` : '')}
          disabled={disabled}
          className={className}
        />
      </div>
      <div className="w-24 shrink-0">
        <select
          value={hourPart}
          onChange={(e) => onChange(`${datePart}T${e.target.value}:00`)}
          disabled={disabled || !datePart}
          aria-label="시"
          className={`${className} bg-white`}
        >
          {!hourPart && <option value="">시</option>}
          {HOUR_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>{hour}시</option>
          ))}
        </select>
      </div>
    </div>
  );
};
