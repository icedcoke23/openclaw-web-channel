import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import type { PanelType } from '@/types';

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: () => void;
  keywords: string[];
}

export default function CommandPalette() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<CommandItem[]>(() => {
    const panelCommands: CommandItem[] = [
      {
        id: 'panel-chat',
        label: '打开对话面板',
        description: '切换到 AI 对话界面',
        icon: '💬',
        keywords: ['chat', '对话', '聊天', 'ai'],
        action: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'chat' as PanelType }),
      },
      {
        id: 'panel-dashboard',
        label: '打开仪表盘',
        description: '查看网关状态和统计',
        icon: '📊',
        keywords: ['dashboard', '仪表盘', '统计', '状态'],
        action: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'dashboard' as PanelType }),
      },
      {
        id: 'panel-sessions',
        label: '打开会话管理',
        description: '管理所有会话',
        icon: '📁',
        keywords: ['sessions', '会话', '历史'],
        action: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'sessions' as PanelType }),
      },
      {
        id: 'panel-config',
        label: '打开配置面板',
        description: '查看和修改配置',
        icon: '⚙️',
        keywords: ['config', '配置', '设置'],
        action: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'config' as PanelType }),
      },
      {
        id: 'panel-logs',
        label: '打开日志面板',
        description: '查看实时日志',
        icon: '📋',
        keywords: ['logs', '日志', 'log'],
        action: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'logs' as PanelType }),
      },
      {
        id: 'panel-skills',
        label: '打开技能面板',
        description: '管理 AI 技能',
        icon: '🧩',
        keywords: ['skills', '技能', '插件'],
        action: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'skills' as PanelType }),
      },
      {
        id: 'panel-nodes',
        label: '打开节点面板',
        description: '查看和管理节点',
        icon: '🔌',
        keywords: ['nodes', '节点', '服务'],
        action: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'nodes' as PanelType }),
      },
      {
        id: 'toggle-sidebar',
        label: '切换侧边栏',
        description: '显示或隐藏会话列表',
        icon: '📌',
        keywords: ['sidebar', '侧边栏', '会话列表'],
        action: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
      },
    ];

    // Add session commands
    const sessionCommands: CommandItem[] = state.sessions.slice(0, 5).map((s) => ({
      id: `session-${s.id}`,
      label: `切换到: ${s.title || s.id.slice(0, 8)}`,
      description: `会话 ${s.id.slice(0, 8)}`,
      icon: '💬',
      keywords: ['session', '会话', s.title || s.id],
      action: () => {
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: s.id });
        dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'chat' as PanelType });
      },
    }));

    return [...panelCommands, ...sessionCommands];
  }, [state.sessions, dispatch]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [query, commands]);

  useEffect(() => {
    if (state.commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [state.commandPaletteOpen]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_COMMAND_PALETTE' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  const executeCommand = (cmd: CommandItem) => {
    cmd.action();
    dispatch({ type: 'SET_COMMAND_PALETTE_OPEN', payload: false });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      executeCommand(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      dispatch({ type: 'SET_COMMAND_PALETTE_OPEN', payload: false });
    }
  };

  if (!state.commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => dispatch({ type: 'SET_COMMAND_PALETTE_OPEN', payload: false })}
      />

      <div className="relative w-full max-w-lg bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索命令或面板..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-faint outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-faint font-mono">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-faint text-sm">
              没有匹配的命令
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  idx === selectedIndex ? 'bg-accent-muted/15 text-accent' : 'text-text-secondary hover:bg-bg-elevated'
                }`}
              >
                <span className="text-base shrink-0">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cmd.label}</p>
                  <p className="text-xs text-text-faint truncate">{cmd.description}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
