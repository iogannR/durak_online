const RAW_API_URL = (import.meta.env.VITE_API_URL ?? '').trim();

export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

export function isBackendEnabled(): boolean {
  return API_BASE_URL.length > 0;
}

const TOKEN_STORAGE_KEY = 'durak_access_token';

export function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function clearAccessToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extractFastApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.detail === 'string') return record.detail;
  if (Array.isArray(record.detail) && record.detail.length > 0) {
    const first = record.detail[0] as Record<string, unknown> | undefined;
    if (first && typeof first.msg === 'string') return first.msg;
  }
  if (typeof record.message === 'string') return record.message;
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!isBackendEnabled()) {
    throw new ApiError(0, 'Сервер API не настроен (VITE_API_URL).');
  }

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером FastAPI.');
  }

  let data: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
    }
    throw new ApiError(
      response.status,
      extractFastApiError(data, `Ошибка сервера (${response.status})`)
    );
  }

  return data as T;
}

export function buildRoomWebSocketUrl(roomId: string): string {
  const wsBase = API_BASE_URL.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  const token = getAccessToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${wsBase}/ws/rooms/${encodeURIComponent(roomId)}${query}`;
}
