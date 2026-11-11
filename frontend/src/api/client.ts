// Low-level HTTP client. Every call goes to /api/... (proxied to booking-api by Vite in dev
// and by nginx in Docker), so the frontend never contains the API's address.
//
// Any non-2xx response becomes an ApiError carrying the API's standard error body
// { error: { code, message, field?, details? } }.

const API_PREFIX = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Called when the API answers 401 to a logged-in request (token expired or invalid). */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function request<T>(path: string, { method = 'GET', body, token, query }: Options = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const url = `${API_PREFIX}${path}${params.size ? `?${params}` : ''}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  const text = await response.text();
  const data = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; field?: string; details?: Record<string, unknown> } })?.error;
    if (response.status === 401 && token) onUnauthorized();
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Unexpected error (HTTP ${response.status})`,
      error?.field,
      error?.details,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
