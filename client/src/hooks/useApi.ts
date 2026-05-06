import { useCallback } from 'react';
import { useAppDispatch } from '@/store';
import type { ToastMessage } from '@/types';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  silent?: boolean;
}

interface ApiResponse<T = unknown> {
  ok: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

export function useApi() {
  const dispatch = useAppDispatch();

  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, message?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      dispatch({ type: 'ADD_TOAST', payload: { id, type, title, message, duration: 4000 } });
    },
    [dispatch]
  );

  const fetchApi = useCallback(
    async <T = unknown>(path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> => {
      const { method = 'GET', body, headers = {}, silent = false } = options;

      try {
        const res = await fetch(`/api${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        let data: T | null = null;
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await res.json();
        }

        if (!res.ok) {
          const errorMsg = (data as { error?: string })?.error || `请求失败 (${res.status})`;
          if (!silent) {
            addToast('error', '请求失败', errorMsg);
          }
          return { ok: false, data: null, error: errorMsg, status: res.status };
        }

        return { ok: true, data, error: null, status: res.status };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '网络错误';
        if (!silent) {
          addToast('error', '网络错误', msg);
        }
        return { ok: false, data: null, error: msg, status: 0 };
      }
    },
    [addToast]
  );

  const get = useCallback(
    <T = unknown>(path: string, options?: Omit<ApiOptions, 'method' | 'body'>) =>
      fetchApi<T>(path, { ...options, method: 'GET' }),
    [fetchApi]
  );

  const post = useCallback(
    <T = unknown>(path: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) =>
      fetchApi<T>(path, { ...options, method: 'POST', body }),
    [fetchApi]
  );

  const put = useCallback(
    <T = unknown>(path: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) =>
      fetchApi<T>(path, { ...options, method: 'PUT', body }),
    [fetchApi]
  );

  const del = useCallback(
    <T = unknown>(path: string, options?: Omit<ApiOptions, 'method' | 'body'>) =>
      fetchApi<T>(path, { ...options, method: 'DELETE' }),
    [fetchApi]
  );

  const patch = useCallback(
    <T = unknown>(path: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) =>
      fetchApi<T>(path, { ...options, method: 'PATCH', body }),
    [fetchApi]
  );

  return { fetchApi, get, post, put, del, patch, addToast };
}
