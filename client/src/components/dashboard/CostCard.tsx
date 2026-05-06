import React, { useState, useCallback } from 'react';
import Modal from '@/components/Modal';

interface CostData {
  today: { cost: number; currency: string };
  thisMonth: { cost: number; currency: string };
  budget: { amount: number; currency: string; period: string };
  usagePercent: number;
  history: Array<{ date: string; cost: number }>;
}

interface CostCardProps {
  data: CostData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export default function CostCard({ data, loading = false, onRefresh }: CostCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const formatCurrency = (amount: number, currency: string): string => {
    const symbols: Record<string, string> = {
      USD: '$',
      CNY: '¥',
      EUR: '€',
      GBP: '£',
    };
    const symbol = symbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getProgressColor = (percent: number): string => {
    if (percent >= 90) return 'bg-danger';
    if (percent >= 80) return 'bg-warning';
    if (percent >= 60) return 'bg-accent';
    return 'bg-success';
  };

  const getStatusText = (percent: number): string => {
    if (percent >= 90) return '预算即将耗尽';
    if (percent >= 80) return '预算使用较高';
    if (percent >= 60) return '预算使用正常';
    return '预算充足';
  };

  const getStatusColor = (percent: number): string => {
    if (percent >= 90) return 'text-danger';
    if (percent >= 80) return 'text-warning';
    if (percent >= 60) return 'text-accent';
    return 'text-success';
  };

  const handleSaveBudget = useCallback(() => {
    const newBudget = parseFloat(budgetInput);
    if (isNaN(newBudget) || newBudget <= 0) {
      return;
    }
    // In a real implementation, this would call an API to save the budget
    // For now, we just close the modal
    setShowSettings(false);
    setBudgetInput('');
    onRefresh?.();
  }, [budgetInput, onRefresh]);

  if (loading) {
    return (
      <div className="bg-bg-tertiary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-text-muted font-medium">成本追踪</span>
          <div className="w-8 h-8 rounded-lg bg-bg-elevated animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-8 bg-bg-elevated rounded animate-pulse" />
          <div className="h-4 bg-bg-elevated rounded animate-pulse" />
          <div className="h-2 bg-bg-elevated rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-bg-tertiary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-text-muted font-medium">成本追踪</span>
          <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center text-danger">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-text-muted">无法加载成本数据</p>
        </div>
      </div>
    );
  }

  const isOverBudget = data.usagePercent >= 100;
  const isWarning = data.usagePercent >= 80 && data.usagePercent < 100;

  return (
    <>
      <div className="bg-bg-tertiary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-text-muted font-medium">成本追踪</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
              title="预算设置"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isOverBudget ? 'bg-danger/10 text-danger' :
              isWarning ? 'bg-warning/10 text-warning' :
              'bg-success/10 text-success'
            }`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Today's cost */}
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-text-primary">
              {formatCurrency(data.today.cost, data.today.currency)}
            </span>
            <span className="text-xs text-text-muted">今日</span>
          </div>
        </div>

        {/* This month's cost */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-text-secondary">本月累计</span>
            <span className="text-sm font-medium text-text-primary">
              {formatCurrency(data.thisMonth.cost, data.thisMonth.currency)}
            </span>
          </div>
        </div>

        {/* Budget progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted">预算使用</span>
            <span className={`text-xs font-medium ${getStatusColor(data.usagePercent)}`}>
              {data.usagePercent}%
            </span>
          </div>
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(data.usagePercent)}`}
              style={{ width: `${Math.min(100, data.usagePercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-text-faint">
              {formatCurrency(0, data.budget.currency)}
            </span>
            <span className="text-[10px] text-text-faint">
              {formatCurrency(data.budget.amount, data.budget.currency)}
            </span>
          </div>
        </div>

        {/* Status message */}
        {(isWarning || isOverBudget) && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isOverBudget ? 'bg-danger/10' : 'bg-warning/10'
          }`}>
            <svg className={`w-4 h-4 ${isOverBudget ? 'text-danger' : 'text-warning'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className={`text-xs ${isOverBudget ? 'text-danger' : 'text-warning'}`}>
              {isOverBudget ? '已超出预算！' : getStatusText(data.usagePercent)}
            </span>
          </div>
        )}

        {/* Mini chart - last 7 days */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-end justify-between h-16 gap-1">
            {data.history.slice(-7).map((day, index) => {
              const maxCost = Math.max(...data.history.slice(-7).map(d => d.cost));
              const height = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1 group"
                >
                  <div
                    className="w-full bg-accent/30 rounded-t-sm transition-all duration-300 group-hover:bg-accent/50"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${formatCurrency(day.cost, data.budget.currency)}`}
                  />
                  <span className="text-[8px] text-text-faint">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Budget Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => {
          setShowSettings(false);
          setBudgetInput('');
        }}
        title="预算设置"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">
              月度预算金额 ({data.budget.currency})
            </label>
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder={data.budget.amount.toString()}
              className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-colors"
            />
            <p className="mt-1 text-xs text-text-muted">
              当前预算: {formatCurrency(data.budget.amount, data.budget.currency)}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowSettings(false);
                setBudgetInput('');
              }}
              className="px-3 py-1.5 rounded-lg bg-bg-elevated text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveBudget}
              disabled={!budgetInput || parseFloat(budgetInput) <= 0}
              className="px-3 py-1.5 rounded-lg bg-accent-muted/20 text-xs text-accent hover:bg-accent-muted/30 transition-colors disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
