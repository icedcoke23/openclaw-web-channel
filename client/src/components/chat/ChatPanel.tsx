import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState, useAppDispatch } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';
import { useNotifications } from '@/hooks/useNotifications';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import MessageBubble from './MessageBubble';
import Lightbox from '@/components/Lightbox';
import ChatSearch from './ChatSearch';
import { generateId, formatTokens, formatFileSize } from '@/lib/markdown';
import type { Message, Attachment, ChatRun } from '@/types';

export default function ChatPanel() {
  const { t } = useTranslation();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rpc, subscribe, startStreamingTimer, stopStreamingTimer, clearAllStreamingTimers } = useWebSocket();
  const { addToast } = useApi();
  const { permission: notificationPermission, showNotification } = useNotifications();
  const { isRecording, transcript, startRecording, stopRecording, error: voiceError } = useVoiceInput();

  // Load models on mount
  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        const models = Array.isArray(data) ? data : data?.models || [];
        const options = models.map((m: { id?: string; name?: string; model?: string }) => ({
          id: m.id || m.model || m.name || '',
          name: m.name || m.id || m.model || '',
        }));
        dispatch({ type: 'SET_MODELS', payload: options });
      })
      .catch(() => {});
  }, [dispatch]);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string }>({ src: '', alt: '' });

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Search modal state
  const [showSearch, setShowSearch] = useState(false);

  // Message refs for jump to message
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentRunIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Focus input on panel switch
  useEffect(() => {
    if (state.activePanel === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.activePanel]);

  // Handle voice transcript
  useEffect(() => {
    if (transcript) {
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    }
  }, [transcript]);

  // Handle voice error
  useEffect(() => {
    if (voiceError) {
      addToast('error', voiceError);
    }
  }, [voiceError, addToast]);

  // Subscribe to streaming events
  useEffect(() => {
    const unsubStream = subscribe('chat.stream', (params) => {
      const { sessionId, content, thinking, done, runId } = params as {
        sessionId: string;
        content?: string;
        thinking?: string;
        done?: boolean;
        runId?: string;
      };

      if (sessionId !== state.activeSessionId) {
        // Show notification for messages in other sessions
        if (done && state.notificationsEnabled && notificationPermission === 'granted' && document.hidden) {
          showNotification(t('notifications.newMessage'), {
            body: t('notifications.clickToView'),
            tag: sessionId,
          });
        }
        return;
      }

      if (done) {
        // Mark streaming complete
        const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) {
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: { id: lastAssistant.id, content: lastAssistant.content, isStreaming: false },
          });
        }
        dispatch({ type: 'SET_STREAMING', payload: false });
        if (runId) stopStreamingTimer(runId);
        currentRunIdRef.current = null;

        // Show notification if tab is not visible
        if (state.notificationsEnabled && notificationPermission === 'granted' && document.hidden) {
          showNotification(t('notifications.newMessage'), {
            body: t('notifications.clickToView'),
            tag: sessionId,
          });
        }
        return;
      }

      if (content !== undefined) {
        const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) {
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              id: lastAssistant.id,
              content: lastAssistant.content + content,
              thinking: thinking !== undefined ? thinking : lastAssistant.thinking,
              isStreaming: true,
            },
          });
        }
      }
    });

    const unsubError = subscribe('chat.error', (params) => {
      const { message } = params as { message: string };
      addToast('error', t('common.error'), message);
      dispatch({ type: 'SET_STREAMING', payload: false });
      clearAllStreamingTimers();
      currentRunIdRef.current = null;
    });

    return () => {
      unsubStream();
      unsubError();
    };
  }, [subscribe, state.activeSessionId, state.messages, dispatch, addToast, stopStreamingTimer, clearAllStreamingTimers, notificationPermission, showNotification, t, state.notificationsEnabled]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (state.isStreaming) return;

    let sessionId = state.activeSessionId;

    // Create session if needed
    if (!sessionId) {
      try {
        const result = await rpc('sessions.create', {
          title: text.slice(0, 50) || t('sessions.create'),
        });
        const session = result as { id: string; title?: string };
        if (session?.id) {
          sessionId = session.id;
          dispatch({
            type: 'ADD_SESSION',
            payload: {
              id: session.id,
              title: session.title,
              created_at: new Date().toISOString(),
            },
          });
          dispatch({ type: 'SET_ACTIVE_SESSION', payload: session.id });
        } else {
          addToast('error', t('chat.createSessionError'));
          return;
        }
      } catch {
        addToast('error', t('chat.createSessionError'));
        return;
      }
    }

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    setInput('');
    setAttachments([]);

    // Add placeholder assistant message
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
    dispatch({ type: 'SET_STREAMING', payload: true });

    // Track run for timeout
    const runId = generateId();
    currentRunIdRef.current = runId;
    const run: ChatRun = {
      id: runId,
      sessionId,
      startedAt: Date.now(),
    };
    dispatch({ type: 'ADD_PENDING_RUN', payload: run });
    startStreamingTimer(runId);

    // Send via RPC
    try {
      await rpc('chat.send', {
        sessionId,
        content: text,
        attachments: attachments.length > 0 ? attachments : undefined,
        thinking: state.thinkingEnabled,
        model: state.selectedModel || undefined,
      });
    } catch (err) {
      addToast('error', t('chat.sendError'), err instanceof Error ? err.message : t('common.error'));
      dispatch({ type: 'SET_STREAMING', payload: false });
      stopStreamingTimer(runId);
      currentRunIdRef.current = null;
    }
  }, [input, attachments, state.isStreaming, state.activeSessionId, state.thinkingEnabled, state.selectedModel, rpc, dispatch, addToast, startStreamingTimer, stopStreamingTimer, t]);

  const handleAbort = useCallback(() => {
    clearAllStreamingTimers();
    currentRunIdRef.current = null;
    dispatch({ type: 'SET_STREAMING', payload: false });
    // Mark last assistant message as done
    const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant' && m.isStreaming);
    if (lastAssistant) {
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: lastAssistant.id, content: lastAssistant.content, isStreaming: false },
      });
    }
    // Actually abort the chat run on the gateway
    rpc('chat.abort', {}).catch(() => {});
    addToast('info', t('chat.stopped'));
  }, [state.messages, dispatch, clearAllStreamingTimers, rpc, addToast, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      // Find the user message before this assistant message
      const idx = state.messages.findIndex((m) => m.id === messageId);
      if (idx <= 0) return;

      const userMsg = state.messages[idx - 1];
      if (userMsg.role !== 'user') return;

      // Remove messages from idx onwards
      dispatch({ type: 'SET_MESSAGES', payload: state.messages.slice(0, idx) });

      // Re-send
      setInput(userMsg.content);
      setTimeout(() => {
        setInput('');
        sendMessage();
      }, 0);
    },
    [state.messages, dispatch, sendMessage]
  );

  // File handling
  const processFiles = async (files: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file.size > 10 * 1024 * 1024) {
          addToast('warning', t('common.warning'), `${file.name} > 10MB`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          newAttachments.push({
            name: file.name,
            type: file.type,
            size: file.size,
            url: data.url || data.path,
          });
        }
      } catch (err) {
        console.error('File upload failed:', err);
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Image detection helper
  const isImageFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
  };

  // Open lightbox with image
  const openLightbox = (src: string, alt: string) => {
    setLightboxImage({ src, alt });
    setLightboxOpen(true);
  };

  // Close lightbox
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // Calculate total tokens
  const totalInputTokens = state.messages.reduce((sum, m) => sum + (m.tokens?.input || 0), 0);
  const totalOutputTokens = state.messages.reduce((sum, m) => sum + (m.tokens?.output || 0), 0);

  // Export functions
  const exportAsMarkdown = (messages: Message[]): string => {
    return messages.map(m => {
      const role = m.role === 'user' ? t('chat.user') : t('chat.assistant');
      const time = new Date(m.timestamp).toLocaleString();
      return `## ${role} (${time})\n\n${m.content}\n`;
    }).join('\n---\n\n');
  };

  const exportAsJson = (messages: Message[]): string => {
    return JSON.stringify({
      session: state.activeSessionId || 'unknown',
      exportedAt: new Date().toISOString(),
      messages: messages
    }, null, 2);
  };

  const exportAsTxt = (messages: Message[]): string => {
    return messages.map(m => {
      const role = m.role === 'user' ? t('chat.user') : t('chat.assistant');
      return `[${role}] ${m.content}`;
    }).join('\n\n');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: 'markdown' | 'json' | 'txt') => {
    if (state.messages.length === 0) {
      addToast('warning', t('chat.noMessages'));
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sessionName = state.activeSessionId ? state.activeSessionId.slice(0, 8) : 'chat';

    switch (format) {
      case 'markdown':
        downloadFile(exportAsMarkdown(state.messages), `chat-${sessionName}-${timestamp}.md`, 'text/markdown');
        addToast('success', t('chat.exportMarkdown'));
        break;
      case 'json':
        downloadFile(exportAsJson(state.messages), `chat-${sessionName}-${timestamp}.json`, 'application/json');
        addToast('success', t('chat.exportJson'));
        break;
      case 'txt':
        downloadFile(exportAsTxt(state.messages), `chat-${sessionName}-${timestamp}.txt`, 'text/plain');
        addToast('success', t('chat.exportTxt'));
        break;
    }
    setShowExportMenu(false);
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Jump to message handler
  const handleJumpToMessage = useCallback((messageId: string) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message briefly
      element.classList.add('bg-accent/5');
      setTimeout(() => {
        element.classList.remove('bg-accent/5');
      }, 2000);
    }
  }, []);

  // Set message ref
  const setMessageRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      messageRefs.current.set(id, el);
    } else {
      messageRefs.current.delete(id);
    }
  }, []);

  // Toggle voice recording
  const toggleVoiceRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {state.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-muted/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">{t('chat.title')}</h2>
            <p className="text-sm text-text-muted max-w-md">
              {t('chat.emptyState')}
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[t('chat.suggestion1'), t('chat.suggestion2'), t('chat.suggestion3')].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary hover:bg-border transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Messages header with export and search */}
            <div className="sticky top-0 z-10 flex items-center justify-end gap-2 px-4 py-2 bg-bg-primary/80 backdrop-blur-sm border-b border-border/50">
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {t('chat.search')}
              </button>
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('chat.export')}
                  <svg className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-bg-elevated border border-border rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => handleExport('markdown')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Markdown
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      JSON
                    </button>
                    <button
                      onClick={() => handleExport('txt')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      TXT
                    </button>
                  </div>
                )}
              </div>
            </div>
            {state.messages.map((msg) => (
              <div key={msg.id} ref={setMessageRef(msg.id)} className="transition-colors duration-500 rounded-lg">
                <MessageBubble
                  message={msg}
                  onCopy={() => addToast('success', t('chat.copySuccess'))}
                  onRegenerate={handleRegenerate}
                />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="fixed inset-0 bg-accent/5 border-2 border-dashed border-accent/30 z-30 flex items-center justify-center pointer-events-none">
            <div className="text-accent text-sm font-medium">{t('chat.dragDrop')}</div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border bg-bg-secondary shrink-0">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((att, idx) => (
              isImageFile(att.name) && att.url ? (
                // Image thumbnail preview
                <div
                  key={idx}
                  className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border bg-bg-elevated cursor-pointer"
                  onClick={() => openLightbox(att.url!, att.name)}
                >
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                    className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                // Non-image file card
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-secondary group"
                >
                  <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <span className="text-text-faint">{formatFileSize(att.size)}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="ml-1 text-text-faint hover:text-danger transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            ))}
          </div>
        )}

        {/* Token/context bar */}
        {(totalInputTokens > 0 || totalOutputTokens > 0) && (
          <div className="flex items-center gap-3 px-4 pt-2 text-[10px] text-text-faint">
            <span>{t('chat.inputTokens')}: {formatTokens(totalInputTokens)} tokens</span>
            <span>{t('chat.outputTokens')}: {formatTokens(totalOutputTokens)} tokens</span>
            <span>{state.messages.length} {t('sessions.messages')}</span>
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2 p-3">
          {/* Model selector */}
          {state.models.length > 0 && (
            <select
              value={state.selectedModel}
              onChange={(e) => dispatch({ type: 'SET_SELECTED_MODEL', payload: e.target.value })}
              className="px-2 py-2 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary outline-none focus:border-accent/50 transition-colors shrink-0 max-w-[120px]"
              title={t('chat.selectModel')}
            >
              <option value="">{t('chat.defaultModel')}</option>
              {state.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-bg-elevated rounded-lg transition-colors text-text-muted hover:text-text-secondary shrink-0"
            title={t('chat.uploadFile')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="w-full resize-none rounded-xl bg-bg-tertiary border border-border px-4 py-2.5 pr-24 text-sm text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            
            {/* Voice input button inside textarea */}
            <button
              onClick={toggleVoiceRecording}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                isRecording
                  ? 'bg-danger/20 text-danger animate-pulse'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
              }`}
              title={isRecording ? t('chat.stopRecording') : t('chat.voiceInput')}
            >
              {isRecording ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          </div>

          {/* Thinking toggle */}
          <button
            onClick={() => dispatch({ type: 'SET_THINKING_ENABLED', payload: !state.thinkingEnabled })}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              state.thinkingEnabled
                ? 'bg-purple/20 text-purple'
                : 'hover:bg-bg-elevated text-text-muted hover:text-text-secondary'
            }`}
            title={state.thinkingEnabled ? t('chat.thinkingOff') : t('chat.thinking')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>

          {/* Send / Abort */}
          {state.isStreaming ? (
            <button
              onClick={handleAbort}
              className="p-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors shrink-0"
              title={t('chat.stop')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim() && attachments.length === 0}
              className="p-2 rounded-lg bg-accent-muted/20 text-accent hover:bg-accent-muted/30 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('chat.send')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        src={lightboxImage.src}
        alt={lightboxImage.alt}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
      />

      {/* Search Modal */}
      <ChatSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        sessionKey={state.activeSessionId || undefined}
        onJumpToMessage={handleJumpToMessage}
        existingMessages={state.messages}
      />
    </div>
  );
}
