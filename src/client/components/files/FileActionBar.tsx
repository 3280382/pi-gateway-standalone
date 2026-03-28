/**
 * FileActionBar - 选中文件操作栏
 */

import { useFileStore } from '../../store/fileStore';
import { useFileViewerStore } from '../../store/fileViewerStore';
import styles from './FileBrowser.module.css';

interface FileActionBarProps {
  onExecute?: (output: string) => void;
}

export function FileActionBar({ onExecute }: FileActionBarProps) {
  const { selectedActionFile, selectedActionFileName } = useFileStore();
  const { openViewer } = useFileViewerStore();

  if (!selectedActionFile) {
    return null;
  }

  const ext = selectedActionFile.split('.').pop()?.toLowerCase() || '';
  const isExecutable = ['sh', 'py', 'js', 'bash', 'zsh'].includes(ext);
  const isEditable = !['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf'].includes(ext);

  const handleView = () => {
    openViewer(selectedActionFile, selectedActionFileName || '', 'view');
  };

  const handleEdit = () => {
    openViewer(selectedActionFile, selectedActionFileName || '', 'edit');
  };

  const handleExecute = async () => {
    if (onExecute) {
      onExecute(`$ Executing: ${selectedActionFileName}`);
    }
  };

  return (
    <div className={styles.actionBar}>
      <span className={styles.selectedName}>{selectedActionFileName}</span>

      <button className={`${styles.actionBtn} ${styles.view}`} onClick={handleView}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        View
      </button>

      {isEditable && (
        <button className={`${styles.actionBtn} ${styles.edit}`} onClick={handleEdit}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
      )}

      {isExecutable && (
        <button className={`${styles.actionBtn} ${styles.execute}`} onClick={handleExecute}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Run
        </button>
      )}
    </div>
  );
}
