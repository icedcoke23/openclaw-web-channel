import React, { useEffect, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';
import { formatTime } from '@/lib/markdown';
import type { Node } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  online: { label: '在线', color: 'text-success', bgColor: 'bg-success/10', dotColor: 'bg-success' },
  offline: { label: '离线', color: 'text-text-faint', bgColor: 'bg-bg-elevated', dotColor: 'bg-text-faint' },
  error: { label: '错误', color: 'text-danger', bgColor: 'bg-danger/10', dotColor: 'bg-danger' },
};

export default function NodesPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rpc } = useWebSocket();
  const { addToast } = useApi();

  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await rpc('node.list');
      dispatch({ type: 'SET_NODES', payload: (result as Node[]) || [] });
    } catch {
      addToast('error', '加载节点列表失败');
    } finally {
      setLoading(false);
    }
  }, [rpc, dispatch, addToast]);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  const invokeNodeAction = useCallback(
    async (nodeId: string, action: string) => {
      try {
        await rpc('node.invoke', { nodeId, action });
        addToast('success', `节点操作 ${action} 已执行`);
        loadNodes();
      } catch {
        addToast('error', `执行节点操作 ${action} 失败`);
      }
    },
    [rpc, addToast, loadNodes]
  );

  const filteredNodes = state.nodes.filter((node) => {
    if (statusFilter !== 'all' && node.status !== statusFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        node.name.toLowerCase().includes(q) ||
        node.type.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const onlineCount = state.nodes.filter((n) => n.status === 'online').length;

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
          <h1 className="text-xl font-bold text-text-primary">节点管理</h1>
          <p className="text-xs text-text-muted mt-1">
            共 {state.nodes.length} 个节点，{onlineCount} 个在线
          </p>
        </div>
        <button
          onClick={loadNodes}
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
          {['all', 'online', 'offline', 'error'].map((status) => (
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
            placeholder="搜索节点..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* Nodes list */}
      {filteredNodes.length === 0 ? (
        <div className="text-center py-16 text-text-faint text-sm">
          {searchText || statusFilter !== 'all' ? '没有匹配的节点' : '暂无节点'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNodes.map((node) => {
            const statusCfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.offline;
            return (
              <div
                key={node.id}
                className="bg-bg-tertiary border border-border rounded-xl p-4 hover:border-accent/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${statusCfg.dotColor}`} />
                      <h3 className="text-sm font-medium text-text-primary">{node.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusCfg.bgColor} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-faint">
                        {node.type}
                      </span>
                    </div>

                    <div className="text-xs text-text-faint mb-2">
                      ID: {node.id}
                      {node.lastSeen && (
                        <span className="ml-3">最后活跃: {formatTime(new Date(node.lastSeen).getTime())}</span>
                      )}
                    </div>

                    {/* Capabilities */}
                    {node.capabilities && node.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {node.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-cyan/10 text-cyan"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {node.status === 'online' && (
                      <>
                        <button
                          onClick={() => invokeNodeAction(node.id, 'ping')}
                          className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-accent transition-colors"
                          title="Ping"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => invokeNodeAction(node.id, 'restart')}
                          className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-warning transition-colors"
                          title="重启"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => invokeNodeAction(node.id, 'info')}
                      className="p-1.5 hover:bg-bg-elevated rounded-md text-text-muted hover:text-text-secondary transition-colors"
                      title="详情"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
