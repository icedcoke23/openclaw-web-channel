import React, { useRef, useEffect, useMemo, useState } from 'react';
import type { Message } from '@/types';
import { renderMarkdown, enhanceCodeBlocks, copyToClipboard } from '@/lib/markdown';
import Lightbox from '@/components/Lightbox';
import { CanvasMessageRenderer } from './CanvasRenderer';

interface MessageBubbleProps {
  message: Message;
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export default function MessageBubble({ message, onCopy, onRegenerate }: MessageBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string }>({ src: '', alt: '' });

  const renderedContent = useMemo(() => renderMarkdown(message.content), [message.content]);

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

  useEffect(() => {
    if (contentRef.current) {
      enhanceCodeBlocks(contentRef.current);

      // Add click handlers for markdown images
      const images = contentRef.current.querySelectorAll('img[data-lightbox="true"]');
      images.forEach((img) => {
        img.addEventListener('click', () => {
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || '';
          openLightbox(src, alt);
        });
      });
    }
  }, [renderedContent]);

  const handleCopy = async () => {
    await copyToClipboard(message.content);
    onCopy?.(message.content);
  };

  const timeStr = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isSystem) {
    return (
      <div className="flex justify-center py-2 animate-fade-in">
        <div className="px-3 py-1.5 rounded-full bg-bg-elevated text-xs text-text-muted">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex gap-3 py-4 px-4 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${
          isUser
            ? 'bg-accent-muted/20 text-accent'
            : 'bg-purple/20 text-purple'
        }`}
      >
        {isUser ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 min-w-0 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-medium text-text-muted">
            {isUser ? '你' : 'AI 助手'}
          </span>
          <span className="text-[10px] text-text-faint">{timeStr}</span>
          {message.model && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-faint">
              {message.model}
            </span>
          )}
        </div>

        {/* Thinking block */}
        {message.thinking && (
          <div className="thinking-block mb-2 animate-fade-in">
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-purple">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              思考过程
            </div>
            <div className="text-xs text-text-muted whitespace-pre-wrap">{message.thinking}</div>
          </div>
        )}

        {/* Content bubble */}
        {isUser ? (
          <div className="px-4 py-2.5 rounded-2xl rounded-tr-md bg-accent-muted/20 text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <>
            {/* Canvas rendering */}
            <CanvasMessageRenderer content={message.content} />
            <div
              ref={contentRef}
              className="markdown-body text-sm text-text-secondary"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          </>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 mt-2 ${isUser ? 'justify-end' : ''}`}>
            {message.attachments.map((att, idx) => (
              isImageFile(att.name) && att.url ? (
                // Image thumbnail preview
                <div
                  key={idx}
                  className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border bg-bg-elevated cursor-pointer"
                  onClick={() => openLightbox(att.url!, att.name)}
                >
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ) : (
                // Non-image file card
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated text-xs text-text-muted"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="truncate max-w-[150px]">{att.name}</span>
                </div>
              )
            ))}
          </div>
        )}

        {/* Token info */}
        {message.tokens && (message.tokens.input || message.tokens.output) && (
          <div className={`flex items-center gap-2 mt-1 text-[10px] text-text-faint ${isUser ? 'justify-end' : ''}`}>
            {message.tokens.input && <span>输入: {message.tokens.input}</span>}
            {message.tokens.output && <span>输出: {message.tokens.output}</span>}
          </div>
        )}

        {/* Action buttons */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-bg-elevated rounded text-text-faint hover:text-text-secondary transition-colors"
              title="复制"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="p-1 hover:bg-bg-elevated rounded text-text-faint hover:text-text-secondary transition-colors"
                title="重新生成"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Streaming cursor */}
        {message.isStreaming && (
          <div className="typing-indicator mt-1">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        src={lightboxImage.src}
        alt={lightboxImage.alt}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
      />
    </div>
  );
}
