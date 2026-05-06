import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState, useAppDispatch } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';
import { formatTime, generateId } from '@/lib/markdown';
import type { Session } from '@/types';

export default function Sidebar() {
  const { t } = useTranslation();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rpc } = useWebSocket();
  const { addToast } = useApi();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return state.sessions;
    const query = searchQuery.toLowerCase();
    return state.sessions.filter(s =>
      s.id?.toLowerCase().includes(query) ||
      s.title?.toLowerCase().includes(query)
    );
  }, [state.sessions, searchQuery]);

  const loadSessions = useCallback(async () => {
    try {
      const result = await rpc('sessions.list');
      const sessions = (result as Session[]) || [];
      dispatch({ type: 'SET_SESSIONS', payload: sessions });
    } catch {
      addToast('error', t('sessions.loadError'));
    }
  }, [rpc, dispatch, addToast, t]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(async () => {
    try {
      const result = await rpc('sessions.create', {
        title: `${t('sessions.create')} ${new Date().toLocaleString()}`,
      });
      const session = result as Session;
      if (session) {
        dispatch({ type: 'ADD_SESSION', payload: session });
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: session.id });
        addToast('success', t('sessions.createSuccess'));
      }
    } catch {
      addToast('error', t('sessions.createError'));
    }
  }, [rpc, dispatch, addToast, t]);

  const switchSession = useCallback(
    (id: string) => {
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: id });
      dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false });
    },
    [dispatch]
  );

  return (
    <aside
      className={`fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-bg-secondary border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0 ${
        state.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">{t('sessions.title')}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={loadSessions}
            className="p-1.5 hover:bg-bg-elevated rounded-md transition-colors text-text-muted hover:text-text-secondary"
            title={t('common.refresh')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={createSession}
            className="p-1.5 hover:bg-bg-elevated rounded-md transition-colors text-text-muted hover:text-accent"
            title={t('sessions.create')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search input */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <svg className="w-3.5 h-3.5 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sessions.search')}
            className="w-full pl-8 pr-7 py-1.5 bg-bg-tertiary border border-border rounded-md text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-text-faint hover:text-text-secondary transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredSessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-faint text-sm">
            <p>{searchQuery ? t('sessions.noResults') : t('sessions.noSessions')}</p>
            {!searchQuery && (
              <button
                onClick={createSession}
                className="mt-3 px-3 py-1.5 bg-accent-muted/20 text-accent rounded-md text-xs hover:bg-accent-muted/30 transition-colors"
              >
                {t('sessions.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {filteredSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => switchSession(session.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group ${
                  state.activeSessionId === session.id
                    ? 'bg-accent-muted/15 text-accent'
                    : 'text-text-secondary hover:bg-bg-elevated'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate flex-1">
                    {session.title || session.id.slice(0, 8)}
                  </span>
                  {session.message_count !== undefined && (
                    <span className="text-[10px] text-text-faint ml-2 shrink-0">
                      {session.message_count}
                    </span>
                  )}
                </div>
                {session.updated_at && (
                  <div className="text-[11px] text-text-faint mt-0.5">
                    {formatTime(new Date(session.updated_at).getTime())}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="text-[11px] text-text-faint text-center">
          {filteredSessions.length} {t('sessions.messages')} {searchQuery && `(${t('sessions.filtered')} ${state.sessions.length})`}
        </div>
      </div>

      {/* Overlay for mobile */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[-1] lg:hidden"
          onClick={() => dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false })}
        />
      )}
    </aside>
  );
}
