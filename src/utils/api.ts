import { useAuthStore } from '../store/useAuthStore';
import i18n from '../i18n';
import { getInternationalizationPreferences } from './internationalization';

const BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  data?: unknown;
}

export interface ApiFieldError {
  field: string;
  code: string;
  messageKey?: string | null;
  messageArgs?: Record<string, unknown>;
  message?: string | null;
}

interface ApiErrorResponse {
  code?: string;
  message?: string;
  messageKey?: string;
  messageArgs?: Record<string, unknown>;
  fieldErrors?: ApiFieldError[];
  traceId?: string;
}

const translatedMessage = (error: ApiErrorResponse, fallbackKey: string) => {
  if (error.messageKey && i18n.exists(error.messageKey)) {
    return i18n.t(error.messageKey, error.messageArgs ?? {});
  }
  return error.message || i18n.t(fallbackKey);
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageKey: string | null;
  readonly messageArgs: Record<string, unknown>;
  readonly fieldErrors: ApiFieldError[];
  readonly traceId: string | null;

  constructor(
    message: string,
    status: number,
    code: string,
    messageKey: string | null,
    messageArgs: Record<string, unknown>,
    fieldErrors: ApiFieldError[],
    traceId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.messageArgs = messageArgs;
    this.fieldErrors = fieldErrors;
    this.traceId = traceId;
  }
}

const toApiError = (status: number, error: ApiErrorResponse, fallbackKey: string) => new ApiError(
  translatedMessage(error, fallbackKey), status, error.code ?? 'UNKNOWN_ERROR', error.messageKey ?? null,
  error.messageArgs ?? {}, error.fieldErrors ?? [], error.traceId ?? null,
);

const buildAuthHeaders = (data?: unknown): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = useAuthStore.getState().token;

  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['Accept-Language'] = getInternationalizationPreferences().languageCode;
  return headers;
};

/**
 * 백엔드의 core.web.ApiResponse<T> 규약(code/message/data/traceId)을 그대로 감싼다.
 * signstage-docs backend/backend-coding-convention.md 13장 참고.
 */
export const apiFetch = async (endpoint: string, options: RequestOptions = {}) => {
  const { data, ...customConfig } = options;

  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...buildAuthHeaders(data),
      ...customConfig.headers,
    },
  };

  if (data) {
    config.body = data instanceof FormData ? data : JSON.stringify(data);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  // 로그인 요청 자체의 401(아이디/비밀번호 불일치)은 세션 만료가 아니므로
  // 강제 로그아웃/리다이렉트 없이 실제 에러 메시지를 그대로 호출자에게 전달한다.
  // signstage-docs business/login-security.md 4.3절 참고.
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
    if (response.status === 401 && endpoint !== '/identity/login') {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new ApiError(
        i18n.t('common.sessionExpired'), 401, errorData.code ?? 'SESSION_EXPIRED',
        errorData.messageKey ?? null, errorData.messageArgs ?? {}, errorData.fieldErrors ?? [], errorData.traceId ?? null,
      );
    }
    throw toApiError(response.status, errorData, 'common.requestFailed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

/**
 * PDF 원본/결과물 다운로드처럼 `ApiResponse` JSON 봉투가 아니라 바이너리를 그대로 돌려주는
 * 엔드포인트용(`TemplateController`/`CeremonyEventController`의 `/file` 경로 등).
 * `apiFetch`와 인증 헤더/401 처리는 같지만 `response.json()` 대신 `response.blob()`을 쓴다.
 */
export const apiFetchBlob = async (endpoint: string): Promise<Blob> => {
  const response = await fetch(`${BASE_URL}${endpoint}`, { headers: buildAuthHeaders() });

  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
    if (response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new ApiError(
        i18n.t('common.sessionExpired'), 401, errorData.code ?? 'SESSION_EXPIRED',
        errorData.messageKey ?? null, errorData.messageArgs ?? {}, errorData.fieldErrors ?? [], errorData.traceId ?? null,
      );
    }
    throw toApiError(response.status, errorData, 'common.fileLoadFailed');
  }

  return response.blob();
};

export const api = {
  get: (endpoint: string, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'GET' }),
  post: (endpoint: string, data?: unknown, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'POST', data }),
  put: (endpoint: string, data?: unknown, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'PUT', data }),
  patch: (endpoint: string, data?: unknown, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'PATCH', data }),
  delete: (endpoint: string, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'DELETE' }),
  getBlob: (endpoint: string) => apiFetchBlob(endpoint),
};
