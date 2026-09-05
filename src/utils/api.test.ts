import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { setInternationalizationPreferences } from './internationalization';

describe('api internationalized errors', () => {
  beforeEach(() => {
    setInternationalizationPreferences({ languageCode: 'en', formatLocale: 'en-US', timeZoneId: 'UTC' });
  });

  it('sends the preferred language and preserves the structured error contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'IDENTITY_INVALID_CREDENTIAL',
      message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      messageKey: 'error.identity.invalid.credential',
      messageArgs: {},
      fieldErrors: [{
        field: 'loginId', code: 'NOTBLANK', messageKey: 'validation.notblank',
        messageArgs: { field: 'loginId' }, message: 'loginId is required.',
      }],
      traceId: 'trace-123',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/identity/login', { loginId: 'user', password: 'wrong' }))
      .rejects.toMatchObject({
        message: 'The login ID or password is incorrect.',
        status: 401,
        code: 'IDENTITY_INVALID_CREDENTIAL',
        traceId: 'trace-123',
        fieldErrors: [expect.objectContaining({ field: 'loginId', code: 'NOTBLANK' })],
      } satisfies Partial<ApiError>);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>)['Accept-Language']).toBe('en');
  });
});
