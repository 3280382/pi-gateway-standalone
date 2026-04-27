/**
 * FileBrowser - files浏览器主Group件
 *
 * Responsibilities:UI 渲染
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
import {
  useFileBrowser,
  useFileFiltering,
  useGitStatus,
  useTodos,
  useTreeView,
} from "@/features/files/hooks";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

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
  const { viewMode, isLoading, error, currentBrowsePath } = useFileStore();

  // 使用全局 workspace store 的 workingDir（用于 todo 根directories）
  const { currentPath: workingDir } = useWorkspaceStore();

  // ===== [ANCHOR:HOOKS] =====
  // 仅在激活状态下获取数据
  useFileBrowser({ isActive });
  // 使用当前浏览路径获取 git 状态
  useGitStatus({ isActive, currentBrowsePath: currentBrowsePath || workingDir });
  // 使用全局工作directories加载 todos（所有 todo 都保存在项目根directories的 todo.md）
  useTodos({ isActive, workingDir });

  // ===== [ANCHOR:COMPUTED] =====
  const { filteredItems } = useFileFiltering();

  // ===== [ANCHOR:TREEVIEW] =====
  // Tree view数据 - 仅在 tree 视图模式下才加载
  const { treeData, isLoading: treeLoading } = useTreeView({
    isActive: isActive && viewMode === "tree",
  });

  // ===== [ANCHOR:RENDER] =====
  return (
    <section className={styles.fileBrowserSection}>
      <div className={styles.container}>
        {/* 主内容区 */}
        <div className={styles.main}>
          {/* 选中files操作栏 */}
          <FileBrowserErrorBoundary componentName="File Action Bar">
            <FileActionBar onExecute={onExecuteOutput} onOpenBottomPanel={onOpenBottomPanel} />
          </FileBrowserErrorBoundary>

          {/* 当前浏览路径显示 */}
          <div className={styles.browsePathBar}>
            <span className={styles.pathLabel}>📁</span>
            <span className={styles.pathText}>{currentBrowsePath || workingDir}</span>
          </div>

          {/* filesCols表区域 */}
          <div className={styles.contentArea}>
            {isLoading || (viewMode === "tree" && treeLoading) ? (
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
                <TreeView items={treeData} />
              </FileBrowserErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* files查看器Modal */}
      <FileViewer />
    </section>
  );
}
