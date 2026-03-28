/**
 * FileGrid - 网格视图 (无复选框，点击选中/进入)
 */

import { memo } from 'react';
import { FileItem, useFileStore } from '../../store/fileStore';
import { getFileIcon } from '../../api/fileApi';
import styles from './FileBrowser.module.css';

interface FileGridProps {
  items: FileItem[];
}

export const FileGrid = memo<FileGridProps>(({ items }) => {
  const { selectedItems, clearSelection, selectForAction, setCurrentPath } = useFileStore();

  const handleClick = (item: FileItem) => {
    if (item.isDirectory) {
      // 点击文件夹进入
      setCurrentPath(item.path);
    } else {
      // 点击文件单选
      clearSelection();
      selectForAction(item.path, item.name);
    }
  };

  return (
    <div className={styles.grid}>
      {items.map((item) => {
        const isSelected = selectedItems.includes(item.path);
        const icon = getFileIcon(item.extension, item.isDirectory);

        return (
          <div
            key={item.path}
            className={`${styles.gridItem} ${item.isDirectory ? styles.directory : ''} ${isSelected ? styles.selected : ''}`}
            onClick={() => handleClick(item)}
            title={item.name}
          >
            <span className={styles.gridIcon}>{icon}</span>
            <span className={styles.gridName}>{item.name}</span>
          </div>
        );
      })}
    </div>
  );
});

FileGrid.displayName = 'FileGrid';
