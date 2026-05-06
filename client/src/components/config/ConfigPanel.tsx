import React, { useEffect, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';
import Modal from '@/components/Modal';
import DiffView from './DiffView';
import type { ConfigEntry, ConfigSchema } from '@/types';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';

export default function ConfigPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rpc } = useWebSocket();
  const { addToast } = useApi();

  const [loading, setLoading] = useState(true);
  const [jsonInput, setJsonInput] = useState('');
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [injectMessage, setInjectMessage] = useState('');
  const [showInject, setShowInject] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<string>('');
  const [pendingConfig, setPendingConfig] = useState<string>('');
  const [jsonError, setJsonError] = useState<{ message: string; line?: number } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, schemaRes] = await Promise.allSettled([
        rpc('config.get'),
        rpc('config.schema.lookup'),
      ]);

      if (configRes.status === 'fulfilled' && configRes.value) {
        const config = configRes.value as Record<string, unknown>;
        const entries: ConfigEntry[] = Object.entries(config).map(([key, value]) => ({
          key,
          value,
        }));
        dispatch({ type: 'SET_CONFIG', payload: entries });
        const jsonStr = JSON.stringify(config, null, 2);
        setJsonInput(jsonStr);
        setOriginalConfig(jsonStr);
        validateJson(jsonStr);
      }

      if (schemaRes.status === 'fulfilled' && schemaRes.value) {
        dispatch({ type: 'SET_CONFIG_SCHEMA', payload: (schemaRes.value as ConfigSchema[]) || [] });
      }
    } catch {
      addToast('error', '加载配置失败');
    } finally {
      setLoading(false);
    }
  }, [rpc, dispatch, addToast]);

  const validateJson = useCallback((value: string): { valid: boolean; error?: string; line?: number } => {
    try {
      JSON.parse(value);
      setJsonError(null);
      return { valid: true };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'JSON 格式错误';
      const match = errorMsg.match(/position (\d+)/);
      let line = 1;
      if (match) {
        const position = parseInt(match[1], 10);
        // 计算行号
        const lines = value.substring(0, position).split('\n');
        line = lines.length;
      }
      setJsonError({ message: errorMsg, line });
      return { valid: false, error: errorMsg, line };
    }
  }, []);

  const handleJsonChange = useCallback((value: string) => {
    setJsonInput(value);
    validateJson(value);
  }, [validateJson]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const prepareConfigObject = useCallback((): { config: Record<string, unknown>; json: string } => {
    let configObj: Record<string, unknown>;
    if (activeTab === 'json') {
      configObj = JSON.parse(jsonInput);
    } else {
      configObj = {};
      state.config.forEach((entry) => {
        configObj[entry.key] = entry.value;
      });
    }
    return { config: configObj, json: JSON.stringify(configObj, null, 2) };
  }, [activeTab, jsonInput, state.config]);

  const handleSaveClick = useCallback(() => {
    try {
      const { json } = prepareConfigObject();
      setPendingConfig(json);
      setShowDiff(true);
    } catch (err) {
      if (err instanceof SyntaxError) {
        addToast('error', 'JSON 格式错误', err.message);
      } else {
        addToast('error', '准备配置失败', err instanceof Error ? err.message : '未知错误');
      }
    }
  }, [prepareConfigObject, addToast]);

  const confirmSaveConfig = useCallback(async () => {
    try {
      const { config } = prepareConfigObject();
      await rpc('config.set', { config });
      addToast('success', '配置已保存');
      setShowDiff(false);
      setOriginalConfig(pendingConfig);
      loadConfig();
    } catch (err) {
      if (err instanceof SyntaxError) {
        addToast('error', 'JSON 格式错误', err.message);
      } else {
        addToast('error', '保存配置失败', err instanceof Error ? err.message : '未知错误');
      }
    }
  }, [prepareConfigObject, pendingConfig, rpc, addToast, loadConfig]);

  const cancelSaveConfig = useCallback(() => {
    setShowDiff(false);
    setPendingConfig('');
  }, []);

  // Legacy saveConfig for backward compatibility (direct save without diff)
  const saveConfig = useCallback(async () => {
    handleSaveClick();
  }, [handleSaveClick]);

  const updateFormValue = useCallback(
    (key: string, value: unknown) => {
      dispatch({
        type: 'SET_CONFIG',
        payload: state.config.map((c) => (c.key === key ? { ...c, value } : c)),
      });
    },
    [dispatch, state.config]
  );

  const injectSystemMessage = useCallback(async () => {
    if (!injectMessage.trim()) return;
    try {
      await rpc('chat.inject', {
        role: 'system',
        content: injectMessage,
      });
      addToast('success', '系统消息已注入');
      setInjectMessage('');
      setShowInject(false);
    } catch {
      addToast('error', '注入消息失败');
    }
  }, [rpc, injectMessage, addToast]);

  const getSchemaForKey = (key: string): ConfigSchema | undefined => {
    return state.configSchema.find((s) => s.key === key);
  };

  const renderFormInput = (entry: ConfigEntry) => {
    const schema = getSchemaForKey(entry.key);
    const type = schema?.type || typeof entry.value;

    if (type === 'boolean') {
      return (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={entry.value as boolean}
            onChange={(e) => updateFormValue(entry.key, e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-faint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-muted peer-checked:after:bg-accent" />
        </label>
      );
    }

    if (type === 'number') {
      return (
        <input
          type="number"
          value={entry.value as number}
          onChange={(e) => updateFormValue(entry.key, Number(e.target.value))}
          className="w-full px-3 py-1.5 rounded-lg bg-bg-primary border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-colors"
        />
      );
    }

    if (schema?.enum) {
      return (
        <select
          value={String(entry.value)}
          onChange={(e) => updateFormValue(entry.key, e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-bg-primary border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-colors"
        >
          {schema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'object' || type === 'array') {
      return (
        <textarea
          value={JSON.stringify(entry.value, null, 2)}
          onChange={(e) => {
            try {
              updateFormValue(entry.key, JSON.parse(e.target.value));
            } catch {
              // keep invalid json in view
            }
          }}
          rows={4}
          className="w-full px-3 py-1.5 rounded-lg bg-bg-primary border border-border text-sm text-text-primary font-mono outline-none focus:border-accent/50 transition-colors resize-y"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(entry.value ?? '')}
        onChange={(e) => updateFormValue(entry.key, e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg bg-bg-primary border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-colors"
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">配置管理</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInject(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/10 text-xs text-purple hover:bg-purple/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            注入消息
          </button>
          <button
            onClick={loadConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
          <button
            onClick={saveConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-muted/20 text-xs text-accent hover:bg-accent-muted/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            保存
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-bg-tertiary rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('form')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'form' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          表单模式
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'json' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          JSON 模式
        </button>
      </div>

      {/* Form view */}
      {activeTab === 'form' && (
        <div className="space-y-3">
          {state.config.length === 0 ? (
            <div className="text-center py-8 text-text-faint text-sm">暂无配置项</div>
          ) : (
            state.config.map((entry) => {
              const schema = getSchemaForKey(entry.key);
              return (
                <div key={entry.key} className="bg-bg-tertiary border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-primary font-mono">{entry.key}</label>
                    {schema?.type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-faint">
                        {schema.type}
                      </span>
                    )}
                  </div>
                  {schema?.description && (
                    <p className="text-xs text-text-muted mb-2">{schema.description}</p>
                  )}
                  {renderFormInput(entry)}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* JSON view */}
      {activeTab === 'json' && (
        <div className="space-y-2">
          <div className="bg-bg-tertiary border border-border rounded-xl overflow-hidden">
            <div className="relative">
              <Editor
                value={jsonInput}
                onValueChange={handleJsonChange}
                highlight={code => highlight(code, languages.json, 'json')}
                padding={16}
                className="font-mono text-sm min-h-[400px]"
                textareaClassName="focus:outline-none"
                style={{
                  fontFamily: '"Fira Code", "Monaco", "Consolas", monospace',
                  fontSize: 14,
                  backgroundColor: 'transparent',
                  color: '#e2e8f0',
                }}
              />
            </div>
          </div>
          {jsonError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20">
              <svg className="w-4 h-4 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-danger font-medium">JSON 语法错误 {jsonError.line && `(第 ${jsonError.line} 行)`}</p>
                <p className="text-xs text-text-muted mt-0.5 truncate">{jsonError.message}</p>
              </div>
            </div>
          )}
          {!jsonError && jsonInput && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/20">
              <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-success font-medium">JSON 格式有效</p>
            </div>
          )}
        </div>
      )}

      {/* Inject message modal */}
      <Modal open={showInject} onClose={() => setShowInject(false)} title="注入系统消息" maxWidth="max-w-md">
        <p className="text-xs text-text-muted mb-3">
          此消息将作为系统消息注入到当前会话上下文中
        </p>
        <textarea
          value={injectMessage}
          onChange={(e) => setInjectMessage(e.target.value)}
          rows={5}
          placeholder="输入系统消息内容..."
          className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-colors resize-y mb-3"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowInject(false)}
            className="px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            取消
          </button>
          <button
            onClick={injectSystemMessage}
            disabled={!injectMessage.trim()}
            className="px-3 py-1.5 rounded-lg bg-accent-muted/20 text-xs text-accent hover:bg-accent-muted/30 transition-colors disabled:opacity-40"
          >
            注入
          </button>
        </div>
      </Modal>

      {/* Diff Preview Modal */}
      <Modal open={showDiff} onClose={cancelSaveConfig} title="配置变更预览" maxWidth="max-w-4xl">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            请查看以下配置变更，确认后保存将生效
          </p>

          <DiffView
            oldValue={originalConfig}
            newValue={pendingConfig}
            showLineNumbers={true}
            splitView={false}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              onClick={cancelSaveConfig}
              className="px-4 py-2 rounded-lg bg-bg-elevated text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              取消
            </button>
            <button
              onClick={confirmSaveConfig}
              className="px-4 py-2 rounded-lg bg-accent-muted/20 text-sm text-accent hover:bg-accent-muted/30 transition-colors"
            >
              确认保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
