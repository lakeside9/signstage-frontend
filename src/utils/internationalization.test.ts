import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDateTime,
  parseUtcDate,
  setInternationalizationPreferences,
} from './internationalization';

describe('internationalization', () => {
  beforeEach(() => {
    setInternationalizationPreferences({ languageCode: 'ko', formatLocale: 'ko-KR', timeZoneId: 'Asia/Seoul' });
  });

  it('formats KRW with zero fraction digits', () => {
    expect(formatCurrency('11000', 'KRW', 0)).toContain('11,000');
  });

  it('treats offset-less server instants as UTC and displays them in the selected time zone', () => {
    expect(parseUtcDate('2026-09-04T00:00:00').toISOString()).toBe('2026-09-04T00:00:00.000Z');
    expect(formatDateTime('2026-09-04T00:00:00')).toContain('9:00');
  });
});
