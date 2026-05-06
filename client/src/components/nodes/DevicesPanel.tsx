import React, { useEffect, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useApi } from '@/hooks/useApi';
import { formatTime } from '@/lib/markdown';
import type { Device, DeviceStatus, DeviceType } from '@/types';
import Modal from '@/components/Modal';

const STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  pending: { label: '待审批', color: 'text-warning', bgColor: 'bg-warning/10', dotColor: 'bg-warning' },
  approved: { label: '已批准', color: 'text-success', bgColor: 'bg-success/10', dotColor: 'bg-success' },
  revoked: { label: '已撤销', color: 'text-danger', bgColor: 'bg-danger/10', dotColor: 'bg-danger' },
};

const TYPE_CONFIG: Record<DeviceType, { label: string; icon: React.ReactNode }> = {
  mobile: {
    label: '移动设备',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  desktop: {
    label: '桌面设备',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  web: {
    label: 'Web浏览器',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
};

interface DeviceDetailModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onRevoke: (id: string) => void;
  onRotate: (id: string) => void;
}

function DeviceDetailModal({ device, isOpen, onClose, onApprove, onRevoke, onRotate }: DeviceDetailModalProps) {
  if (!device) return null;

  const statusCfg = STATUS_CONFIG[device.status];
  const typeCfg = TYPE_CONFIG[device.type];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="设备详情">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            {typeCfg.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{device.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${statusCfg.dotColor}`} />
              <span className={`text-sm ${statusCfg.color}`}>{statusCfg.label}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-muted">设备ID</span>
            <p className="text-text-primary font-mono mt-1">{device.id}</p>
          </div>
          <div>
            <span className="text-text-muted">设备类型</span>
            <p className="text-text-primary mt-1">{typeCfg.label}</p>
          </div>
          <div>
            <span className="text-text-muted">IP地址</span>
            <p className="text-text-primary font-mono mt-1">{device.ipAddress}</p>
          </div>
          <div>
            <span className="text-text-muted">配对时间</span>
            <p className="text-text-primary mt-1">{formatTime(new Date(device.pairedAt).getTime())}</p>
          </div>
          <div>
            <span className="text-text-muted">最后活跃</span>
            <p className="text-text-primary mt-1">{formatTime(new Date(device.lastSeen).getTime())}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border">
          {device.status === 'pending' && (
            <button
              onClick={() => {
                onApprove(device.id);
                onClose();
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors text-sm font-medium"
            >
              批准配对
            </button>
          )}
          {device.status === 'approved' && (
            <button
              onClick={() => {
                onRevoke(device.id);
                onClose();
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors text-sm font-medium"
            >
              撤销访问
            </button>
          )}
          {device.status === 'revoked' && (
            <button
              onClick={() => {
                onApprove(device.id);
                onClose();
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors text-sm font-medium"
            >
              重新批准
            </button>
          )}
          <button
            onClick={() => {
              onRotate(device.id);
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-bg-elevated text-text-secondary hover:bg-bg-tertiary transition-colors text-sm font-medium"
          >
            轮换令牌
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function DevicesPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { addToast } = useApi();

  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'all'>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nodes/devices');
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'SET_DEVICES', payload: (data.devices as Device[]) || [] });
      } else {
        addToast('error', '加载设备列表失败');
      }
    } catch {
      addToast('error', '加载设备列表失败');
    } finally {
      setLoading(false);
    }
  }, [dispatch, addToast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/nodes/devices/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'UPDATE_DEVICE', payload: data.device });
        addToast('success', '设备已批准');
      } else {
        addToast('error', '批准设备失败');
      }
    } catch {
      addToast('error', '批准设备失败');
    }
  }, [dispatch, addToast]);

  const handleRevoke = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/nodes/devices/${id}/revoke`, { method: 'POST' });
      if (res.ok) {
        const device = state.devices.find(d => d.id === id);
        if (device) {
          dispatch({ type: 'UPDATE_DEVICE', payload: { ...device, status: 'revoked' } });
        }
        addToast('success', '设备访问已撤销');
      } else {
        addToast('error', '撤销设备访问失败');
      }
    } catch {
      addToast('error', '撤销设备访问失败');
    }
  }, [dispatch, addToast, state.devices]);

  const handleRotate = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/nodes/devices/${id}/rotate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'UPDATE_DEVICE', payload: data.device });
        addToast('success', '设备令牌已轮换');
      } else {
        addToast('error', '轮换令牌失败');
      }
    } catch {
      addToast('error', '轮换令牌失败');
    }
  }, [dispatch, addToast]);

  const openDetailModal = useCallback((device: Device) => {
    setSelectedDevice(device);
    setDetailModalOpen(true);
  }, []);

  const filteredDevices = state.devices.filter((device) => {
    if (statusFilter !== 'all' && device.status !== statusFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        device.name.toLowerCase().includes(q) ||
        device.id.toLowerCase().includes(q) ||
        device.ipAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = state.devices.filter((d) => d.status === 'pending').length;
  const approvedCount = state.devices.filter((d) => d.status === 'approved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">设备管理</h1>
          <p className="text-xs text-text-muted mt-1">
            共 {state.devices.length} 个设备，{approvedCount} 个已批准，{pendingCount} 个待审批
          </p>
        </div>
        <button
          onClick={loadDevices}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'approved', 'revoked'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-accent-muted/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {status === 'all' ? '全部' : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[150px] max-w-xs">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索设备..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* Devices list */}
      {filteredDevices.length === 0 ? (
        <div className="text-center py-16 text-text-faint text-sm">
          {searchText || statusFilter !== 'all' ? '没有匹配的设备' : '暂无设备'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDevices.map((device) => {
            const statusCfg = STATUS_CONFIG[device.status];
            const typeCfg = TYPE_CONFIG[device.type];
            return (
              <div
                key={device.id}
                className="bg-bg-tertiary border border-border rounded-xl p-4 hover:border-accent/20 transition-colors cursor-pointer"
                onClick={() => openDetailModal(device)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${statusCfg.dotColor}`} />
                      <h3 className="text-sm font-medium text-text-primary">{device.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusCfg.bgColor} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="text-xs text-text-faint mb-2">
                      ID: {device.id}
                      <span className="ml-3">IP: {device.ipAddress}</span>
                      <span className="ml-3">最后活跃: {formatTime(new Date(device.lastSeen).getTime())}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-faint">
                        {typeCfg.icon}
                        {typeCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {device.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(device.id);
                        }}
                        className="p-1.5 hover:bg-success/10 rounded-md text-text-muted hover:text-success transition-colors"
                        title="批准"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    {device.status === 'approved' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevoke(device.id);
                        }}
                        className="p-1.5 hover:bg-danger/10 rounded-md text-text-muted hover:text-danger transition-colors"
                        title="撤销"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotate(device.id);
                      }}
                      className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-accent transition-colors"
                      title="轮换令牌"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeviceDetailModal
        device={selectedDevice}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onApprove={handleApprove}
        onRevoke={handleRevoke}
        onRotate={handleRotate}
      />
    </div>
  );
}
