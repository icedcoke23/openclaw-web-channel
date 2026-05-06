import React, { useState, useCallback, useMemo } from 'react';

interface CronExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

interface CronPreset {
  label: string;
  value: string;
  description: string;
}

const CRON_PRESETS: CronPreset[] = [
  { label: '每分钟', value: '* * * * *', description: '每分钟执行一次' },
  { label: '每小时', value: '0 * * * *', description: '每小时的第0分钟执行' },
  { label: '每天', value: '0 0 * * *', description: '每天午夜执行' },
  { label: '每周', value: '0 0 * * 0', description: '每周日午夜执行' },
  { label: '每月', value: '0 0 1 * *', description: '每月1日午夜执行' },
  { label: '工作日', value: '0 9 * * 1-5', description: '工作日早上9点执行' },
];

// 简化的Cron验证正则表达式
const CRON_REGEX = /^((\*|[0-9,-\/]+)\s+){4}(\*|[0-9,-\/]+)$/;

// 解析Cron表达式并计算下次执行时间
function getNextRunTime(schedule: string): string | null {
  if (!CRON_REGEX.test(schedule)) return null;

  try {
    const parts = schedule.split(/\s+/);
    if (parts.length !== 5) return null;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // 简化的下次执行时间计算
    // 这里只做基本的解析，实际项目中可以使用更完整的cron-parser库
    if (minute === '*' && hour === '*') {
      next.setMinutes(now.getMinutes() + 1);
    } else if (minute !== '*' && hour === '*') {
      next.setMinutes(parseInt(minute, 10));
      next.setHours(now.getHours() + 1);
    } else if (minute !== '*' && hour !== '*') {
      next.setMinutes(parseInt(minute, 10));
      next.setHours(parseInt(hour, 10));
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next.toLocaleString('zh-CN');
  } catch {
    return null;
  }
}

// 验证Cron表达式
function validateCronExpression(schedule: string): { valid: boolean; message?: string } {
  if (!schedule.trim()) {
    return { valid: false, message: '请输入Cron表达式' };
  }

  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, message: 'Cron表达式必须包含5个字段（分 时 日 月 周）' };
  }

  if (!CRON_REGEX.test(schedule)) {
    return { valid: false, message: 'Cron表达式格式无效' };
  }

  // 验证每个字段的范围
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // 分钟: 0-59
  if (!isValidCronField(minute, 0, 59)) {
    return { valid: false, message: '分钟字段无效（范围: 0-59）' };
  }

  // 小时: 0-23
  if (!isValidCronField(hour, 0, 23)) {
    return { valid: false, message: '小时字段无效（范围: 0-23）' };
  }

  // 日期: 1-31
  if (!isValidCronField(dayOfMonth, 1, 31)) {
    return { valid: false, message: '日期字段无效（范围: 1-31）' };
  }

  // 月份: 1-12
  if (!isValidCronField(month, 1, 12)) {
    return { valid: false, message: '月份字段无效（范围: 1-12）' };
  }

  // 星期: 0-7 (0和7都是周日)
  if (!isValidCronField(dayOfWeek, 0, 7)) {
    return { valid: false, message: '星期字段无效（范围: 0-7, 0和7都是周日）' };
  }

  return { valid: true };
}

// 验证单个Cron字段
function isValidCronField(field: string, min: number, max: number): boolean {
  // 支持的特殊字符: * , - /
  if (field === '*') return true;

  // 处理逗号分隔的列表
  const parts = field.split(',');
  for (const part of parts) {
    if (!isValidCronPart(part, min, max)) {
      return false;
    }
  }
  return true;
}

function isValidCronPart(part: string, min: number, max: number): boolean {
  // 处理范围 (例如: 1-5)
  if (part.includes('-')) {
    const [start, end] = part.split('-');
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);
    if (isNaN(startNum) || isNaN(endNum)) return false;
    if (startNum < min || startNum > max || endNum < min || endNum > max) return false;
    if (startNum > endNum) return false;
    return true;
  }

  // 处理步长 (例如: */5 或 1-5/2)
  if (part.includes('/')) {
    const [range, step] = part.split('/');
    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum < 1) return false;

    if (range === '*') return true;
    return isValidCronPart(range, min, max);
  }

  // 处理单个数字
  const num = parseInt(part, 10);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
}

export default function CronExpressionInput({ value, onChange, error }: CronExpressionInputProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validateCronExpression(value), [value]);
  const nextRunTime = useMemo(() => getNextRunTime(value), [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handlePresetSelect = useCallback((presetValue: string) => {
    onChange(presetValue);
    setShowPresets(false);
  }, [onChange]);

  const displayError = error || (touched && !validation.valid ? validation.message : undefined);

  return (
    <div className="space-y-3">
      {/* Cron输入框 */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder="* * * * *"
          className={`w-full px-3 py-2 bg-bg-primary border rounded-lg text-sm font-mono transition-colors ${
            displayError
              ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
              : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-text-muted hover:text-text-secondary bg-bg-elevated hover:bg-bg-secondary rounded transition-colors"
        >
          预设
        </button>
      </div>

      {/* 错误提示 */}
      {displayError && (
        <p className="text-xs text-danger">{displayError}</p>
      )}

      {/* 下次执行时间 */}
      {validation.valid && nextRunTime && (
        <p className="text-xs text-success">
          预计下次执行: {nextRunTime}
        </p>
      )}

      {/* 预设选项 */}
      {showPresets && (
        <div className="bg-bg-secondary border border-border rounded-lg p-3 space-y-2">
          <p className="text-xs text-text-muted mb-2">选择预设:</p>
          <div className="grid grid-cols-2 gap-2">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetSelect(preset.value)}
                className={`text-left px-3 py-2 rounded-md text-xs transition-colors ${
                  value === preset.value
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'bg-bg-elevated hover:bg-bg-primary text-text-secondary border border-transparent'
                }`}
              >
                <span className="font-medium block">{preset.label}</span>
                <span className="text-text-faint font-mono mt-0.5 block">{preset.value}</span>
                <span className="text-text-faint mt-0.5 block">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 帮助信息 */}
      <div className="text-xs text-text-muted space-y-1">
        <p>格式: 分 时 日 月 周</p>
        <p>示例: 0 9 * * 1-5 (工作日早上9点)</p>
      </div>
    </div>
  );
}

export { validateCronExpression, getNextRunTime, CRON_PRESETS };
