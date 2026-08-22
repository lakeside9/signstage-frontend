import { useState } from 'react';
import type { ChangeEvent, FC } from 'react';

/**
 * 07:00~23:00 30분 단위 시각 목록("07:00", "07:30", ..., "23:00", 33개). 하위 행사
 * 예정 시작/종료 시각 선택에 쓴다 — 현장 운영 시간대 밖의 값(새벽 시간 등)을 애초에
 * 고를 수 없게 한다(사용자 요청, 2026-08-22).
 */
const EVENT_TIME_OPTIONS: string[] = Array.from({ length: 33 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

/** 날짜만 고르고 시각을 아직 안 골랐을 때 자동으로 채우는 기본 시각(사용자 요청, 2026-08-22). */
const DEFAULT_TIME = '10:00';

interface EventDateTimeInputProps {
  /** "YYYY-MM-DDTHH:mm" 형식(비어있으면 미정). `toDateTimeLocalValue`가 만드는 값과 같은 모양이다. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** 모달처럼 좁은 자리에서는 true로 둬 컴팩트한 padding을 쓴다. 기본은 전용 페이지 크기. */
  dense?: boolean;
}

/**
 * 하위 행사(CeremonyEvent) 예정 시작/종료 입력. 날짜는 달력(`<input type="date">`)으로,
 * 시각은 07:00~23:00 30분 단위 드롭다운(`EVENT_TIME_OPTIONS`)으로 따로 받아 하나의
 * "YYYY-MM-DDTHH:mm" 문자열로 합친다 — 브라우저 기본 `datetime-local`이 임의 시각을 다
 * 허용하던 것을 현장 운영 시간대로 제한한다.
 *
 * 날짜와 시각을 각각 로컬 state로 들고 있다가 **둘 다 채워졌을 때만** 부모에 합쳐서
 * 올려보낸다 — "날짜만 고르고 시각은 아직" 같은 중간 상태를 부모의 `value`(완전한
 * 문자열 아니면 빈 문자열)로 표현할 수 없어서다. `value`만 보고 매번 다시 계산하면
 * 날짜를 고른 시점엔 시각이 비어 있어 합친 값이 빈 문자열이 되고, 그 빈 값이 그대로
 * `value`로 돌아와 방금 고른 날짜가 사라져 보이는 결함이 있었다(2026-08-22 수정).
 * 날짜만 고르고 시각을 아직 안 골랐으면 `DEFAULT_TIME`(10:00)을 자동으로 채운다 —
 * 그래야 날짜 하나만 골라도 바로 완전한 값이 되고, 필요하면 드롭다운으로 시각만
 * 바꾸면 된다(사용자 요청, 2026-08-22).
 *
 * 초기값만 `value`에서 읽고 이후엔 동기화하지 않는다 — 두 사용처(등록 폼, 수정 모달)
 * 모두 이 컴포넌트가 마운트된 채로 `value`가 바깥에서 바뀌는 경우가 없다(수정 모달은
 * `Modal`이 닫힐 때 자식을 아예 언마운트하므로, 다른 행사를 수정할 땐 항상 새로
 * 마운트되며 그 시점의 `value`를 초기값으로 받는다).
 */
export const EventDateTimeInput: FC<EventDateTimeInputProps> = ({ value, onChange, disabled = false, dense = false }) => {
  const [datePart, setDatePart] = useState(() => (value ? value.slice(0, 10) : ''));
  const [timePart, setTimePart] = useState(() => (value ? value.slice(11, 16) : ''));

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextDate = e.target.value;
    setDatePart(nextDate);
    if (!nextDate) {
      // 날짜를 지우면 시각 선택도 의미가 없어지므로 함께 지운다.
      setTimePart('');
      onChange('');
      return;
    }
    // 시각을 아직 안 골랐으면 기본 시각(10:00)을 채워 바로 완전한 값으로 만든다.
    const nextTime = timePart || DEFAULT_TIME;
    setTimePart(nextTime);
    onChange(`${nextDate}T${nextTime}`);
  };

  const handleTimeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextTime = e.target.value;
    setTimePart(nextTime);
    if (datePart && nextTime) {
      onChange(`${datePart}T${nextTime}`);
    }
  };

  const inputClass = dense
    ? 'px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100'
    : 'px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50';

  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="date"
        value={datePart}
        onChange={handleDateChange}
        disabled={disabled}
        className={`flex-1 min-w-[140px] ${inputClass}`}
      />
      <select
        value={timePart}
        onChange={handleTimeChange}
        disabled={disabled || !datePart}
        className={`w-24 shrink-0 ${inputClass}`}
      >
        <option value="">시간</option>
        {EVENT_TIME_OPTIONS.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
    </div>
  );
};
