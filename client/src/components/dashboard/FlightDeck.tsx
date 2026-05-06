import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useApi } from '@/hooks/useApi';
import { formatTime } from '@/lib/markdown';
import type { Channel, ActivityItem, DiskUsage } from '@/types';

interface CostData {
  today: { cost: number; currency: string };
  thisMonth: { cost: number; currency: string };
  budget: { amount: number; currency: string; period: string };
  usagePercent: number;
  history: Array<{ date: string; cost: number }>;
}

interface TokenData {
  hourly: Array<{ hour: string; input: number; output: number }>;
  byModel: Array<{ model: string; tokens: number }>;
  total: { input: number; output: number };
}

// Sparkline component for mini charts
function Sparkline({ data, width = 100, height = 30, color = '#3b82f6' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length === 0) return <div className="w-full h-full bg-bg-elevated rounded" />;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="3" fill={color} />
    </svg>
  );
}

// Stat Card component
function StatCard({
  label,
  value,
  subValue,
  icon,
  color = 'text-accent',
  bgColor = 'bg-accent/10',
  trend,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  color?: string;
  bgColor?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4 hover:border-accent/20 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs text-text-muted font-medium">{label}</span>
          <div className={`text-2xl font-bold ${color} mt-1`}>{value}</div>
          {subValue && <div className="text-xs text-text-faint mt-0.5">{subValue}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${
          trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-text-muted'
        }`}>
          {trend === 'up' ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          ) : trend === 'down' ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          ) : null}
          <span>{trend === 'up' ? '上升' : trend === 'down' ? '下降' : '持平'}</span>
        </div>
      )}
    </div>
  );
}

// Token Usage Sparkline Panel
function TokenSparklinePanel({ data, loading }: { data: TokenData | null; loading: boolean }) {
  const sparklineData = useMemo(() => {
    if (!data?.hourly) return [];
    return data.hourly.map(h => h.input + h.output);
  }, [data]);

  const totalTokens = useMemo(() => {
    if (!data?.total) return 0;
    return data.total.input + data.total.output;
  }, [data]);

  if (loading) {
    return (
      <div className="bg-bg-tertiary border border-border rounded-xl p-4 h-full">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-bg-elevated rounded w-1/3" />
          <div className="h-8 bg-bg-elevated rounded w-1/2" />
          <div className="h-20 bg-bg-elevated rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">Token 使用趋势</h3>
        <span className="text-xs text-text-faint">24小时</span>
      </div>
      <div className="text-2xl font-bold text-accent mb-2">
        {totalTokens.toLocaleString()}
        <span className="text-xs font-normal text-text-muted ml-1">tokens</span>
      </div>
      <div className="h-24 flex items-end">
        {sparklineData.length > 0 ? (
          <Sparkline data={sparklineData} width={280} height={80} color="#3b82f6" />
        ) : (
          <div className="w-full h-full bg-bg-elevated rounded flex items-center justify-center">
            <span className="text-xs text-text-faint">暂无数据</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 text-xs">
        <span className="text-text-muted">输入: {data?.total.input.toLocaleString() || 0}</span>
        <span className="text-text-muted">输出: {data?.total.output.toLocaleString() || 0}</span>
      </div>
    </div>
  );
}

// Cost Tracker Mini Panel
function CostTrackerMini({ data, loading }: { data: CostData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-bg-tertiary border border-border rounded-xl p-4 h-full">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-bg-elevated rounded w-1/3" />
          <div className="h-8 bg-bg-elevated rounded w-1/2" />
          <div className="h-4 bg-bg-elevated rounded" />
        </div>
      </div>
    );
  }

  const usagePercent = data?.usagePercent || 0;
  const isOverBudget = usagePercent > 100;

  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">成本追踪</h3>
        <span className="text-xs text-text-faint">本月</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-bold text-text-primary">
          {data?.thisMonth?.currency === 'USD' ? '$' : '¥'}{data?.thisMonth?.cost.toFixed(2) || '0.00'}
        </span>
        <span className="text-xs text-text-muted">
          / {data?.budget?.currency === 'USD' ? '$' : '¥'}{data?.budget?.amount || 100}
        </span>
      </div>
      <div className="h-2 bg-bg-elevated rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOverBudget ? 'bg-danger' : usagePercent > 80 ? 'bg-warning' : 'bg-success'
          }`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={isOverBudget ? 'text-danger' : usagePercent > 80 ? 'text-warning' : 'text-success'}>
          {usagePercent}% 已使用
        </span>
        <span className="text-text-faint">
          今日: {data?.today?.currency === 'USD' ? '$' : '¥'}{data?.today?.cost.toFixed(2) || '0.00'}
        </span>
      </div>
    </div>
  );
}

// Active Channels List
function ActiveChannelsList({ channels }: { channels: Channel[] }) {
  const activeChannels = channels.filter(c => c.status === 'active');

  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">活跃通道</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
          {activeChannels.length} 活跃
        </span>
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="text-center py-4 text-text-faint text-xs">暂无通道</div>
        ) : (
          channels.slice(0, 5).map((ch) => (
            <div key={ch.id} className="flex items-center gap-2 p-2 rounded-lg bg-bg-elevated/50">
              <span className={`w-2 h-2 rounded-full ${
                ch.status === 'active' ? 'bg-success' : ch.status === 'error' ? 'bg-danger' : 'bg-text-faint'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">{ch.name}</div>
                <div className="text-[10px] text-text-faint">{ch.type}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Activity Feed Mini
function ActivityFeedMini({ activities }: { activities: ActivityItem[] }) {
  const activityIcons: Record<string, string> = {
    message: '',
    session: '',
    config: '⚙️',
    skill: '',
    node: '',
    error: '',
  };

  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">最近活动</h3>
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-4 text-text-faint text-xs">暂无活动</div>
        ) : (
          activities.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-xs">
              <span className="text-sm shrink-0">{activityIcons[item.type] || ''}</span>
              <div className="flex-1 min-w-0">
                <p className="text-text-secondary truncate">{item.description}</p>
              </div>
              <span className="text-text-faint shrink-0">{formatTime(item.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Quick Actions Panel
function QuickActionsPanel({
  onNewSession,
  onOpenConfig,
  onViewLogs,
}: {
  onNewSession: () => void;
  onOpenConfig: () => void;
  onViewLogs: () => void;
}) {
  const dispatch = useAppDispatch();

  const actions = [
    {
      label: '新会话',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      onClick: () => {
        dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'chat' });
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: null });
      },
    },
    {
      label: '配置',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'text-purple',
      bgColor: 'bg-purple/10',
      onClick: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'config' }),
    },
    {
      label: '日志',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-cyan',
      bgColor: 'bg-cyan/10',
      onClick: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'logs' }),
    },
    {
      label: '发现',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      onClick: () => dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'discovery' }),
    },
  ];

  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">快捷操作</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`flex items-center gap-2 p-2 rounded-lg ${action.bgColor} ${action.color} hover:opacity-80 transition-opacity text-xs font-medium`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FlightDeck() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { addToast } = useApi();

  const [loading, setLoading] = useState(true);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [costLoading, setCostLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  const loadCostData = useCallback(async () => {
    setCostLoading(true);
    try {
      const res = await fetch('/api/metrics/cost');
      if (res.ok) {
        const data = await res.json();
        setCostData(data);
      }
    } catch {
      // Ignore error
    } finally {
      setCostLoading(false);
    }
  }, []);

  const loadTokenData = useCallback(async () => {
    setTokenLoading(true);
    try {
      const res = await fetch('/api/metrics/tokens');
      if (res.ok) {
        const data = await res.json();
        setTokenData(data);
      }
    } catch {
      // Ignore error
    } finally {
      setTokenLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, channelsRes] = await Promise.allSettled([
        fetch('/api/status').then((r) => r.json()),
        fetch('/api/channels').then((r) => r.json()),
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
    } catch {
      // Some endpoints may not exist
    } finally {
      setLoading(false);
    }
  }, [dispatch, state.connectionStatus]);

  useEffect(() => {
    loadDashboard();
    loadCostData();
    loadTokenData();

    // Real-time updates via polling (can be replaced with WebSocket)
    const timer = setInterval(() => {
      loadDashboard();
      loadCostData();
      loadTokenData();
    }, 30000);

    return () => clearInterval(timer);
  }, [loadDashboard, loadCostData, loadTokenData]);

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    if (d > 0) return `${d}天${h}小时`;
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}小时${m}分钟`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Flight Deck</h1>
          <p className="text-xs text-text-muted mt-1">系统概览与实时监控</p>
        </div>
        <button
          onClick={() => {
            loadDashboard();
            loadCostData();
            loadTokenData();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* Top Row - Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="网关状态"
          value={state.connectionStatus === 'connected' ? '在线' : state.connectionStatus === 'connecting' ? '连接中' : '离线'}
          subValue={state.gatewayStatus?.version}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          }
          color={state.connectionStatus === 'connected' ? 'text-success' : 'text-danger'}
          bgColor={state.connectionStatus === 'connected' ? 'bg-success/10' : 'bg-danger/10'}
        />
        <StatCard
          label="活跃会话"
          value={state.gatewayStatus?.sessions ?? state.sessions.length}
          subValue={`运行 ${formatUptime(state.gatewayStatus?.uptime)}`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
          color="text-accent"
          bgColor="bg-accent/10"
        />
        <StatCard
          label="CPU 使用率"
          value={`${state.gatewayStatus?.cpu ?? 0}%`}
          subValue={state.gatewayStatus?.cpu && state.gatewayStatus.cpu > 80 ? '高负载' : '正常'}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
          color={state.gatewayStatus?.cpu && state.gatewayStatus.cpu > 80 ? 'text-warning' : 'text-purple'}
          bgColor={state.gatewayStatus?.cpu && state.gatewayStatus.cpu > 80 ? 'bg-warning/10' : 'bg-purple/10'}
        />
        <StatCard
          label="内存使用率"
          value={`${state.gatewayStatus?.memory ?? 0}%`}
          subValue={diskUsage ? `磁盘 ${diskUsage.usagePercent}%` : undefined}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
          color="text-cyan"
          bgColor="bg-cyan/10"
        />
      </div>

      {/* Middle Row - Three Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TokenSparklinePanel data={tokenData} loading={tokenLoading} />
        <CostTrackerMini data={costData} loading={costLoading} />
        <ActiveChannelsList channels={state.channels} />
      </div>

      {/* Bottom Row - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeedMini activities={state.activityFeed} />
        <QuickActionsPanel
          onNewSession={() => {}}
          onOpenConfig={() => {}}
          onViewLogs={() => {}}
        />
      </div>
    </div>
  );
}
