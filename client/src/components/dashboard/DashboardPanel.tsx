import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useApi } from '@/hooks/useApi';
import { formatTime } from '@/lib/markdown';
import type { Channel, CronJob, ActivityItem, DiskUsage } from '@/types';

function StatCard({
  label,
  value,
  icon,
  color = 'text-accent',
  bgColor = 'bg-accent/10',
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  bgColor?: string;
}) {
  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function DashboardPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { addToast } = useApi();
  const [loading, setLoading] = useState(true);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, channelsRes, cronRes] = await Promise.allSettled([
        fetch('/api/status').then((r) => r.json()),
        fetch('/api/channels').then((r) => r.json()),
        fetch('/api/cron').then((r) => r.json()),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value) {
        const s = statusRes.value as {
          version?: string;
          uptime?: number;
          sessions?: number;
          cpu?: number;
          memory?: number;
          model?: string;
          disk?: DiskUsage;
        };
        dispatch({
          type: 'SET_GATEWAY_STATUS',
          payload: {
            status: state.connectionStatus,
            version: s.version,
            uptime: s.uptime,
            sessions: s.sessions,
            cpu: s.cpu,
            memory: s.memory,
            model: s.model,
            disk: s.disk,
          },
        });
        if (s.disk) {
          setDiskUsage(s.disk);
        }
      }

      if (channelsRes.status === 'fulfilled' && channelsRes.value) {
        const channelsData = Array.isArray(channelsRes.value) ? channelsRes.value : [];
        dispatch({ type: 'SET_CHANNELS', payload: (channelsData as Channel[]) || [] });
      }

      if (cronRes.status === 'fulfilled' && cronRes.value) {
        const cronData = Array.isArray(cronRes.value) ? cronRes.value : [];
        dispatch({ type: 'SET_CRON_JOBS', payload: (cronData as CronJob[]) || [] });
      }
    } catch {
      // Some endpoints may not exist
    } finally {
      setLoading(false);
    }
  }, [dispatch, state.connectionStatus]);

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 30000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}天 ${h}小时`;
    if (h > 0) return `${h}小时 ${m}分钟`;
    return `${m}分钟`;
  };

  const formatBytes = (bytes?: number): string => {
    if (bytes === undefined || bytes === null) return '-';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  const getDiskColorClass = (usagePercent: number): { bar: string; text: string } => {
    if (usagePercent > 85) return { bar: 'bg-danger', text: 'text-danger' };
    if (usagePercent >= 70) return { bar: 'bg-warning', text: 'text-warning' };
    return { bar: 'bg-success', text: 'text-success' };
  };

  const diskColors = useMemo(() => {
    if (!diskUsage) return { bar: 'bg-success', text: 'text-success' };
    return getDiskColorClass(diskUsage.usagePercent);
  }, [diskUsage]);

  const activityIcons: Record<string, string> = {
    message: '💬',
    session: '📁',
    config: '⚙️',
    skill: '🧩',
    node: '🔌',
    error: '❌',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">仪表盘</h1>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="网关状态"
          value={state.connectionStatus === 'connected' ? '在线' : state.connectionStatus === 'connecting' ? '连接中' : '离线'}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          }
          color={state.connectionStatus === 'connected' ? 'text-success' : 'text-danger'}
          bgColor={state.connectionStatus === 'connected' ? 'bg-success/10' : 'bg-danger/10'}
        />
        <StatCard
          label="版本"
          value={state.gatewayStatus?.version || '-'}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          }
        />
        <StatCard
          label="运行时间"
          value={formatUptime(state.gatewayStatus?.uptime)}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="会话数"
          value={state.gatewayStatus?.sessions ?? state.sessions.length}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
        />
      </div>

      {/* CPU & Memory & Disk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-bg-tertiary border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">CPU 使用率</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${state.gatewayStatus?.cpu ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-mono text-text-muted w-12 text-right">
              {state.gatewayStatus?.cpu ?? 0}%
            </span>
          </div>
        </div>
        <div className="bg-bg-tertiary border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">内存使用率</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-purple rounded-full transition-all duration-500"
                style={{ width: `${state.gatewayStatus?.memory ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-mono text-text-muted w-12 text-right">
              {state.gatewayStatus?.memory ?? 0}%
            </span>
          </div>
        </div>
        <div className="bg-bg-tertiary border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">磁盘使用</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full ${diskColors.bar} rounded-full transition-all duration-500`}
                style={{ width: `${diskUsage?.usagePercent ?? 0}%` }}
              />
            </div>
            <span className={`text-sm font-mono w-12 text-right ${diskColors.text}`}>
              {diskUsage?.usagePercent ?? 0}%
            </span>
          </div>
          {diskUsage && (
            <div className="mt-2 text-xs text-text-muted">
              总容量: {formatBytes(diskUsage.total)} / 已用: {formatBytes(diskUsage.used)} / 可用: {formatBytes(diskUsage.free)}
            </div>
          )}
          {!diskUsage && (
            <div className="mt-2 text-xs text-text-faint">
              无法获取磁盘信息
            </div>
          )}
        </div>
      </div>

      {/* Channels */}
      <div className="bg-bg-tertiary border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-secondary">通道列表</h3>
        </div>
        {state.channels.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-faint text-sm">暂无通道数据</div>
        ) : (
          <div className="divide-y divide-border">
            {state.channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${ch.status === 'active' ? 'bg-success' : ch.status === 'error' ? 'bg-danger' : 'bg-text-faint'}`} />
                  <div>
                    <div className="text-sm font-medium text-text-primary">{ch.name}</div>
                    <div className="text-xs text-text-faint">{ch.type} - {ch.id}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  ch.status === 'active' ? 'bg-success/10 text-success' :
                  ch.status === 'error' ? 'bg-danger/10 text-danger' :
                  'bg-bg-elevated text-text-faint'
                }`}>
                  {ch.status === 'active' ? '活跃' : ch.status === 'error' ? '错误' : '未激活'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cron Jobs */}
      <div className="bg-bg-tertiary border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-secondary">定时任务</h3>
        </div>
        {state.cronJobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-faint text-sm">暂无定时任务</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs">
                  <th className="text-left px-4 py-2 font-medium">名称</th>
                  <th className="text-left px-4 py-2 font-medium">计划</th>
                  <th className="text-left px-4 py-2 font-medium">状态</th>
                  <th className="text-left px-4 py-2 font-medium">上次运行</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.cronJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-2.5 text-text-primary">{job.name}</td>
                    <td className="px-4 py-2.5 text-text-muted font-mono text-xs">{job.schedule}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        job.status === 'active' ? 'bg-success/10 text-success' :
                        job.status === 'paused' ? 'bg-warning/10 text-warning' :
                        'bg-danger/10 text-danger'
                      }`}>
                        {job.status === 'active' ? '运行中' : job.status === 'paused' ? '已暂停' : '错误'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-faint text-xs">
                      {job.lastRun ? formatTime(new Date(job.lastRun).getTime()) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="bg-bg-tertiary border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-secondary">活动记录</h3>
        </div>
        {state.activityFeed.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-faint text-sm">暂无活动记录</div>
        ) : (
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {state.activityFeed.slice(0, 20).map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="text-sm shrink-0 mt-0.5">{activityIcons[item.type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary">{item.description}</p>
                  {item.details && (
                    <p className="text-xs text-text-faint mt-0.5 truncate">{item.details}</p>
                  )}
                </div>
                <span className="text-[10px] text-text-faint shrink-0">
                  {formatTime(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
