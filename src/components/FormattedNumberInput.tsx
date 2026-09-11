import { useState } from 'react';
import type { ChangeEvent, FC } from 'react';

interface FormattedNumberInputProps {
  value: number | string | null | undefined;
  /** 콤마를 뺀 순수 숫자 문자열을 넘긴다 — 기존 `type="number"` 입력의 onChange 바디에서
   * `e.target.value`를 읽던 자리에 이 값을 그대로 쓰면 된다. */
  onChange: (rawValue: string) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  autoFocus?: boolean;
}

const stripCommas = (value: string) => value.replace(/,/g, '');

const formatWithCommas = (raw: string): string => {
  if (raw === '' || raw === '-') return raw;
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart, ...decimalParts] = unsigned.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalSuffix = decimalParts.length > 0 ? '.' + decimalParts.join('.') : '';
  return (negative ? '-' : '') + formattedInt + decimalSuffix;
};

const toDisplayText = (value: number | string | null | undefined) =>
  formatWithCommas(value === null || value === undefined || value === '' ? '' : String(value));

/**
 * 금액/수량 입력창에 천단위 콤마(,)를 보여주는 숫자 입력 — 사용자 요청(2026-09-11). 네이티브
 * `<input type="number">`는 콤마 섞인 값을 거부해 콤마를 표시할 수 없다 — 대신
 * `type="text"`+`inputMode="decimal"`로 화면 표시만 콤마 포맷하고, `onChange`엔 콤마를 뺀
 * 순수 숫자 문자열을 그대로 넘긴다. `min`/`max`/`step`은 `type="text"`에서는 브라우저가
 * 강제하지 않는 장식용 속성이다 — 실제 값 검증은 호출부의 `onChange`/상태 로직이 담당한다
 * (기존 `type="number"` 입력들도 대부분 이미 그렇게 하고 있었다).
 */
export const FormattedNumberInput: FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  onBlur,
  min,
  max,
  step,
  disabled,
  placeholder,
  className,
  id,
  name,
  autoFocus,
}) => {
  const [text, setText] = useState(() => toDisplayText(value));
  // 렌더링 중 prop 변화에 맞춰 상태를 조정하는 React 권장 패턴(useEffect 대신) — 외부에서
  // 값이 바뀌면(예: 다른 곳에서 초기화, 비동기 로드 완료) 표시 텍스트도 그때 맞춘다.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(toDisplayText(value));
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = stripCommas(e.target.value);
    if (raw !== '' && raw !== '-' && !/^-?\d*\.?\d*$/.test(raw)) {
      return; // 숫자·부호·소수점 외 문자는 무시(붙여넣기로 섞여 들어와도 반영하지 않는다)
    }
    setText(formatWithCommas(raw));
    onChange(raw);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={onBlur}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      id={id}
      name={name}
      autoFocus={autoFocus}
    />
  );
};
