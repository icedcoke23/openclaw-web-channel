import React, { useEffect, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useApi } from '@/hooks/useApi';
import { formatTime } from '@/lib/markdown';
import type { DiscoveredGateway } from '@/types';
import Modal from '@/components/Modal';

function SignalStrength({ rssi }: { rssi?: number }) {
  if (rssi === undefined) return <span className="text-text-faint text-xs">--</span>;

  // Convert RSSI to signal strength indicator
  // -30 dBm = excellent, -50 dBm = good, -70 dBm = fair, -90 dBm = poor
  const getStrength = (rssi: number): { level: number; label: string; color: string } => {
    if (rssi >= -50) return { level: 4, label: '优秀', color: 'text-success' };
    if (rssi >= -60) return { level: 3, label: '良好', color: 'text-success' };
    if (rssi >= -70) return { level: 2, label: '一般', color: 'text-warning' };
    if (rssi >= -80) return { level: 1, label: '较弱', color: 'text-warning' };
    return { level: 0, label: '微弱', color: 'text-danger' };
  };

  const strength = getStrength(rssi);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-end gap-0.5 h-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-1 rounded-sm ${
              i < strength.level
                ? strength.color === 'text-success'
                  ? 'bg-success'
                  : strength.color === 'text-warning'
                  ? 'bg-warning'
                  : 'bg-danger'
                : 'bg-bg-elevated'
            }`}
            style={{ height: `${(i + 1) * 3}px` }}
          />
        ))}
      </div>
      <span className={`text-xs ${strength.color}`}>{strength.label}</span>
      <span className="text-xs text-text-faint">({rssi} dBm)</span>
    </div>
  );
}

interface ConnectModalProps {
  gateway: DiscoveredGateway | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (url: string, token: string) => void;
}

function ConnectModal({ gateway, isOpen, onClose, onConnect }: ConnectModalProps) {
  const [token, setToken] = useState('');

  if (!gateway) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(gateway.url, token);
    setToken('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="连接到网关">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">网关名称</label>
          <p className="text-text-primary font-medium">{gateway.name}</p>
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">URL</label>
          <p className="text-text-primary font-mono text-sm">{gateway.url}</p>
        </div>
        {gateway.version && (
          <div>
            <label className="block text-sm text-text-muted mb-1">版本</label>
            <p className="text-text-primary text-sm">{gateway.version}</p>
          </div>
        )}
        <div>
          <label className="block text-sm text-text-muted mb-1">访问令牌 (可选)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="输入网关访问令牌"
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-bg-elevated text-text-secondary hover:bg-bg-tertiary transition-colors text-sm font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium"
          >
            连接
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, token: string, name: string) => void;
}

function ManualAddModal({ isOpen, onClose, onAdd }: ManualAddModalProps) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      onAdd(url, token, name || '自定义网关');
      setUrl('');
      setToken('');
      setName('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="手动添加网关">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">
            网关名称 <span className="text-text-faint">(可选)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：生产环境网关"
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">
            WebSocket URL <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://localhost:18789"
            required
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
          <p className="text-xs text-text-faint mt-1">格式: ws://host:port 或 wss://host:port</p>
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">访问令牌 (可选)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="输入网关访问令牌"
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-bg-elevated text-text-secondary hover:bg-bg-tertiary transition-colors text-sm font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium"
          >
            添加
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function DiscoveryPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { addToast } = useApi();

  const [selectedGateway, setSelectedGateway] = useState<DiscoveredGateway | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [manualAddModalOpen, setManualAddModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiscovery = useCallback(async () => {
    try {
      const res = await fetch('/api/discovery');
      if (res.ok) {
        const data = await res.json();
        dispatch({
          type: 'SET_DISCOVERY',
          payload: {
            scanning: data.scanning,
            found: data.found || [],
            lastScan: data.lastScan,
          },
        });
      }
    } catch {
      // Silent fail
    }
  }, [dispatch]);

  // Auto-scan on mount
  useEffect(() => {
    loadDiscovery();
    // Start a discovery scan
    fetch('/api/discovery/refresh', { method: 'POST' }).catch(() => {});

    // Poll for updates while scanning
    const interval = setInterval(() => {
      if (state.discovery.scanning) {
        loadDiscovery();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [loadDiscovery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/discovery/refresh', { method: 'POST' });
      if (res.ok) {
        addToast('success', '正在扫描网关...');
        loadDiscovery();
      } else {
        addToast('error', '启动扫描失败');
      }
    } catch {
      addToast('error', '启动扫描失败');
    } finally {
      setRefreshing(false);
    }
  }, [addToast, loadDiscovery]);

  const handleConnect = useCallback(
    async (url: string, token: string) => {
      try {
        const res = await fetch('/api/discovery/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token }),
        });
        if (res.ok) {
          addToast('success', '网关连接已更新，请刷新页面');
        } else {
          const data = await res.json();
          addToast('error', data.error || '连接失败');
        }
      } catch {
        addToast('error', '连接失败');
      }
    },
    [addToast]
  );

  const handleManualAdd = useCallback(
    async (url: string, token: string, name: string) => {
      await handleConnect(url, token);
    },
    [handleConnect]
  );

  const openConnectModal = useCallback((gateway: DiscoveredGateway) => {
    setSelectedGateway(gateway);
    setConnectModalOpen(true);
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">网关发现</h1>
          <p className="text-xs text-text-muted mt-1">
            {state.discovery.scanning
              ? '正在扫描网络中的网关...'
              : state.discovery.found.length > 0
              ? `发现 ${state.discovery.found.length} 个网关`
              : '点击刷新开始扫描'}
            {state.discovery.lastScan && (
              <span className="ml-2">
                上次扫描: {formatTime(new Date(state.discovery.lastScan).getTime())}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setManualAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            手动添加
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing || state.discovery.scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-xs text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {state.discovery.scanning ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                扫描中...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                刷新
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scanning indicator */}
      {state.discovery.scanning && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">正在扫描网络...</p>
              <p className="text-xs text-text-muted">正在搜索本地网络中的 OpenClaw 网关</p>
            </div>
          </div>
        </div>
      )}

      {/* Gateways list */}
      {state.discovery.found.length === 0 && !state.discovery.scanning ? (
        <div className="text-center py-16 text-text-faint">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
          </svg>
          <p className="text-sm">未发现网关</p>
          <p className="text-xs mt-1">点击刷新按钮开始扫描</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.discovery.found.map((gateway) => (
            <div
              key={gateway.id}
              className="bg-bg-tertiary border border-border rounded-xl p-4 hover:border-accent/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">{gateway.name}</h3>
                      <p className="text-xs text-text-faint font-mono">{gateway.url}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <SignalStrength rssi={gateway.rssi} />
                    {gateway.version && (
                      <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted">
                        版本: {gateway.version}
                      </span>
                    )}
                    <span className="text-xs text-text-faint">
                      发现于: {formatTime(new Date(gateway.lastSeen).getTime())}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openConnectModal(gateway)}
                  className="px-4 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium shrink-0"
                >
                  连接
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConnectModal
        gateway={selectedGateway}
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onConnect={handleConnect}
      />

      <ManualAddModal
        isOpen={manualAddModalOpen}
        onClose={() => setManualAddModalOpen(false)}
        onAdd={handleManualAdd}
      />
    </div>
  );
}
