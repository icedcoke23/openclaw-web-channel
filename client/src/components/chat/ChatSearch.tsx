import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Message } from '@/types';

interface SearchResult {
  messages: Message[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ChatSearchProps {
  isOpen: boolean;
  onClose: () => void;
  sessionKey?: string;
  onJumpToMessage: (messageId: string) => void;
  existingMessages: Message[];
}

export default function ChatSearch({
  isOpen,
  onClose,
  sessionKey,
  onJumpToMessage,
  existingMessages,
}: ChatSearchProps) {
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'api' | 'local'>('local');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const performSearch = useCallback(async () => {
    if (!keyword.trim() && !startDate && !endDate) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      if (searchMode === 'api' && sessionKey) {
        // Search via API
        const params = new URLSearchParams();
        params.append('sessionKey', sessionKey);
        if (keyword) params.append('search', keyword);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('pageSize', '50');

        const res = await fetch(`/api/history?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } else {
        // Local search through existing messages
        let filtered = [...existingMessages];

        if (keyword.trim()) {
          const searchLower = keyword.toLowerCase();
          filtered = filtered.filter((msg) => {
            const content = String(msg.content || '').toLowerCase();
            const role = String(msg.role || '').toLowerCase();
            return content.includes(searchLower) || role.includes(searchLower);
          });
        }

        if (startDate || endDate) {
          const start = startDate ? new Date(startDate).getTime() : null;
          const end = endDate ? new Date(endDate).getTime() : null;
          filtered = filtered.filter((msg) => {
            const msgTime = msg.timestamp;
            if (!msgTime) return true;
            if (start && msgTime < start) return false;
            if (end && msgTime > end) return false;
            return true;
          });
        }

        setResults({
          messages: filtered,
          total: filtered.length,
          page: 1,
          pageSize: 50,
          totalPages: 1,
        });
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [keyword, startDate, endDate, sessionKey, searchMode, existingMessages]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword.trim() || startDate || endDate) {
        performSearch();
      } else {
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, startDate, endDate, performSearch]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-accent/30 text-accent px-0.5 rounded">{part}</mark>
      ) : (
        part
      )
    );
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleResultClick = (message: Message) => {
    onJumpToMessage(message.id);
    onClose();
  };

  const clearSearch = () => {
    setKeyword('');
    setStartDate('');
    setEndDate('');
    setResults(null);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary">
          <h2 className="text-sm font-semibold text-text-primary">搜索聊天记录</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search controls */}
        <div className="p-4 space-y-3">
          {/* Search input */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索消息内容..."
              className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
            />
            {keyword && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-elevated text-text-muted hover:text-text-secondary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted">开始日期:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted">结束日期:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-text-muted">搜索范围:</label>
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as 'api' | 'local')}
                className="px-2 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary outline-none focus:border-accent/50 transition-colors"
              >
                <option value="local">当前会话</option>
                {sessionKey && <option value="api">历史记录</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto border-t border-border">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-text-muted">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">搜索中...</span>
              </div>
            </div>
          ) : results ? (
            results.total > 0 ? (
              <div className="divide-y divide-border">
                {results.messages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleResultClick(message)}
                    className="w-full text-left p-4 hover:bg-bg-secondary transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        message.role === 'user'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-purple/10 text-purple'
                      }`}>
                        {message.role === 'user' ? '用户' : '助手'}
                      </span>
                      <span className="text-xs text-text-faint">{formatTime(message.timestamp)}</span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {highlightText(String(message.content || '').slice(0, 200), keyword)}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      跳转到此消息
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm">未找到匹配的消息</p>
                <p className="text-xs mt-1 opacity-60">尝试使用不同的关键词或调整日期范围</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">输入关键词开始搜索</p>
              <p className="text-xs mt-1 opacity-60">支持按内容、日期范围筛选</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {results && results.total > 0 && (
          <div className="px-4 py-2 border-t border-border bg-bg-secondary text-xs text-text-muted">
            找到 {results.total} 条结果
            {results.totalPages > 1 && ` (第 ${results.page}/${results.totalPages} 页)`}
          </div>
        )}
      </div>
    </div>
  );
}
