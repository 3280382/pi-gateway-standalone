/**
 * FileSidebar - 文件树侧边栏
 */

import { useEffect, useState, useCallback } from 'react';
import { useFileStore } from '../../store/fileStore';
import { getFileTree } from '../../api/fileApi';
import { getFileIcon } from '../../api/fileApi';
import styles from './FileBrowser.module.css';

interface FileSidebarProps {
  visible: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  expanded?: boolean;
}

export function FileSidebar({ visible }: FileSidebarProps) {
  const { currentPath, setCurrentPath } = useFileStore();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTree = useCallback(async () => {
    try {
      const data = await getFileTree(currentPath);
      setTree(data.items.map(item => ({
        ...item,
        expanded: false
      })));
    } catch (err) {
      console.error('Failed to load file tree:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    if (visible) {
      loadTree();
    }
  }, [visible, loadTree]);

  if (!visible) {
    return <aside className={`${styles.sidebar} ${styles.collapsed}`} />;
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span>📁 Files</span>
      </div>
      <div className={styles.tree}>
        {loading ? (
          <div className={styles.treeLoading}>Loading...</div>
        ) : (
          tree.map((item) => (
            <div
              key={item.path}
              className={`${styles.treeItem} ${item.isDirectory ? styles.directory : ''}`}
              onClick={() => {
                if (item.isDirectory) {
                  setCurrentPath(item.path);
                }
              }}
            >
              <span className={styles.treeIcon}>
                {getFileIcon(undefined, item.isDirectory)}
              </span>
              <span>{item.name}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
