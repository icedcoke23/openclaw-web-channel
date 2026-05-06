import React from 'react';
import { useAppState, useAppDispatch } from '@/store';
import type { PanelType } from '@/types';

const PANEL_TABS: { key: PanelType; label: string; icon: string }[] = [
  { key: 'chat', label: '对话', icon: '💬' },
  { key: 'dashboard', label: '仪表盘', icon: '📊' },
  { key: 'sessions', label: '会话', icon: '📁' },
  { key: 'cron', label: '定时任务', icon: '⏰' },
  { key: 'config', label: '配置', icon: '⚙️' },
  { key: 'logs', label: '日志', icon: '📋' },
  { key: 'skills', label: '技能', icon: '🧩' },
  { key: 'nodes', label: '节点', icon: '🔌' },
];

export default function Header() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const statusConfig = {
    connected: { label: '已连接', color: 'bg-success', dotColor: 'bg-success' },
    connecting: { label: '连接中', color: 'bg-warning', dotColor: 'bg-warning' },
    disconnected: { label: '已断开', color: 'bg-danger', dotColor: 'bg-danger' },
  };

  const status = statusConfig[state.connectionStatus];

  return (
    <header className="h-14 border-b border-border bg-bg-secondary flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-1.5 hover:bg-bg-elevated rounded-md transition-colors"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          aria-label="切换侧边栏"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-muted flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-text-primary text-sm hidden sm:block">OpenClaw</span>
        </div>

        {/* Connection status pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}/15 text-text-secondary`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} ${state.connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <span>{status.label}</span>
        </div>
      </div>

      {/* Center: Navigation tabs (desktop) */}
      <nav className="hidden lg:flex items-center gap-1">
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', payload: tab.key })}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              state.activePanel === tab.key
                ? 'bg-accent-muted/20 text-accent'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right: Session badge + Command palette trigger */}
      <div className="flex items-center gap-2">
        {state.activeSessionId && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated text-xs text-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{state.messages.length} 条消息</span>
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'TOGGLE_COMMAND_PALETTE' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-elevated text-xs text-text-muted hover:text-text-secondary hover:bg-border transition-colors"
          title="命令面板 (Ctrl+/)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <kbd className="hidden sm:inline text-[10px] px-1 py-0.5 rounded bg-bg-secondary border border-border font-mono">Ctrl+/</kbd>
        </button>
      </div>
    </header>
  );
}
