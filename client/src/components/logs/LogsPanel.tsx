import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useApi } from '@/hooks/useApi';
import { generateId } from '@/lib/markdown';
import type { LogEntry } from '@/types';

const LEVEL_COLORS: Record<string, string> = {
  debug: 'text-text-faint',
  info: 'text-accent',
  warn: 'text-warning',
  error: 'text-danger',
};

const LEVEL_BG: Record<string, string> = {
  debug: 'bg-text-faint/10 text-text-faint',
  info: 'bg-accent/10 text-accent',
  warn: 'bg-warning/10 text-warning',
  error: 'bg-danger/10 text-danger',
};

export default function LogsPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { addToast } = useApi();

  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.logs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Connect to SSE log stream
  useEffect(() => {
    const connectSSE = () => {
      try {
        const es = new EventSource('/api/logs');
        eventSourceRef.current = es;

        es.onopen = () => {
          setSseConnected(true);
        };

        es.onmessage = (event) => {
          try {
            const log = JSON.parse(event.data) as LogEntry;
            dispatch({
              type: 'ADD_LOG',
              payload: {
                ...log,
                id: log.id || generateId(),
                timestamp: log.timestamp || Date.now(),
              },
            });
          } catch {
            // Non-JSON line, treat as info log
            dispatch({
              type: 'ADD_LOG',
              payload: {
                id: generateId(),
                timestamp: Date.now(),
                level: 'info',
                message: event.data,
              },
            });
          }
        };

        es.onerror = () => {
          setSseConnected(false);
          es.close();
          // Reconnect after 3s
          setTimeout(connectSSE, 3000);
        };
      } catch {
        // SSE not supported, fallback to polling
        setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [dispatch]);

  const filteredLogs = state.logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const exportLogs = useCallback(() => {
    const content = filteredLogs
      .map(
        (log) =>
          `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
      )
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', '日志已导出');
  }, [filteredLogs, addToast]);

  const clearLogs = useCallback(() => {
    dispatch({ type: 'CLEAR_LOGS' });
    addToast('info', '日志已清除');
  }, [dispatch, addToast]);

  const timeStr = (ts: number) =>
    new Date(ts).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        {/* Level filter */}
        <div className="flex items-center gap-1">
          {['all', 'debug', 'info', 'warn', 'error'].map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                levelFilter === level
                  ? 'bg-accent-muted/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {level === 'all' ? '全部' : level.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Search */}
        <div className="relative flex-1 min-w-[150px] max-w-xs">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索日志..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>

        <div className="flex-1" />

        {/* Status + actions */}
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs ${sseConnected ? 'text-success' : 'text-danger'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-success' : 'bg-danger'}`} />
            {sseConnected ? '实时' : '断开'}
          </span>
          <span className="text-xs text-text-faint">{filteredLogs.length} 条</span>

          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-2 py-1 rounded text-xs bg-accent-muted/20 text-accent hover:bg-accent-muted/30 transition-colors"
            >
              跳到底部
            </button>
          )}

          <button
            onClick={exportLogs}
            className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-text-secondary transition-colors"
            title="导出日志"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={clearLogs}
            className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-danger transition-colors"
            title="清除日志"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto font-mono text-xs" onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-faint text-sm">
            等待日志...
          </div>
        ) : (
          <div className="py-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-2 px-4 py-1 hover:bg-bg-secondary/50 transition-colors ${
                  log.level === 'error' ? 'bg-danger/5' : ''
                }`}
              >
                <span className="text-text-faint shrink-0 w-20">{timeStr(log.timestamp)}</span>
                <span className={`shrink-0 w-12 text-center font-medium ${LEVEL_COLORS[log.level] || 'text-text-muted'}`}>
                  {log.level.toUpperCase().padEnd(5)}
                </span>
                {log.source && (
                  <span className="shrink-0 text-text-faint w-20 truncate">{log.source}</span>
                )}
                <span className={`flex-1 ${log.level === 'error' ? 'text-danger' : 'text-text-secondary'}`}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
