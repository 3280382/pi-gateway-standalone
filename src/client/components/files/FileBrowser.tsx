/**
 * FileBrowser - 文件浏览器主组件
 */

import { useEffect, useCallback } from 'react';
import { useFileStore } from '../../store/fileStore';
import { browseDirectory } from '../../api/fileApi';
import { FileToolbar } from './FileToolbar';
import { FileGrid } from './FileGrid';
import { FileList } from './FileList';
import { FileSidebar } from './FileSidebar';
import { FileActionBar } from './FileActionBar';
import styles from './FileBrowser.module.css';

interface FileBrowserProps {
  externalSidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  onExecuteOutput?: (output: string) => void;
}

export function FileBrowser({ externalSidebarVisible, onToggleSidebar, onExecuteOutput }: FileBrowserProps) {
  const {
    currentPath,
    viewMode,
    isLoading,
    error,
    sidebarVisible: storeSidebarVisible,
    setItems,
    setLoading,
    setError,
    setCurrentPath,
    getFilteredAndSortedItems
  } = useFileStore();

  // 使用外部状态或内部状态
  const sidebarVisible = externalSidebarVisible !== undefined ? externalSidebarVisible : storeSidebarVisible;

  const filteredItems = getFilteredAndSortedItems();

  // 加载目录内容
  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await browseDirectory(path);
      setItems([
        // 上级目录
        ...(data.parentPath !== data.currentPath ? [{
          name: '..',
          path: data.parentPath,
          isDirectory: true,
          modified: ''
        }] : []),
        ...data.items
      ]);
      setCurrentPath(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [setItems, setLoading, setError, setCurrentPath]);

  // 初始加载
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  return (
    <section className={styles.fileBrowserSection}>
      <div className={styles.container}>
        {/* 侧边栏文件树 */}
        <FileSidebar visible={sidebarVisible} />

        {/* 主内容区 */}
        <div className={styles.main}>
          {/* 工具栏 */}
          <FileToolbar
            currentPath={currentPath}
            itemCount={filteredItems.length}
            onRefresh={() => loadDirectory(currentPath)}
            onToggleSidebar={onToggleSidebar}
            onExecuteOutput={onExecuteOutput}
          />

          {/* 选中文件操作栏 */}
          <FileActionBar onExecute={onExecuteOutput} />

          {/* 文件列表 */}
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.empty}>No files found</div>
          ) : viewMode === 'grid' ? (
            <FileGrid items={filteredItems} />
          ) : (
            <FileList items={filteredItems} />
          )}
        </div>
      </div>
    </section>
  );
}
