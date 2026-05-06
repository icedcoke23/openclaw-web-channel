import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

// Custom renderer for marked v12 — override code block rendering with highlight.js
const renderer = new Marked.Renderer();

renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  const langLabel = lang || '';
  return `<div class="code-block">
    <div class="code-header">
      <span class="code-lang">${langLabel}</span>
      <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block').querySelector('code').textContent)">复制</button>
    </div>
    <pre><code class="hljs language-${language}">${highlighted}</code></pre>
  </div>`;
};

const markedInstance = new Marked({ renderer, breaks: true, gfm: true });

/**
 * Render markdown to sanitized HTML.
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';

  const rawHtml = markedInstance.parse(content) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['div', 'pre', 'code', 'span', 'p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'button', 'input'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'src', 'alt', 'onclick', 'type', 'checked', 'disabled'],
  });
}

/**
 * Enhance rendered HTML with copy buttons and language labels for code blocks.
 * Call this after inserting the HTML into the DOM.
 */
export function enhanceCodeBlocks(container: HTMLElement): void {
  const preBlocks = container.querySelectorAll('pre');

  preBlocks.forEach((pre) => {
    // Skip if already enhanced
    if (pre.querySelector('.code-header')) return;

    const code = pre.querySelector('code');
    if (!code) return;

    // Detect language
    const langClass = Array.from(code.classList).find((c) => c.startsWith('language-') || c.startsWith('hljs'));
    const lang = langClass ? langClass.replace(/^(language-|hljs)/, '') : '';

    // Create header
    const header = document.createElement('div');
    header.className = 'code-header flex items-center justify-between px-4 py-2 text-xs text-text-muted border-b border-border bg-bg-secondary rounded-t-lg -mb-1';

    const langLabel = document.createElement('span');
    langLabel.textContent = lang || 'code';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn hover:text-accent transition-colors';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', () => {
      const text = code.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '已复制!';
        setTimeout(() => {
          copyBtn.textContent = '复制';
        }, 2000);
      });
    });

    header.appendChild(langLabel);
    header.appendChild(copyBtn);

    // Wrap pre in a container
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper relative my-3';
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    // Adjust pre border radius
    pre.classList.remove('rounded-lg');
    pre.classList.add('rounded-b-lg', 'rounded-t-none');
  });
}

/**
 * Copy text to clipboard and return success status.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format token count for display.
 */
export function formatTokens(count: number | undefined): string {
  if (!count) return '';
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format a timestamp to a human-readable string.
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Debounce function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
