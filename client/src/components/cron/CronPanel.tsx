import React, { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useApi } from '@/hooks/useApi';
import CronJobRow from './CronJobRow';
import CronJobForm from './CronJobForm';
import type { CronJob } from '@/types';

export default function CronPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { get, createCronJob, updateCronJob, deleteCronJob, runCronJob } = useApi();

  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // 加载Cron任务列表
  const loadCronJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await get<{ jobs?: CronJob[]; cronJobs?: CronJob[] }>('/cron', { silent: true });
      if (res.ok && res.data) {
        const jobs = res.data.jobs || res.data.cronJobs || [];
        dispatch({ type: 'SET_CRON_JOBS', payload: jobs });
      }
    } finally {
      setIsLoading(false);
    }
  }, [get, dispatch]);

  // 初始加载
  useEffect(() => {
    loadCronJobs();

    // 设置自动刷新 (每30秒)
    const interval = setInterval(loadCronJobs, 30000);
    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [loadCronJobs]);

  // 创建任务
  const handleCreate = useCallback(async (job: Omit<CronJob, 'id'>) => {
    const res = await createCronJob(job);
    if (res.ok) {
      loadCronJobs(); // 刷新列表
    }
    return res;
  }, [createCronJob, loadCronJobs]);

  // 编辑任务
  const handleEdit = useCallback(async (job: Omit<CronJob, 'id'>) => {
    if (!editingJob) return { ok: false, data: null, error: 'No job selected', status: 400 };

    const res = await updateCronJob(editingJob.id, job);
    if (res.ok) {
      setEditingJob(null);
      loadCronJobs(); // 刷新列表
    }
    return res;
  }, [editingJob, updateCronJob, loadCronJobs]);

  // 删除任务
  const handleDelete = useCallback(async (id: string) => {
    await deleteCronJob(id);
    loadCronJobs(); // 刷新列表
  }, [deleteCronJob, loadCronJobs]);

  // 切换启用状态
  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    const res = await updateCronJob(id, { enabled, status: enabled ? 'active' : 'paused' });
    if (res.ok) {
      loadCronJobs(); // 刷新列表
    }
  }, [updateCronJob, loadCronJobs]);

  // 立即执行
  const handleRun = useCallback(async (id: string) => {
    await runCronJob(id);
    // 延迟刷新以获取更新后的状态
    setTimeout(loadCronJobs, 1000);
  }, [runCronJob, loadCronJobs]);

  // 打开编辑表单
  const openEditForm = useCallback((job: CronJob) => {
    setEditingJob(job);
  }, []);

  // 关闭编辑表单
  const closeEditForm = useCallback(() => {
    setEditingJob(null);
  }, []);

  const cronJobs = state.cronJobs || [];

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">定时任务</h2>
          <p className="text-sm text-text-muted mt-0.5">
            管理定时执行的任务和脚本
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 刷新按钮 */}
          <button
            onClick={loadCronJobs}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-primary rounded-lg transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            刷新
          </button>

          {/* 新建按钮 */}
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建任务
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {cronJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-bg-elevated rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-base font-medium text-text-primary mb-1">暂无定时任务</h3>
            <p className="text-sm text-text-muted mb-4">创建您的第一个定时任务来自动化执行操作</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors"
            >
              创建任务
            </button>
          </div>
        ) : (
          <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-bg-elevated border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    任务名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    执行计划
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    上次执行
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    下次执行
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cronJobs.map((job) => (
                  <CronJobRow
                    key={job.id}
                    job={job}
                    onEdit={openEditForm}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    onRun={handleRun}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 创建表单 */}
      <CronJobForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreate}
        mode="create"
      />

      {/* 编辑表单 */}
      <CronJobForm
        open={!!editingJob}
        onClose={closeEditForm}
        onSubmit={handleEdit}
        initialData={editingJob || undefined}
        mode="edit"
      />
    </div>
  );
}
