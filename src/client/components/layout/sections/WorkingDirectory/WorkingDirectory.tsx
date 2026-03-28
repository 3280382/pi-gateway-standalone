/**
 * WorkingDirectory Section
 */

import { SectionHeader, IconButton } from '../../../ui';
import { useSidebarStore } from '../../../../store/sidebarStore';
import { useSidebarController } from '../../../../api/sidebarApi';
import styles from './WorkingDirectory.module.css';

export function WorkingDirectory() {
  const workingDir = useSidebarStore((state) => state.workingDir);
  const controller = useSidebarController();

  const handleBrowse = () => {
    // Use file input for directory selection
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // Get directory from first file's path
        const file = files[0];
        const path = (file as any).path || file.name;
        const dirPath = path.substring(0, path.lastIndexOf('/'));
        if (dirPath) {
          controller.changeWorkingDir(dirPath);
        }
      }
    };
    input.click();
  };

  return (
    <section className={styles.section}>
      <SectionHeader
        title="Working Directory"
        action={
          <IconButton onClick={handleBrowse} title="Change Directory">
            <FolderIcon />
          </IconButton>
        }
      />
      <div className={styles.directory}>
        <FolderIcon className={styles.icon} />
        <span className={styles.path} title={workingDir?.path}>
          {workingDir?.displayName || '~'}
        </span>
      </div>
    </section>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
    >
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}
