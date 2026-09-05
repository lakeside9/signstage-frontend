export const DEFAULT_LANGUAGE_CODE = 'ko';
export const DEFAULT_FORMAT_LOCALE = 'ko-KR';
export const DEFAULT_TIME_ZONE_ID = 'Asia/Seoul';
export const DEFAULT_CURRENCY_CODE = 'KRW';

export interface InternationalizationPreferences {
  languageCode: string;
  formatLocale: string;
  timeZoneId: string;
}

const STORAGE_KEY = 'signstage.internationalization';

const defaults: InternationalizationPreferences = {
  languageCode: DEFAULT_LANGUAGE_CODE,
  formatLocale: DEFAULT_FORMAT_LOCALE,
  timeZoneId: DEFAULT_TIME_ZONE_ID,
};

const loadPreferences = (): InternationalizationPreferences => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? { ...defaults, ...JSON.parse(value) } : defaults;
  } catch {
    return defaults;
  }
};

let preferences = loadPreferences();

export const setInternationalizationPreferences = (
  next: Partial<InternationalizationPreferences>,
) => {
  preferences = { ...preferences, ...next };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  document.documentElement.lang = preferences.languageCode;
  window.dispatchEvent(new CustomEvent('signstage:language-change', { detail: preferences.languageCode }));
};

export const getInternationalizationPreferences = () => preferences;

/** 서버의 offset 없는 실제/감사 시각은 UTC LocalDateTime 계약으로 전송된다. */
export const parseUtcDate = (value: string | number | Date) => {
  if (typeof value !== 'string') return new Date(value);
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasOffset ? value : `${value}Z`);
};

export const formatCurrency = (
  value: number | string,
  currencyCode = DEFAULT_CURRENCY_CODE,
  fractionDigits?: number,
) => new Intl.NumberFormat(preferences.formatLocale, {
  style: 'currency',
  currency: currencyCode,
  minimumFractionDigits: fractionDigits,
  maximumFractionDigits: fractionDigits,
}).format(Number(value));

export const formatDate = (value: string | number | Date) => new Intl.DateTimeFormat(
  preferences.formatLocale,
  { dateStyle: 'medium', timeZone: preferences.timeZoneId },
).format(parseUtcDate(value));

export const formatDateTime = (value: string | number | Date) => new Intl.DateTimeFormat(
  preferences.formatLocale,
  { dateStyle: 'medium', timeStyle: 'short', timeZone: preferences.timeZoneId },
).format(parseUtcDate(value));

setInternationalizationPreferences(preferences);
