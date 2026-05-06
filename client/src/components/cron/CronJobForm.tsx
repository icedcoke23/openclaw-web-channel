import React, { useState, useCallback } from 'react';
import Modal from '@/components/Modal';
import CronExpressionInput, { validateCronExpression } from './CronExpressionInput';
import type { CronJob } from '@/types';

interface CronJobFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (job: Omit<CronJob, 'id'>) => void;
  initialData?: Partial<CronJob>;
  mode: 'create' | 'edit';
}

export default function CronJobForm({ open, onClose, onSubmit, initialData, mode }: CronJobFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    schedule: initialData?.schedule || '',
    enabled: initialData?.enabled ?? true,
    command: initialData?.command || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入任务名称';
    }

    const cronValidation = validateCronExpression(formData.schedule);
    if (!cronValidation.valid) {
      newErrors.schedule = cronValidation.message || '无效的Cron表达式';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        schedule: formData.schedule.trim(),
        enabled: formData.enabled,
        command: formData.command.trim() || undefined,
        status: formData.enabled ? 'active' : 'paused',
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, onClose, validateForm]);

  const handleChange = useCallback((field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const title = mode === 'create' ? '新建定时任务' : '编辑定时任务';

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 任务名称 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            任务名称 <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="例如: 数据备份任务"
            className={`w-full px-3 py-2 bg-bg-primary border rounded-lg text-sm transition-colors ${
              errors.name
                ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
                : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'
            }`}
          />
          {errors.name && <p className="mt-1 text-xs text-danger">{errors.name}</p>}
        </div>

        {/* Cron表达式 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            执行计划 (Cron表达式) <span className="text-danger">*</span>
          </label>
          <CronExpressionInput
            value={formData.schedule}
            onChange={(value) => handleChange('schedule', value)}
            error={errors.schedule}
          />
        </div>

        {/* 命令 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            执行命令 <span className="text-text-muted">(可选)</span>
          </label>
          <textarea
            value={formData.command}
            onChange={(e) => handleChange('command', e.target.value)}
            placeholder="输入要执行的命令或脚本..."
            rows={3}
            className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm transition-colors focus:border-accent focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        {/* 启用状态 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleChange('enabled', !formData.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.enabled ? 'bg-success' : 'bg-bg-elevated'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-text-secondary">
            {formData.enabled ? '已启用' : '已禁用'}
          </span>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-primary rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSubmitting ? '保存中...' : mode === 'create' ? '创建' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
