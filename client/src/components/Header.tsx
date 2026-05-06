import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState, useAppDispatch } from '@/store';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import type { PanelType } from '@/types';

export default function Header() {
  const { t } = useTranslation();
  const state = useAppState();
  const dispatch = useAppDispatch();

  const PANEL_TABS: { key: PanelType; icon: string }[] = [
    { key: 'chat', icon: '💬' },
    { key: 'dashboard', icon: '📊' },
    { key: 'discovery', icon: '🔍' },
    { key: 'sessions', icon: '📁' },
    { key: 'cron', icon: '⏰' },
    { key: 'config', icon: '⚙️' },
    { key: 'logs', icon: '📋' },
    { key: 'skills', icon: '🧩' },
    { key: 'nodes', icon: '🔌' },
  ];

  const statusConfig = {
    connected: { label: t('dashboard.connected'), color: 'bg-success', dotColor: 'bg-success' },
    connecting: { label: t('dashboard.connecting'), color: 'bg-warning', dotColor: 'bg-warning' },
    disconnected: { label: t('dashboard.disconnected'), color: 'bg-danger', dotColor: 'bg-danger' },
  };

  const status = statusConfig[state.connectionStatus];

  return (
    <header className="h-14 border-b border-border bg-bg-secondary flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-1.5 hover:bg-bg-elevated rounded-md transition-colors"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          aria-label={t('common.close')}
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
          <span className="font-semibold text-text-primary text-sm hidden sm:block">{t('common.appName')}</span>
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
            {t(`nav.${tab.key}`)}
          </button>
        ))}
      </nav>

      {/* Right: Session badge + Command palette trigger + Theme toggle + Language switcher */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />

        {state.activeSessionId && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated text-xs text-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{state.messages.length} {t('sessions.messages')}</span>
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'TOGGLE_COMMAND_PALETTE' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-elevated text-xs text-text-muted hover:text-text-secondary hover:bg-border transition-colors"
          title={`${t('commandPalette.title')} (${t('commandPalette.shortcut')})`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <kbd className="hidden sm:inline text-[10px] px-1 py-0.5 rounded bg-bg-secondary border border-border font-mono">{t('commandPalette.shortcut')}</kbd>
        </button>
      </div>
    </header>
  );
}
