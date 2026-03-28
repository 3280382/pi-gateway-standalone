/**
 * RecentWorkspaces Section
 */

import { SectionHeader, IconButton } from '../../../ui';
import { useSidebarStore } from '../../../../store/sidebarStore';
import { useSidebarController } from '../../../../api/sidebarApi';
import styles from './RecentWorkspaces.module.css';

export function RecentWorkspaces() {
  const recentWorkspaces = useSidebarStore((state) => state.recentWorkspaces);
  const controller = useSidebarController();

  const handleClear = () => {
    localStorage.removeItem('recentWorkspaces');
    controller.loadRecentWorkspaces();
  };

  const handleSelect = (path: string) => {
    controller.changeWorkingDir(path);
  };

  if (recentWorkspaces.length === 0) {
    return (
      <section className={styles.section}>
        <SectionHeader title="Recent Workspaces" />
        <div className={styles.empty}>No recent workspaces</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <SectionHeader
        title="Recent Workspaces"
        action={
          <IconButton onClick={handleClear} title="Clear Recent">
            <TrashIcon />
          </IconButton>
        }
      />
      <div className={styles.list}>
        {recentWorkspaces.map((workspace) => {
          // Handle both string and object formats
          const path = typeof workspace === 'string' ? workspace : workspace?.path || '';
          const name = typeof workspace === 'string' 
            ? (path.split('/').pop() || path)
            : (workspace?.name || path.split('/').pop() || path);
          
          return (
            <button
              key={path}
              className={styles.item}
              onClick={() => handleSelect(path)}
              title={path}
            >
              <FolderIcon />
              <span className={styles.name}>{name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}
