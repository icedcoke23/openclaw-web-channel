import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import type { RpcRequest, RpcResponse, RpcEvent, ChatRun } from '@/types';
import { getRpcAliases } from '@/lib/rpc';

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const HEARTBEAT_INTERVAL = 25000;
const STREAMING_TIMEOUT = 120_000;

export function useWebSocket() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const wsRef = useRef<WebSocket | null>(null);
  const rpcIdRef = useRef(0);
  const pendingRpcRef = useRef<Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; fallback: (() => void) | null }>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const streamingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const eventListenersRef = useRef<Map<string, Set<(params: Record<string, unknown>) => void>>>(new Map());

  const [url, setUrl] = useState<string>(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  });

  const clearAllStreamingTimers = useCallback(() => {
    streamingTimersRef.current.forEach((timer) => clearTimeout(timer));
    streamingTimersRef.current.clear();
    dispatch({ type: 'CLEAR_PENDING_RUNS' });
    if (state.isStreaming) {
      dispatch({ type: 'SET_STREAMING', payload: false });
    }
  }, [dispatch, state.isStreaming]);

  const startStreamingTimer = useCallback((runId: string) => {
    const existing = streamingTimersRef.current.get(runId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      streamingTimersRef.current.delete(runId);
      dispatch({ type: 'REMOVE_PENDING_RUN', payload: runId });

      if (state.pendingRuns.length <= 1 && state.isStreaming) {
        dispatch({ type: 'SET_STREAMING', payload: false });
      }
    }, STREAMING_TIMEOUT);

    streamingTimersRef.current.set(runId, timer);
  }, [dispatch, state.isStreaming, state.pendingRuns.length]);

  const stopStreamingTimer = useCallback((runId: string) => {
    const timer = streamingTimersRef.current.get(runId);
    if (timer) {
      clearTimeout(timer);
      streamingTimersRef.current.delete(runId);
    }
    dispatch({ type: 'REMOVE_PENDING_RUN', payload: runId });
  }, [dispatch]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.jsonrpc === '2.0' && data.id !== undefined) {
          // JSON-RPC 2.0 response
          const pending = pendingRpcRef.current.get(data.id);
          if (pending) {
            pendingRpcRef.current.delete(data.id);
            if (data.error) {
              // Check if there's a fallback alias to try
              if (pending.fallback) {
                pending.fallback();
              } else {
                pending.reject(new Error(data.error.message || 'RPC Error'));
              }
            } else {
              pending.resolve(data.result);
            }
          }
        } else if (data.jsonrpc === '2.0' && data.method) {
          // JSON-RPC 2.0 notification (event from server)
          const listeners = eventListenersRef.current.get(data.method);
          if (listeners) {
            listeners.forEach((fn) => fn(data.params || {}));
          }
        } else if (data.type === 'event' && data.event) {
          // Legacy format (backward compatibility)
          const listeners = eventListenersRef.current.get(data.event);
          if (listeners) {
            listeners.forEach((fn) => fn(data.data || {}));
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    []
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });

        // Start heartbeat
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        isConnectingRef.current = false;
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
        clearAllStreamingTimers();

        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        // Exponential backoff reconnect
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          RECONNECT_MAX_DELAY
        );
        reconnectAttemptsRef.current += 1;

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };

      wsRef.current = ws;
    } catch {
      isConnectingRef.current = false;
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
    }
  }, [url, dispatch, handleMessage, clearAllStreamingTimers]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    clearAllStreamingTimers();
    isConnectingRef.current = false;
    reconnectAttemptsRef.current = 0;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
  }, [dispatch, clearAllStreamingTimers]);

  const rpc = useCallback(
    async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket 未连接');
      }

      const id = ++rpcIdRef.current;
      const aliases = getRpcAliases(method);

      return new Promise((resolve, reject) => {
        const trySend = (idx: number) => {
          if (idx >= aliases.length) {
            reject(new Error(`RPC 方法不可用: ${method}`));
            return;
          }

          const currentMethod = aliases[idx];
          const req: RpcRequest = {
            jsonrpc: '2.0',
            id,
            method: currentMethod,
            params,
          };

          pendingRpcRef.current.set(id, {
            resolve,
            reject,
            // On failure, try next alias
            fallback: idx < aliases.length - 1 ? () => trySend(idx + 1) : null,
          });
          ws.send(JSON.stringify(req));
        };

        trySend(0);
      });
    },
    []
  );

  const subscribe = useCallback((event: string, handler: (params: Record<string, unknown>) => void) => {
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, new Set());
    }
    eventListenersRef.current.get(event)!.add(handler);

    return () => {
      eventListenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionStatus: state.connectionStatus,
    connect,
    disconnect,
    rpc,
    subscribe,
    startStreamingTimer,
    stopStreamingTimer,
    clearAllStreamingTimers,
  };
}
