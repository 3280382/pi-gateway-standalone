/**
 * FileBrowser - 文件浏览器主组件
 *
 * 职责：UI 渲染
 * - 不包含业务逻辑
 * - 通过 hooks 获取数据和操作
 * - 仅在激活状态时加载数据
 */

// ===== [ANCHOR:IMPORTS] =====

import styles from "@/features/files/components/FileBrowser/FileBrowser.module.css";
import { FileBrowserErrorBoundary } from "@/features/files/components/FileBrowser/FileBrowserErrorBoundary";
import { FileGrid } from "@/features/files/components/FileBrowser/FileGrid";
import { FileList } from "@/features/files/components/FileBrowser/FileList";
import { TreeView } from "@/features/files/components/FileBrowser/TreeView";

import { FileActionBar } from "@/features/files/components/Header/FileActionBar";
import { FileViewer } from "@/features/files/components/modals/FileViewer";
import { useFileBrowser, useFileFiltering, useGitStatus, useTreeView } from "@/features/files/hooks";
import { useFileStore } from "@/features/files/stores/fileStore";

// ===== [ANCHOR:TYPES] =====

interface FileBrowserProps {
  /** 是否处于激活状态 - 控制数据加载 */
  isActive?: boolean;
  onExecuteOutput?: (output: string) => void;
  onOpenBottomPanel?: (output: string) => void;
}

// ===== [ANCHOR:COMPONENT] =====

export function FileBrowser({
  isActive = true,
  onExecuteOutput,
  onOpenBottomPanel,
}: FileBrowserProps) {
  // ===== [ANCHOR:STATE] =====
  const { viewMode, isLoading, error } = useFileStore();

  // ===== [ANCHOR:HOOKS] =====
  // 仅在激活状态下获取数据
  useFileBrowser({ isActive });
  useGitStatus({ isActive });

  // ===== [ANCHOR:COMPUTED] =====
  const { filteredItems } = useFileFiltering();

  // ===== [ANCHOR:TREEVIEW] =====
  // 树形视图数据和过滤状态
  const {
    treeData,
    isLoading: treeLoading,
    filterMode,
    searchText,
    setFilterMode,
    setSearchText,
  } = useTreeView();

  // ===== [ANCHOR:RENDER] =====
  return (
    <section className={styles.fileBrowserSection}>
      <div className={styles.container}>
        {/* 主内容区 */}
        <div className={styles.main}>
          {/* 选中文件操作栏 */}
          <FileBrowserErrorBoundary componentName="File Action Bar">
            <FileActionBar onExecute={onExecuteOutput} onOpenBottomPanel={onOpenBottomPanel} />
          </FileBrowserErrorBoundary>

          {/* TreeView过滤栏（仅在tree视图显示） */}
          {viewMode === "tree" && (
            <div className={styles.treeFilterBar}>
              <select
                className={styles.filterSelect}
                value={filterMode}
                onChange={(e) => {
                  setFilterMode(e.target.value as "normal" | "all" | "search");
                  if (e.target.value !== "search") setSearchText("");
                }}
              >
                <option value="normal">隐藏排除</option>
                <option value="all">显示所有</option>
                <option value="search">搜索过滤...</option>
              </select>
              {filterMode === "search" && (
                <input
                  className={styles.searchInput}
                  placeholder="输入过滤文字..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              )}
            </div>
          )}

          {/* 文件列表区域 */}
          <div className={styles.contentArea}>
            {isLoading || treeLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : viewMode === "grid" ? (
              <FileBrowserErrorBoundary componentName="File Grid">
                <FileGrid items={filteredItems} />
              </FileBrowserErrorBoundary>
            ) : viewMode === "list" ? (
              <FileBrowserErrorBoundary componentName="File List">
                <FileList items={filteredItems} />
              </FileBrowserErrorBoundary>
            ) : (
              <FileBrowserErrorBoundary componentName="Tree View">
                <TreeView
                  items={treeData}
                  filterMode={filterMode}
                  searchText={searchText}
                />
              </FileBrowserErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* 文件查看器模态框 */}
      <FileViewer />
    </section>
  );
}
