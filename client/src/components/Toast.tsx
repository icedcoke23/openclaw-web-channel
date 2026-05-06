import React, { useEffect } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import type { ToastMessage } from '@/types';

const ICONS: Record<ToastMessage['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS: Record<ToastMessage['type'], string> = {
  success: 'border-success/50 bg-success/10',
  error: 'border-danger/50 bg-danger/10',
  warning: 'border-warning/50 bg-warning/10',
  info: 'border-accent/50 bg-accent/10',
};

const ICON_COLORS: Record<ToastMessage['type'], string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-accent',
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: toast.id });
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, dispatch]);

  return (
    <div
      className={`toast-enter flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm max-w-sm ${COLORS[toast.type]}`}
    >
      <span className={`text-sm font-bold mt-0.5 ${ICON_COLORS[toast.type]}`}>
        {ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-text-muted mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })}
        className="text-text-faint hover:text-text-secondary transition-colors shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function Toast() {
  const state = useAppState();

  if (state.toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {state.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
