import { useAuthStore } from '../store/useAuthStore';

const BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  data?: unknown;
}

/**
 * 백엔드의 core.web.ApiResponse<T> 규약(code/message/data/traceId)을 그대로 감싼다.
 * signstage-docs backend/backend-coding-convention.md 13장 참고.
 */
export const apiFetch = async (endpoint: string, options: RequestOptions = {}) => {
  const { data, ...customConfig } = options;
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {};

  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...headers,
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
  if (response.status === 401 && endpoint !== '/identity/login') {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || '요청 처리에 실패했습니다.');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const api = {
  get: (endpoint: string, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'GET' }),
  post: (endpoint: string, data?: unknown, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'POST', data }),
  put: (endpoint: string, data?: unknown, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'PUT', data }),
  patch: (endpoint: string, data?: unknown, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'PATCH', data }),
  delete: (endpoint: string, config?: RequestInit) => apiFetch(endpoint, { ...config, method: 'DELETE' }),
};
