type Props = {
  location: string;
  startsAt: string;
  endsAt: string;
  onLocationChange: (value: string) => void;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
  disabled?: boolean;
  timeZoneId?: string;
  required?: boolean;
};

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

const timeOptions = Array.from({ length: 48 }, (_, index) =>
  `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`,
);

function DateTimeField({ id, label, value, onChange, required }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">{label}{required && ' (필수)'}</label>
      <div className="grid grid-cols-2 gap-2">
        <input id={id} type="date" value={date} required={required} className={inputClass}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}T${time || '00:00'}` : '')} />
        <select aria-label={`${label} 시간`} value={time || '00:00'} disabled={!date} required={required}
          className={inputClass} onChange={(e) => onChange(`${date}T${e.target.value}`)}>
          {time && !timeOptions.includes(time) && <option value={time}>{time} (기존 값)</option>}
          {timeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    </div>
  );
}

export function CeremonyScheduleFields({
  location, startsAt, endsAt, onLocationChange, onStartsAtChange, onEndsAtChange,
  disabled, timeZoneId, required = false,
}: Props) {
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <div>
        <label htmlFor="ceremony-location" className="block text-xs font-medium text-gray-500 mb-1">행사장소{required && ' (필수)'}</label>
        <input id="ceremony-location" type="text" value={location} maxLength={500} required={required}
          onChange={(e) => onLocationChange(e.target.value)} placeholder={required ? '행사장소를 입력해주세요' : '선택 입력'} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DateTimeField id="ceremony-starts-at" label="행사 시작일시" value={startsAt} onChange={onStartsAtChange} required={required} />
        <DateTimeField id="ceremony-ends-at" label="행사 종료일시" value={endsAt} onChange={onEndsAtChange} required={required} />
      </div>
      <p className="text-xs text-gray-400">
        장소와 일시는 {required ? '필수' : '선택'} 입력입니다. 날짜를 입력한 뒤 시간을 30분 단위로 선택해주세요.
        {' '}{timeZoneId ? `행사 시간대(${timeZoneId})` : '조직의 기본 시간대'} 기준입니다.
      </p>
    </fieldset>
  );
}
