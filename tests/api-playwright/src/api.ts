// A thin wrapper around Playwright's APIRequestContext.
// Every call returns status, parsed body, headers and duration, and never throws on 4xx/5xx.
import type { APIRequestContext } from '@playwright/test';

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  text: string;
  headers: Record<string, string>; // header names are lowercase
  durationMs: number;
}

export interface RequestOptions {
  token?: string; // sent as "Authorization: Bearer <token>"
  body?: unknown; // serialized as JSON, Content-Type: application/json
  raw?: string; // sent exactly as given (for malformed JSON, wrong Content-Type…)
  headers?: Record<string, string>;
}

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
  ) {}

  get = (path: string, options?: RequestOptions) => this.send('GET', path, options);
  post = (path: string, options?: RequestOptions) => this.send('POST', path, options);
  put = (path: string, options?: RequestOptions) => this.send('PUT', path, options);
  patch = (path: string, options?: RequestOptions) => this.send('PATCH', path, options);
  delete = (path: string, options?: RequestOptions) => this.send('DELETE', path, options);

  async send(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

    let data: string | undefined;
    if (options.body !== undefined) {
      data = JSON.stringify(options.body);
      headers['Content-Type'] ??= 'application/json';
    } else if (options.raw !== undefined) {
      data = options.raw;
    }

    const started = Date.now();
    const response = await this.request.fetch(this.baseUrl + path, { method, headers, data });
    const text = await response.text();
    const durationMs = Date.now() - started;

    let body: any = text;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      // not JSON: keep the raw text so the assertion message shows it
    }
    return { status: response.status(), body, text, headers: response.headers(), durationMs };
  }
}
