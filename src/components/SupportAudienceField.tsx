import type { FC } from 'react';
import { SUPPORT_AUDIENCE_DESCRIPTION, SUPPORT_AUDIENCE_LABEL, SUPPORT_AUDIENCES } from '../utils/supportAudience';
import type { SupportAudience } from '../types';

/** FAQ·공지사항 등록·수정 화면의 "노출 대상" 선택. */
export const SupportAudienceField: FC<{
  value: SupportAudience;
  onChange: (value: SupportAudience) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">노출 대상</label>
    <div className="flex gap-4">
      {SUPPORT_AUDIENCES.map((audience) => (
        <label key={audience} className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="radio"
            name="support-audience"
            checked={value === audience}
            onChange={() => onChange(audience)}
            disabled={disabled}
          />
          {SUPPORT_AUDIENCE_LABEL[audience]}
        </label>
      ))}
    </div>
    <p className="mt-1 text-xs text-gray-400">{SUPPORT_AUDIENCE_DESCRIPTION[value]}</p>
  </div>
);

/** FAQ·공지사항 관리 목록 위의 대상 탭. */
export const SupportAudienceTabs: FC<{
  value: SupportAudience;
  onChange: (value: SupportAudience) => void;
}> = ({ value, onChange }) => (
  <div className="mb-4 flex gap-1 border-b border-gray-200" role="tablist">
    {SUPPORT_AUDIENCES.map((audience) => (
      <button
        key={audience}
        type="button"
        role="tab"
        aria-selected={value === audience}
        onClick={() => onChange(audience)}
        className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
          value === audience ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-400 hover:text-gray-700'
        }`}
      >
        {SUPPORT_AUDIENCE_LABEL[audience]}
      </button>
    ))}
  </div>
);
