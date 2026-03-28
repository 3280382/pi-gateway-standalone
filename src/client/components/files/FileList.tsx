/**
 * FileList - 列表视图 (无复选框，点击选中/进入)
 */

import { memo } from 'react';
import { FileItem, useFileStore } from '../../store/fileStore';
import { getFileIcon, formatFileSize } from '../../api/fileApi';
import styles from './FileBrowser.module.css';

interface FileListProps {
  items: FileItem[];
}

export const FileList = memo<FileListProps>(({ items }) => {
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
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <span className={styles.headerName}>Name</span>
        <span className={styles.headerSize}>Size</span>
        <span className={styles.headerModified}>Modified</span>
      </div>
      {items.map((item) => {
        const isSelected = selectedItems.includes(item.path);
        const icon = getFileIcon(item.extension, item.isDirectory);

        return (
          <div
            key={item.path}
            className={`${styles.listItem} ${isSelected ? styles.selected : ''} ${item.isDirectory ? styles.directory : ''}`}
            onClick={() => handleClick(item)}
          >
            <span className={styles.listIcon}>{icon}</span>
            <span className={styles.listName}>{item.name}</span>
            <span className={styles.listSize}>{formatFileSize(item.size)}</span>
            <span className={styles.listModified}>
              {item.modified ? new Date(item.modified).toLocaleDateString() : '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
});

FileList.displayName = 'FileList';
