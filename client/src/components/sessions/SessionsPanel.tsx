import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useApi } from '@/hooks/useApi';
import Modal from '@/components/Modal';
import { formatTime } from '@/lib/markdown';
import type { Session } from '@/types';

export default function SessionsPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { addToast } = useApi();

  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return state.sessions;
    const query = searchQuery.toLowerCase();
    return state.sessions.filter(s =>
      s.id?.toLowerCase().includes(query) ||
      s.title?.toLowerCase().includes(query)
    );
  }, [state.sessions, searchQuery]);

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <span className="bg-accent/30 text-accent font-medium">{text.slice(index, index + query.length)}</span>
        {text.slice(index + query.length)}
      </>
    );
  };

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions');
      const result = await res.json();
      dispatch({ type: 'SET_SESSIONS', payload: (Array.isArray(result) ? result : []) as Session[] });
    } catch {
      addToast('error', '加载会话列表失败');
    } finally {
      setLoading(false);
    }
  }, [dispatch, addToast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `会话 ${new Date().toLocaleString('zh-CN')}` }),
      });
      const session = await res.json() as Session;
      if (session) {
        dispatch({ type: 'ADD_SESSION', payload: session });
        addToast('success', '会话已创建');
      }
    } catch {
      addToast('error', '创建会话失败');
    }
  }, [dispatch, addToast]);

  const switchToSession = useCallback(
    (id: string) => {
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: id });
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'chat' });
    },
    [dispatch]
  );

  const resetSession = useCallback(
    async (id: string) => {
      if (!confirm('确定要重置此会话吗？所有消息将被清除。')) return;
      try {
        await fetch(`/api/sessions/${id}/reset`, { method: 'POST' });
        addToast('success', '会话已重置');
        loadSessions();
      } catch {
        addToast('error', '重置会话失败');
      }
    },
    [addToast, loadSessions]
  );

  const compactSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/sessions/${id}/compact`, { method: 'POST' });
        addToast('success', '会话已压缩');
      } catch {
        addToast('error', '压缩会话失败');
      }
    },
    [addToast]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!confirm('确定要删除此会话吗？此操作不可撤销。')) return;
      try {
        await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
        dispatch({ type: 'REMOVE_SESSION', payload: id });
        addToast('success', '会话已删除');
      } catch {
        addToast('error', '删除会话失败');
      }
    },
    [dispatch, addToast]
  );

  const viewTranscript = useCallback(
    async (session: Session) => {
      setSelectedSession(session);
      setShowTranscript(true);
      try {
        const res = await fetch(`/api/sessions/${session.id}/transcript`);
        const result = await res.json();
        setTranscript(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      } catch {
        setTranscript('无法加载对话记录');
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">会话管理</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
          <button
            onClick={createSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-muted/20 text-xs text-accent hover:bg-accent-muted/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建会话
          </button>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索会话..."
          className="w-full pl-10 pr-4 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-faint hover:text-text-secondary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Session count */}
      <div className="text-xs text-text-muted">
        共 {filteredSessions.length} 个会话
      </div>

      {filteredSessions.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-text-faint text-sm mb-3">
            {searchQuery ? '未找到匹配的会话' : '暂无会话'}
          </div>
          {!searchQuery && (
            <button
              onClick={createSession}
              className="px-4 py-2 bg-accent-muted/20 text-accent rounded-lg text-sm hover:bg-accent-muted/30 transition-colors"
            >
              创建第一个会话
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-bg-tertiary border border-border rounded-xl p-4 group hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {session.title
                        ? highlightText(session.title, searchQuery)
                        : highlightText(session.id.slice(0, 12), searchQuery)}
                    </h3>
                    {state.activeSessionId === session.id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-muted/20 text-accent">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-faint">
                    <span>ID: {highlightText(session.id.slice(0, 8), searchQuery)}</span>
                    {session.message_count !== undefined && (
                      <span>{session.message_count} 条消息</span>
                    )}
                    {session.created_at && (
                      <span>创建于 {formatTime(new Date(session.created_at).getTime())}</span>
                    )}
                    {session.updated_at && (
                      <span>更新于 {formatTime(new Date(session.updated_at).getTime())}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                  <button
                    onClick={() => switchToSession(session.id)}
                    className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-accent transition-colors"
                    title="切换到对话"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => viewTranscript(session)}
                    className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-text-secondary transition-colors"
                    title="查看记录"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => compactSession(session.id)}
                    className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-warning transition-colors"
                    title="压缩会话"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => resetSession(session.id)}
                    className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-warning transition-colors"
                    title="重置会话"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-danger transition-colors"
                    title="删除会话"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transcript Modal */}
      <Modal
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        title={`对话记录 - ${selectedSession?.title || selectedSession?.id?.slice(0, 8)}`}
        maxWidth="max-w-2xl"
      >
        <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-bg-primary rounded-lg p-4 max-h-96 overflow-y-auto border border-border">
          {transcript}
        </pre>
      </Modal>
    </div>
  );
}
