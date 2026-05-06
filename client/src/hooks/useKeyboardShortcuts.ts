import { useEffect, useRef, useCallback } from 'react';
import type { PanelType } from '@/types';

export type ShortcutAction =
  | 'goHome'
  | 'goChat'
  | 'goSessions'
  | 'goDashboard'
  | 'goDiscovery'
  | 'goLogs'
  | 'goSkills'
  | 'goNodes'
  | 'goCron'
  | 'goConfig'
  | 'showHelp'
  | 'closeModal'
  | 'sendMessage'
  | 'focusSearch'
  | 'newSession';

interface Shortcut {
  action: ShortcutAction;
  description: string;
  category: 'navigation' | 'actions' | 'chat';
  keys: string[];
}

export const SHORTCUTS: Shortcut[] = [
  // Navigation shortcuts (g + key)
  { action: 'goHome', description: '跳转到首页', category: 'navigation', keys: ['g', 'h'] },
  { action: 'goChat', description: '跳转到聊天', category: 'navigation', keys: ['g', 'c'] },
  { action: 'goSessions', description: '跳转到会话', category: 'navigation', keys: ['g', 's'] },
  { action: 'goDashboard', description: '跳转到仪表盘', category: 'navigation', keys: ['g', 'd'] },
  { action: 'goDiscovery', description: '跳转到发现', category: 'navigation', keys: ['g', 'v'] },
  { action: 'goLogs', description: '跳转到日志', category: 'navigation', keys: ['g', 'l'] },
  { action: 'goSkills', description: '跳转到技能', category: 'navigation', keys: ['g', 'k'] },
  { action: 'goNodes', description: '跳转到节点', category: 'navigation', keys: ['g', 'n'] },
  { action: 'goCron', description: '跳转到定时任务', category: 'navigation', keys: ['g', 'r'] },
  { action: 'goConfig', description: '跳转到配置', category: 'navigation', keys: ['g', 'o'] },

  // Action shortcuts
  { action: 'showHelp', description: '显示快捷键帮助', category: 'actions', keys: ['?'] },
  { action: 'closeModal', description: '关闭弹窗', category: 'actions', keys: ['Escape'] },

  // Chat shortcuts
  { action: 'sendMessage', description: '发送消息', category: 'chat', keys: ['Ctrl', 'Enter'] },
  { action: 'focusSearch', description: '聚焦搜索', category: 'chat', keys: ['Ctrl', 'k'] },
  { action: 'newSession', description: '新建会话', category: 'chat', keys: ['Ctrl', 'n'] },
];

interface UseKeyboardShortcutsOptions {
  onAction: (action: ShortcutAction) => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({ onAction, enabled = true }: UseKeyboardShortcutsOptions) {
  // Track pending 'g' key for navigation shortcuts
  const pendingGRef = useRef(false);
  const gTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingG = useCallback(() => {
    pendingGRef.current = false;
    if (gTimeoutRef.current) {
      clearTimeout(gTimeoutRef.current);
      gTimeoutRef.current = null;
    }
  }, []);

  const setPendingG = useCallback(() => {
    pendingGRef.current = true;
    if (gTimeoutRef.current) {
      clearTimeout(gTimeoutRef.current);
    }
    gTimeoutRef.current = setTimeout(() => {
      pendingGRef.current = false;
    }, 1000); // 1 second timeout for second key
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Handle Escape globally
      if (e.key === 'Escape') {
        onAction('closeModal');
        return;
      }

      // Handle '?' for help (but not when typing)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        onAction('showHelp');
        return;
      }

      // Handle Ctrl+K for search
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onAction('focusSearch');
        return;
      }

      // Handle Ctrl+N for new session
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onAction('newSession');
        return;
      }

      // Handle Ctrl+Enter for send
      if (e.ctrlKey && e.key === 'Enter') {
        onAction('sendMessage');
        return;
      }

      // Handle navigation shortcuts (g + key)
      if (!isInput) {
        if (e.key.toLowerCase() === 'g') {
          e.preventDefault();
          setPendingG();
          return;
        }

        if (pendingGRef.current) {
          const key = e.key.toLowerCase();
          const navigationMap: Record<string, ShortcutAction> = {
            h: 'goHome',
            c: 'goChat',
            s: 'goSessions',
            d: 'goDashboard',
            v: 'goDiscovery',
            l: 'goLogs',
            k: 'goSkills',
            n: 'goNodes',
            r: 'goCron',
            o: 'goConfig',
          };

          if (navigationMap[key]) {
            e.preventDefault();
            onAction(navigationMap[key]);
            clearPendingG();
            return;
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Clear pending G if any other key is pressed and released
      if (pendingGRef.current && e.key.toLowerCase() !== 'g') {
        // Don't clear immediately, let the keydown handler check first
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      clearPendingG();
    };
  }, [enabled, onAction, setPendingG, clearPendingG]);

  return {
    isPendingG: () => pendingGRef.current,
  };
}

// Helper to get panel from action
export function getPanelFromAction(action: ShortcutAction): PanelType | null {
  const panelMap: Record<string, PanelType> = {
    goHome: 'chat',
    goChat: 'chat',
    goSessions: 'sessions',
    goDashboard: 'dashboard',
    goDiscovery: 'discovery',
    goLogs: 'logs',
    goSkills: 'skills',
    goNodes: 'nodes',
    goCron: 'cron',
    goConfig: 'config',
  };
  return panelMap[action] || null;
}
