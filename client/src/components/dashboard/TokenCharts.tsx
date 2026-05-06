import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface HourlyData {
  hour: string;
  input: number;
  output: number;
}

interface ModelData {
  model: string;
  tokens: number;
}

interface TokenData {
  hourly: HourlyData[];
  byModel: ModelData[];
  total: { input: number; output: number };
}

interface TokenChartsProps {
  data: TokenData | null;
  loading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function TokenCharts({ data, loading = false }: TokenChartsProps) {
  const [activeTab, setActiveTab] = useState<'hourly' | 'model' | 'comparison'>('hourly');

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; name: string; color: string}>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-tertiary border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-text-primary mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)} tokens
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-bg-tertiary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-text-muted font-medium">Token 使用统计</span>
          <div className="w-8 h-8 rounded-lg bg-bg-elevated animate-pulse" />
        </div>
        <div className="h-64 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-bg-tertiary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-text-muted font-medium">Token 使用统计</span>
          <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center text-danger">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-text-muted">无法加载 Token 数据</p>
        </div>
      </div>
    );
  }

  // Prepare data for comparison chart
  const comparisonData = [
    { name: 'Input', value: data.total.input, fill: '#3b82f6' },
    { name: 'Output', value: data.total.output, fill: '#10b981' },
  ];

  return (
    <div className="bg-bg-tertiary border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium">Token 使用统计</span>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-text-faint">总计:</span>
            <span className="text-accent font-medium">{formatNumber(data.total.input + data.total.output)}</span>
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-bg-primary rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('hourly')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'hourly' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          24小时趋势
        </button>
        <button
          onClick={() => setActiveTab('model')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'model' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          模型分布
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'comparison' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          输入输出对比
        </button>
      </div>

      {/* Chart container */}
      <div className="h-64 lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'hourly' ? (
            <AreaChart data={data.hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatNumber}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => <span className="text-xs text-text-muted">{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="input"
                name="Input"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInput)"
              />
              <Area
                type="monotone"
                dataKey="output"
                name="Output"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOutput)"
              />
            </AreaChart>
          ) : activeTab === 'model' ? (
            <PieChart>
              <Pie
                data={data.byModel}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="tokens"
                nameKey="model"
              >
                {data.byModel.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const modelData = payload[0].payload as ModelData;
                    const totalTokens = data?.byModel?.reduce((sum: number, item: ModelData) => sum + item.tokens, 0) || 1;
                    const percent = ((modelData.tokens / totalTokens) * 100).toFixed(1);
                    return (
                      <div className="bg-bg-tertiary border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium text-text-primary">{modelData.model}</p>
                        <p className="text-xs text-text-muted">{formatNumber(modelData.tokens)} tokens ({percent}%)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry) => {
                  const entryData = entry?.payload as unknown as ModelData | undefined;
                  const tokens = entryData?.tokens || 0;
                  return (
                    <span className="text-xs text-text-muted">
                      {value} ({formatNumber(tokens)})
                    </span>
                  );
                }}
              />
            </PieChart>
          ) : (
            <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatNumber}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-bg-tertiary border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium text-text-primary">{label}</p>
                        <p className="text-xs text-accent">{formatNumber(payload[0].value as number)} tokens</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {comparisonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-text-muted mb-1">Input Tokens</p>
          <p className="text-lg font-semibold text-blue-400">{formatNumber(data.total.input)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted mb-1">Output Tokens</p>
          <p className="text-lg font-semibold text-green-400">{formatNumber(data.total.output)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted mb-1">总使用量</p>
          <p className="text-lg font-semibold text-accent">{formatNumber(data.total.input + data.total.output)}</p>
        </div>
      </div>
    </div>
  );
}
