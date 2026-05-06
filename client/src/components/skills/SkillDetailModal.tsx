import React, { useEffect, useState, useCallback } from 'react';
import Modal from '@/components/Modal';
import { useApi } from '@/hooks/useApi';
import type { Skill } from '@/types';

interface SkillDetail {
  name: string;
  version: string;
  category: string;
  description: string;
  enabled: boolean;
  readme?: string;
  parameters?: Parameter[];
  examples?: Example[];
  author?: string;
  repository?: string;
}

interface Parameter {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
}

interface Example {
  title?: string;
  description?: string;
  code?: string;
  input?: string;
  output?: string;
}

interface SkillDetailModalProps {
  skill: Skill | null;
  open: boolean;
  onClose: () => void;
  onToggle: (skill: Skill, enabled: boolean) => void;
}

export default function SkillDetailModal({ skill, open, onClose, onToggle }: SkillDetailModalProps) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const { get, addToast } = useApi();

  const loadDetail = useCallback(async () => {
    if (!skill) return;
    setLoading(true);
    try {
      const res = await get<SkillDetail>(`/skills/${encodeURIComponent(skill.name)}`);
      if (res.ok && res.data) {
        setDetail(res.data);
      } else {
        // Fallback to basic skill info
        setDetail({
          name: skill.name,
          version: skill.version || '1.0.0',
          category: skill.category || 'general',
          description: skill.description || '',
          enabled: skill.enabled,
        });
      }
    } catch {
      addToast('error', '加载技能详情失败');
      setDetail({
        name: skill.name,
        version: skill.version || '1.0.0',
        category: skill.category || 'general',
        description: skill.description || '',
        enabled: skill.enabled,
      });
    } finally {
      setLoading(false);
    }
  }, [skill, get, addToast]);

  useEffect(() => {
    if (open && skill) {
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [open, skill, loadDetail]);

  const handleToggle = useCallback(() => {
    if (!skill) return;
    const newEnabled = !skill.enabled;
    onToggle(skill, newEnabled);
    // Update local detail state
    if (detail) {
      setDetail({ ...detail, enabled: newEnabled });
    }
  }, [skill, detail, onToggle]);

  // Simple markdown renderer for README
  const renderMarkdown = (markdown: string): string => {
    if (!markdown) return '';
    return markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-text-primary mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold text-text-primary mt-6 mb-3">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-medium text-text-primary mt-4 mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-text-primary">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-text-secondary">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-bg-elevated text-accent text-sm font-mono">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-bg-primary border border-border rounded-lg p-4 overflow-x-auto my-4"><code class="text-sm font-mono text-text-secondary">$1</code></pre>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 text-text-secondary">$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">$1</a>')
      .replace(/\n/g, '<br />');
  };

  if (!skill) return null;

  const displayDetail = detail || {
    name: skill.name,
    version: skill.version || '1.0.0',
    category: skill.category || 'general',
    description: skill.description || '',
    enabled: skill.enabled,
  };

  return (
    <Modal open={open} onClose={onClose} title={displayDetail.name} maxWidth="max-w-3xl">
      <div className="space-y-6">
        {/* Header info */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted">
                v{displayDetail.version}
              </span>
              {displayDetail.category && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple/10 text-purple">
                  {displayDetail.category}
                </span>
              )}
              {displayDetail.author && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-muted/20 text-accent">
                  @{displayDetail.author}
                </span>
              )}
            </div>
            {displayDetail.description && (
              <p className="text-sm text-text-secondary">{displayDetail.description}</p>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-text-muted">
              {displayDetail.enabled ? '已启用' : '已禁用'}
            </span>
            <button
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                displayDetail.enabled ? 'bg-accent-muted' : 'bg-bg-elevated'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  displayDetail.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-text-muted text-sm">加载详情中...</div>
          </div>
        )}

        {/* Repository link */}
        {displayDetail.repository && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-elevated">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <a
              href={displayDetail.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline truncate"
            >
              {displayDetail.repository}
            </a>
          </div>
        )}

        {/* Parameters Table */}
        {displayDetail.parameters && displayDetail.parameters.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">参数配置</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-text-muted font-medium">参数名</th>
                    <th className="text-left py-2 px-3 text-text-muted font-medium">类型</th>
                    <th className="text-left py-2 px-3 text-text-muted font-medium">必填</th>
                    <th className="text-left py-2 px-3 text-text-muted font-medium">描述</th>
                  </tr>
                </thead>
                <tbody>
                  {displayDetail.parameters.map((param, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-0">
                      <td className="py-2 px-3">
                        <code className="text-accent font-mono">{param.name}</code>
                      </td>
                      <td className="py-2 px-3 text-text-secondary">{param.type}</td>
                      <td className="py-2 px-3">
                        {param.required ? (
                          <span className="text-danger">是</span>
                        ) : (
                          <span className="text-text-faint">否</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">{param.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Examples */}
        {displayDetail.examples && displayDetail.examples.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">使用示例</h4>
            <div className="space-y-3">
              {displayDetail.examples.map((example, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-bg-elevated border border-border">
                  {example.title && (
                    <h5 className="text-xs font-medium text-text-primary mb-2">{example.title}</h5>
                  )}
                  {example.description && (
                    <p className="text-xs text-text-muted mb-2">{example.description}</p>
                  )}
                  {example.code && (
                    <pre className="bg-bg-primary rounded p-2 overflow-x-auto">
                      <code className="text-xs font-mono text-text-secondary">{example.code}</code>
                    </pre>
                  )}
                  {example.input && (
                    <div className="mt-2">
                      <span className="text-[10px] text-text-faint uppercase">输入:</span>
                      <code className="block text-xs font-mono text-text-secondary mt-1 bg-bg-primary rounded p-2">
                        {example.input}
                      </code>
                    </div>
                  )}
                  {example.output && (
                    <div className="mt-2">
                      <span className="text-[10px] text-text-faint uppercase">输出:</span>
                      <code className="block text-xs font-mono text-text-secondary mt-1 bg-bg-primary rounded p-2">
                        {example.output}
                      </code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* README */}
        {displayDetail.readme && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">文档</h4>
            <div
              className="markdown-body text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(displayDetail.readme) }}
            />
          </div>
        )}

        {/* No additional info message */}
        {!loading &&
          !displayDetail.readme &&
          (!displayDetail.parameters || displayDetail.parameters.length === 0) &&
          (!displayDetail.examples || displayDetail.examples.length === 0) && (
            <div className="text-center py-8 text-text-faint text-sm">
              暂无更多详细信息
            </div>
          )}
      </div>
    </Modal>
  );
}
