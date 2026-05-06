import React, { useState, useCallback } from 'react';
import type { CronJob } from '@/types';

interface CronJobRowProps {
  job: CronJob;
  onEdit: (job: CronJob) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
}

export default function CronJobRow({ job, onEdit, onDelete, onToggle, onRun }: CronJobRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    onDelete(job.id);
    setShowDeleteConfirm(false);
  }, [job.id, onDelete]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      await onRun(job.id);
    } finally {
      setIsRunning(false);
    }
  }, [job.id, onRun]);

  const handleToggle = useCallback(() => {
    onToggle(job.id, !job.enabled);
  }, [job.id, job.enabled, onToggle]);

  const statusColors = {
    active: 'bg-success/20 text-success border-success/30',
    paused: 'bg-warning/20 text-warning border-warning/30',
    error: 'bg-danger/20 text-danger border-danger/30',
  };

  const statusLabels = {
    active: '运行中',
    paused: '已暂停',
    error: '错误',
  };

  return (
    <>
      <tr className="hover:bg-bg-elevated/50 transition-colors group">
        {/* 名称 */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">{job.name}</span>
            {job.command && (
              <span
                className="text-xs text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded"
                title={job.command}
              >
                有命令
              </span>
            )}
          </div>
        </td>

        {/* 执行计划 */}
        <td className="px-4 py-3">
          <code className="text-xs font-mono bg-bg-elevated px-2 py-1 rounded text-text-secondary">
            {job.schedule}
          </code>
        </td>

        {/* 状态 */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusColors[job.status]}`}
          >
            {statusLabels[job.status]}
          </span>
        </td>

        {/* 上次执行 */}
        <td className="px-4 py-3 text-sm text-text-muted">
          {job.lastRun ? new Date(job.lastRun).toLocaleString('zh-CN') : '-'}
        </td>

        {/* 下次执行 */}
        <td className="px-4 py-3 text-sm text-text-muted">
          {job.nextRun ? new Date(job.nextRun).toLocaleString('zh-CN') : '-'}
        </td>

        {/* 操作 */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {/* 启用/禁用切换 */}
            <button
              onClick={handleToggle}
              className={`p-1.5 rounded-md transition-colors ${
                job.enabled
                  ? 'text-success hover:bg-success/10'
                  : 'text-text-muted hover:text-warning hover:bg-warning/10'
              }`}
              title={job.enabled ? '禁用' : '启用'}
            >
              {job.enabled ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>

            {/* 立即执行 */}
            <button
              onClick={handleRun}
              disabled={isRunning || !job.enabled}
              className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="立即执行"
            >
              {isRunning ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </button>

            {/* 编辑 */}
            <button
              onClick={() => onEdit(job)}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              title="编辑"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            {/* 删除 */}
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title="删除"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <tr>
          <td colSpan={6} className="px-4 py-3">
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
              <p className="text-sm text-text-primary mb-3">
                确定要删除定时任务 <span className="font-medium">"{job.name}"</span> 吗？此操作无法撤销。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete}
                  className="px-3 py-1.5 text-sm text-white bg-danger hover:bg-danger/90 rounded-md transition-colors"
                >
                  确认删除
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-primary rounded-md transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
