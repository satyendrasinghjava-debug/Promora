/** Typed fetch client. The access token lives in memory only; the refresh token is an HttpOnly cookie the script cannot read. */
export class ApiError extends Error {
  status: number;
  code: string;
  errors?: { field: string; message: string }[];
  constructor(status: number, code: string, message: string, errors?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'promora' } })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        accessToken = body.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export interface RequestOptions { method?: string; body?: unknown; headers?: Record<string, string>; idempotencyKey?: string; raw?: boolean }

export async function api<T = any>(path: string, opts: RequestOptions = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method || 'GET', headers, credentials: 'include',
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  }
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api<T>(path, opts, false);
    accessToken = null;
    onSessionLost?.();
  }
  if (opts.raw && res.ok) return (await res.text()) as unknown as T;
  const data = await parse(res);
  if (!res.ok) {
    const d = (data && typeof data === 'object' ? data : {}) as any;
    throw new ApiError(res.status, d.code || 'ERROR', d.message || 'Something went wrong. Please try again.', d.errors);
  }
  return data as T;
}

export const qs = (params: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-key`);

export interface Page<T = any> { items: T[]; page: number; size: number; total: number; totalPages: number }
