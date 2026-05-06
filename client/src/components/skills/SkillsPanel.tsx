import React, { useEffect, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';
import type { Skill } from '@/types';

export default function SkillsPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rpc } = useWebSocket();
  const { addToast } = useApi();

  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const result = await rpc('skills.list');
      dispatch({ type: 'SET_SKILLS', payload: (result as Skill[]) || [] });
    } catch {
      addToast('error', '加载技能列表失败');
    } finally {
      setLoading(false);
    }
  }, [rpc, dispatch, addToast]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const toggleSkill = useCallback(
    async (skill: Skill) => {
      const newEnabled = !skill.enabled;
      try {
        await rpc('skills.patch', {
          skillId: skill.id,
          enabled: newEnabled,
        });
        dispatch({
          type: 'UPDATE_SKILL',
          payload: { ...skill, enabled: newEnabled },
        });
        addToast('success', newEnabled ? `已启用 ${skill.name}` : `已禁用 ${skill.name}`);
      } catch {
        addToast('error', `切换技能 ${skill.name} 失败`);
      }
    },
    [rpc, dispatch, addToast]
  );

  const categories = ['all', ...Array.from(new Set(state.skills.map((s) => s.category).filter(Boolean)))];

  const filteredSkills = state.skills.filter((skill) => {
    if (categoryFilter !== 'all' && skill.category !== categoryFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        skill.name.toLowerCase().includes(q) ||
        (skill.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const enabledCount = state.skills.filter((s) => s.enabled).length;

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
          <h1 className="text-xl font-bold text-text-primary">技能管理</h1>
          <p className="text-xs text-text-muted mt-1">
            共 {state.skills.length} 个技能，已启用 {enabledCount} 个
          </p>
        </div>
        <button
          onClick={loadSkills}
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
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-accent-muted/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {cat === 'all' ? '全部' : cat}
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
            placeholder="搜索技能..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* Skills grid */}
      {filteredSkills.length === 0 ? (
        <div className="text-center py-16 text-text-faint text-sm">
          {searchText || categoryFilter !== 'all' ? '没有匹配的技能' : '暂无技能'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className={`bg-bg-tertiary border rounded-xl p-4 transition-colors ${
                skill.enabled ? 'border-accent/30' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-text-primary">{skill.name}</h3>
                    {skill.version && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-faint">
                        v{skill.version}
                      </span>
                    )}
                    {skill.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple/10 text-purple">
                        {skill.category}
                      </span>
                    )}
                  </div>
                  {skill.description && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">{skill.description}</p>
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleSkill(skill)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    skill.enabled ? 'bg-accent-muted' : 'bg-bg-elevated'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      skill.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
