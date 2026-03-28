/**
 * SidebarPanel - Main Sidebar Container
 */

import { useEffect } from 'react';
import {
  WorkingDirectory,
  RecentWorkspaces,
  Sessions,
  Search,
  Settings,
} from '../sections';
import { useSidebarStore } from '../../../store/sidebarStore';
import { useSidebarController } from '../../../api/sidebarApi';
import styles from './SidebarPanel.module.css';

interface SidebarPanelProps {
  isVisible: boolean;
  onSwitchView?: (view: 'chat' | 'files') => void;
  currentView?: 'chat' | 'files';
}

export function SidebarPanel({ isVisible, onSwitchView, currentView = 'chat' }: SidebarPanelProps) {
  const workingDir = useSidebarStore((state) => state.workingDir);
  const error = useSidebarStore((state) => state.error);
  const controller = useSidebarController();

  // Initial data loading
  useEffect(() => {
    controller.loadWorkingDir();
    controller.loadRecentWorkspaces();
  }, []);

  // Load sessions when working directory changes
  useEffect(() => {
    if (workingDir?.path) {
      controller.loadSessions(workingDir.path);
    }
  }, [workingDir?.path]);

  return (
    <aside className={`${styles.sidebar} ${!isVisible ? styles.sidebarHidden : ''}`}>
      <SidebarHeader />
      <div className={styles.content}>
        {error && (
          <div className={styles.error}>
            <span>{error}</span>
            <button onClick={controller.clearError}>×</button>
          </div>
        )}
        <WorkingDirectory />
        <Search />
        <RecentWorkspaces />
        <Sessions />
        <Settings />
      </div>
    </aside>
  );
}

function SidebarHeader() {
  return (
    <div className={styles.header}>
      <div className={styles.logo}>π</div>
      <span className={styles.title}>Pi Gateway</span>
    </div>
  );
}
