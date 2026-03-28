/**
 * FileToolbar - 文件浏览器工具栏（两行布局）
 */

import { useFileStore, SortMode, FilterType } from '../../store/fileStore';
import styles from './FileBrowser.module.css';

// 可执行文件扩展名
const EXECUTABLE_EXTENSIONS = ['sh', 'bash', 'zsh', 'py', 'js', 'ts', 'pl', 'rb'];

interface FileToolbarProps {
  currentPath: string;
  itemCount: number;
  onRefresh: () => void;
  onToggleSidebar?: () => void;
  onExecuteOutput?: (output: string) => void;
}

export function FileToolbar({ currentPath, itemCount, onRefresh, onToggleSidebar, onExecuteOutput }: FileToolbarProps) {
  const {
    viewMode,
    sortMode,
    filterType,
    filterText,
    selectedActionFile,
    selectedActionFileName,
    toggleViewMode,
    setSortMode,
    setFilterType,
    setFilterText,
    navigateUp,
    navigateHome,
    toggleSidebar: storeToggleSidebar,
    executeFile
  } = useFileStore();

  // 使用外部的 toggleSidebar 或内部的
  const handleToggleSidebar = onToggleSidebar || storeToggleSidebar;

  // 检查选中的文件是否可执行
  const isExecutable = selectedActionFileName ? (
    EXECUTABLE_EXTENSIONS.some(ext => selectedActionFileName.toLowerCase().endsWith('.' + ext)) ||
    !selectedActionFileName.includes('.') // 无扩展名的文件也可能是可执行脚本
  ) : false;

  return (
    <div className={styles.toolbarWrapper}>
      {/* 第一行：导航 + 路径 + 执行 */}
      <div className={styles.toolbarRow}>
        {/* 导航按钮 */}
        <button className={`${styles.toolbarBtn} ${styles.upBtn}`} onClick={navigateUp} title="Go Up (..)">
          ..
        </button>

        <button className={styles.toolbarBtn} onClick={navigateHome} title="Go Home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>

        <button className={styles.toolbarBtn} onClick={onRefresh} title="Refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>

        {/* 执行按钮 - 当选中可执行文件时显示 */}
        {isExecutable && selectedActionFile && (
          <button 
            className={`${styles.toolbarBtn} ${styles.exeBtn}`} 
            onClick={() => {
              if (onExecuteOutput) {
                onExecuteOutput(`$ Executing: ${selectedActionFileName}`);
              }
              executeFile(selectedActionFile, onExecuteOutput);
            }}
            title={`Execute ${selectedActionFileName}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}

        {/* 路径栏 */}
        <div className={styles.pathBar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{currentPath}</span>
        </div>
      </div>

      {/* 第二行：过滤 + 视图选项 */}
      <div className={styles.toolbarRow}>
        {/* 文本过滤 */}
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Filter name..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />

        {/* 过滤类型 */}
        <select
          className={styles.select}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          title="Filter by type"
        >
          <option value="all">All Files</option>
          <option value="code">Code</option>
          <option value="media">Media</option>
          <option value="doc">Documents</option>
        </select>

        {/* 排序选择 */}
        <select
          className={styles.select}
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          title="Sort by"
        >
          <option value="time-desc">Time ↓</option>
          <option value="time-asc">Time ↑</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="size-desc">Size ↓</option>
          <option value="size-asc">Size ↑</option>
          <option value="type">Type</option>
        </select>

        {/* 统计 */}
        <span className={styles.stats}>{itemCount} items</span>

        {/* 视图切换 - 更大的按钮 */}
        <button className={`${styles.toolbarBtn} ${styles.viewModeBtn}`} onClick={toggleViewMode} title={viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}>
          {viewMode === 'grid' ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <span>List</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span>Grid</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
