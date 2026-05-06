import { useCallback } from 'react';
import { useAppDispatch } from '@/store';
import type { ToastMessage, CronJob } from '@/types';

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

  // Cron job operations
  const createCronJob = useCallback(
    async (job: Omit<CronJob, 'id'>) => {
      const res = await post<{ success: boolean; job: CronJob }>('/cron', job);
      if (res.ok && res.data) {
        dispatch({ type: 'ADD_CRON_JOB', payload: res.data.job });
        addToast('success', '创建成功', '定时任务已创建');
      }
      return res;
    },
    [post, dispatch, addToast]
  );

  const updateCronJob = useCallback(
    async (id: string, updates: Partial<CronJob>) => {
      const res = await patch<CronJob>(`/cron/${id}`, updates);
      if (res.ok && res.data) {
        dispatch({ type: 'UPDATE_CRON_JOB', payload: res.data });
        addToast('success', '更新成功', '定时任务已更新');
      }
      return res;
    },
    [patch, dispatch, addToast]
  );

  const deleteCronJob = useCallback(
    async (id: string) => {
      const res = await del<{ success: boolean }>(`/cron/${id}`);
      if (res.ok) {
        dispatch({ type: 'DELETE_CRON_JOB', payload: id });
        addToast('success', '删除成功', '定时任务已删除');
      }
      return res;
    },
    [del, dispatch, addToast]
  );

  const runCronJob = useCallback(
    async (id: string) => {
      const res = await post<{ success: boolean }>(`/cron/${id}/run`);
      if (res.ok) {
        addToast('success', '执行成功', '定时任务已触发执行');
      }
      return res;
    },
    [post, addToast]
  );

  return { fetchApi, get, post, put, del, patch, addToast, createCronJob, updateCronJob, deleteCronJob, runCronJob };
}
