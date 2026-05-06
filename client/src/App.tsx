import React from 'react';
import { useAppState, useAppDispatch } from '@/store';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import Modal from '@/components/Modal';
import CommandPalette from '@/components/CommandPalette';
import MobileNav from '@/components/layout/MobileNav';
import ChatPanel from '@/components/chat/ChatPanel';
import DashboardPanel from '@/components/dashboard/DashboardPanel';
import SessionsPanel from '@/components/sessions/SessionsPanel';
import ConfigPanel from '@/components/config/ConfigPanel';
import LogsPanel from '@/components/logs/LogsPanel';
import SkillsPanel from '@/components/skills/SkillsPanel';
import NodesPanel from '@/components/nodes/NodesPanel';

function PanelRouter() {
  const state = useAppState();

  switch (state.activePanel) {
    case 'chat':
      return <ChatPanel />;
    case 'dashboard':
      return <DashboardPanel />;
    case 'sessions':
      return <SessionsPanel />;
    case 'config':
      return <ConfigPanel />;
    case 'logs':
      return <LogsPanel />;
    case 'skills':
      return <SkillsPanel />;
    case 'nodes':
      return <NodesPanel />;
    default:
      return <ChatPanel />;
  }
}

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  // Close sidebar on panel change (mobile)
  const prevPanelRef = React.useRef(state.activePanel);
  React.useEffect(() => {
    if (prevPanelRef.current !== state.activePanel) {
      dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false });
      prevPanelRef.current = state.activePanel;
    }
  }, [state.activePanel, dispatch]);

  // Close sidebar on outside click (mobile)
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        state.sidebarOpen &&
        !target.closest('aside') &&
        !target.closest('[data-sidebar-toggle]')
      ) {
        dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false });
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [state.sidebarOpen, dispatch]);

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Panel content */}
        <main className="flex-1 overflow-hidden pb-14 lg:pb-0">
          <div className="panel-enter h-full">
            <PanelRouter />
          </div>
        </main>
      </div>

      {/* Mobile navigation */}
      <MobileNav />

      {/* Overlays */}
      <Toast />
      <CommandPalette />
    </div>
  );
}
