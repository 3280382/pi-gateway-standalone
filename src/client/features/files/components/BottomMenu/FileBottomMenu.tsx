/**
 * FileBottomMenu - 文件功能底部菜单
 *
 * 职责：纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileBottomMenu hook 获取所有逻辑
 * - TreeView 已抽离到 modals/TreeViewModal
 */

import React from "react";
import styles from "@/features/files/components/BottomMenu/FileBottomMenu.module.css";
import { GitHistoryModal } from "@/features/files/components/modals/GitHistoryModal";
import { TodoInputModal } from "@/features/files/components/modals/TodoInputModal";
import { TreeViewModal } from "@/features/files/components/modals/TreeViewModal";
import { useFileBottomMenu } from "@/features/files/hooks";
import { useFileNavigation } from "@/features/files/hooks/useFileNavigation";
import { useFileStore } from "@/features/files/stores/fileStore";

export function FileBottomMenu() {
  const {
    isNewModalOpen,
    isDeleteModalOpen,
    isTreeModalOpen,
    newFileName,
    treeData,
    treeLoading,
    setNewFileName,
    handleNewClick,
    handleConfirmNew,
    handleCancelNew,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    handleTreeClick,
    handleTreeFileClick,
    handleCloseTree,
  } = useFileBottomMenu();

  // 导航功能
  const { navigateUp, navigateHome, canNavigateUp } = useFileNavigation();
  // 刷新功能
  const { refresh, viewMode, toggleViewMode } = useFileStore();
  // Git 模式
  const { isGitModeActive, toggleGitMode, gitHistoryFile, setGitHistoryFile } = useFileStore();
  // Todo 模式
  const { isTodoModeActive, toggleTodoMode, todoInputFile, setTodoInputFile } = useFileStore();

  return (
    <>
      <div className={styles.menu}>
        {/* 导航按钮组 */}
        <button className={`${styles.btn} ${styles.navBtn}`} onClick={navigateHome} title="Home">
          <HomeIcon />
        </button>
        <button
          className={`${styles.btn} ${styles.navBtn}`}
          onClick={() => window.location.reload()}
          title="Refresh"
        >
          <RefreshIcon />
        </button>
        <button
          className={`${styles.btn} ${styles.navBtn}`}
          onClick={navigateUp}
          disabled={!canNavigateUp}
          title="Go Up"
        >
          <UpIcon />
        </button>
        {/* 分隔 */}
        <div className={styles.divider} />
        {/* 视图切换 */}
        <button
          className={`${styles.btn} ${styles.viewBtn}`}
          onClick={toggleViewMode}
          title={viewMode === "grid" ? "List View" : "Grid View"}
        >
          {viewMode === "grid" ? <ListIcon /> : <GridIcon />}
        </button>
        {/* 分隔 */}
        <div className={styles.divider} />
        {/* 原有按钮 */}
        <button
          className={`${styles.btn} ${styles.newBtn}`}
          onClick={handleNewClick}
          title="New File"
        >
          <NewIcon />
        </button>
        <button
          className={`${styles.btn} ${styles.treeBtn}`}
          onClick={handleTreeClick}
          title="Tree View"
        >
          <TreeIcon />
        </button>
        <button
          className={`${styles.btn} ${styles.deleteBtn}`}
          onClick={handleDeleteClick}
          title="Delete"
        >
          <DeleteIcon />
        </button>
        {/* 分隔 */}
        <div className={styles.divider} />
        {/* Git 模式按钮 */}
        <button
          className={`${styles.btn} ${styles.gitBtn} ${isGitModeActive ? styles.active : ""}`}
          onClick={toggleGitMode}
          title={isGitModeActive ? "Git Mode (Active)" : "Git Mode"}
        >
          <GitIcon />
        </button>
        {/* Todo 按钮 */}
        <button
          className={`${styles.btn} ${styles.todoBtn} ${isTodoModeActive ? styles.active : ""}`}
          onClick={toggleTodoMode}
          title={isTodoModeActive ? "Todo Mode (Active)" : "Todo Mode"}
        >
          <TodoIcon />
        </button>
      </div>

      {/* 新建文件对话框 */}
      {isNewModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCancelNew}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>New File</div>
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Enter file name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmNew();
                  if (e.key === "Escape") handleCancelNew();
                }}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={`${styles.modalBtn} ${styles.cancelBtn}`}
                onClick={handleCancelNew}
              >
                Cancel
              </button>
              <button
                className={`${styles.modalBtn} ${styles.confirmBtn}`}
                onClick={handleConfirmNew}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {isDeleteModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCancelDelete}>
          <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteModalTitle}>
              <WarningIcon />
              Confirm Delete
            </div>
            <div className={styles.modalActions}>
              <button
                className={`${styles.modalBtn} ${styles.cancelBtn}`}
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                className={`${styles.modalBtn} ${styles.confirmBtn}`}
                onClick={handleConfirmDelete}
                style={{ background: "var(--accent-red)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 树状视图 - 使用抽离的 TreeViewModal 组件 */}
      <TreeViewModal
        isOpen={isTreeModalOpen}
        treeData={treeData}
        treeLoading={treeLoading}
        onClose={handleCloseTree}
        onFileClick={handleTreeFileClick}
      />

      {/* Git 历史弹窗 */}
      {gitHistoryFile && (
        <GitHistoryModal
          isOpen={!!gitHistoryFile}
          filePath={gitHistoryFile.path}
          fileName={gitHistoryFile.name}
          onClose={() => setGitHistoryFile(null)}
        />
      )}

      {/* Todo 输入弹窗 */}
      {todoInputFile && (
        <TodoInputModal
          isOpen={!!todoInputFile}
          filePath={todoInputFile.path}
          fileName={todoInputFile.name}
          onClose={() => setTodoInputFile(null)}
        />
      )}
    </>
  );
}

// Icons
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function NewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 3v18M12 8l-4-4M12 8l4-4M8 12H4m16 0h-4M8 16H4m16 0h-4M8 20H4m16 0h-4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="20"
      height="20"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function GitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8V4" />
      <path d="M12 20v-4" />
      <path d="M4 12h4" />
      <path d="M16 12h4" />
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="16" r="2" />
      <path d="M8 10V6" />
      <path d="M16 18v-4" />
    </svg>
  );
}

function TodoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
