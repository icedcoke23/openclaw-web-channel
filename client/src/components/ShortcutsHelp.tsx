import React from 'react';
import Modal from '@/components/Modal';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const categories = {
    navigation: '导航',
    actions: '操作',
    chat: '聊天',
  };

  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof SHORTCUTS>);

  const formatKeys = (keys: string[]) => {
    return keys.map((key, idx) => (
      <React.Fragment key={idx}>
        <kbd className="inline-flex items-center justify-center px-2 py-1 text-xs font-mono font-medium bg-bg-elevated border border-border rounded text-text-secondary min-w-[24px]">
          {key}
        </kbd>
        {idx < keys.length - 1 && (
          <span className="mx-1 text-text-faint">+</span>
        )}
      </React.Fragment>
    ));
  };

  return (
    <Modal open={open} onClose={onClose} title="键盘快捷键" maxWidth="max-w-2xl">
      <div className="space-y-6">
        <p className="text-sm text-text-muted">
          使用以下快捷键快速导航和操作界面。按 <kbd className="px-1.5 py-0.5 text-xs bg-bg-elevated border border-border rounded">?</kbd> 随时打开此帮助窗口。
        </p>

        {Object.entries(categories).map(([category, label]) => {
          const shortcuts = groupedShortcuts[category];
          if (!shortcuts || shortcuts.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-bg-elevated"
                  >
                    <span className="text-sm text-text-secondary">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center shrink-0 ml-4">
                      {formatKeys(shortcut.keys)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-text-primary mb-3">提示</h3>
          <ul className="text-sm text-text-muted space-y-1.5 list-disc list-inside">
            <li>导航快捷键需要先按 <kbd className="px-1.5 py-0.5 text-xs bg-bg-elevated border border-border rounded">g</kbd>，然后在 1 秒内按第二个键</li>
            <li>在输入框中输入时，导航快捷键不会触发</li>
            <li>按 <kbd className="px-1.5 py-0.5 text-xs bg-bg-elevated border border-border rounded">Esc</kbd> 可以关闭任何弹窗</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
