/**
 * FileBottomMenu - files功能底部菜单
 *
 * Responsibilities:纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileBottomMenu hook 获取所有逻辑
 */

import { useRef, useState } from "react";
import styles from "@/features/files/components/BottomMenu/FileBottomMenu.module.css";
import { GitHistoryModal } from "@/features/files/components/modals/GitHistoryModal";
import { TodoInputModal } from "@/features/files/components/modals/TodoInputModal";
import { useFileBottomMenu } from "@/features/files/hooks";
import { useFileNavigation } from "@/features/files/hooks/useFileNavigation";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useTerminalStore } from "@/features/files/stores/terminalStore";
import type { ViewMode } from "@/features/files/types";

export function FileBottomMenu() {
  const {
    isNewModalOpen,
    isDeleteModalOpen,
    newFileName,
    newItemType,
    setNewFileName,
    setNewItemType,
    handleNewClick,
    handleConfirmNew,
    handleCancelNew,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  } = useFileBottomMenu();

  // Navigation功能
  const { navigateUp, navigateHome, canNavigateUp } = useFileNavigation();
  // View和Refresh功能
  const { viewMode, setViewMode } = useFileStore();

  // View选择弹窗状态
  const [isViewSelectorOpen, setIsViewSelectorOpen] = useState(false);
  const viewBtnRef = useRef<HTMLButtonElement>(null);

  // Git 模式
  const { isGitModeActive, toggleGitMode, gitHistoryFile, setGitHistoryFile } = useFileStore();
  // Todo 模式
  const { isTodoModeActive, toggleTodoMode, todoInputFile, setTodoInputFile } = useFileStore();
  // Terminal
  const { isPanelOpen, togglePanel } = useTerminalStore();

  // 打开视图选择器
  const openViewSelector = () => {
    setIsViewSelectorOpen(true);
  };

  // 选择视图模式
  const selectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setIsViewSelectorOpen(false);
  };

  return (
    <>
      <div className={styles.menu}>
        {/* 导航按钮Group */}
        <button
          type="button"
          className={`${styles.btn} ${styles.navBtn}`}
          onClick={navigateHome}
          title="Home"
        >
          <HomeIcon />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.navBtn}`}
          onClick={() => window.location.reload()}
          title="Refresh"
        >
          <RefreshIcon />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.navBtn}`}
          onClick={navigateUp}
          disabled={!canNavigateUp}
          title="Go Up"
        >
          <UpIcon />
        </button>
        {/* 分隔 */}
        <div className={styles.divider} />
        {/* 视图切换 - 点击弹出选择 */}
        <button
          type="button"
          ref={viewBtnRef}
          className={`${styles.btn} ${styles.viewBtn}`}
          onClick={openViewSelector}
          title={`Current: ${viewMode} (click to select)`}
        >
          {viewMode === "grid" ? <GridIcon /> : viewMode === "list" ? <ListIcon /> : <TreeIcon />}
        </button>
        {/* 分隔 */}
        <div className={styles.divider} />
        {/* 原有按钮 */}
        <button
          type="button"
          className={`${styles.btn} ${styles.newBtn}`}
          onClick={handleNewClick}
          title="New File"
        >
          <NewIcon />
        </button>

        <button
          type="button"
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
          type="button"
          className={`${styles.btn} ${styles.gitBtn} ${isGitModeActive ? styles.active : ""}`}
          onClick={toggleGitMode}
          title={isGitModeActive ? "Git Mode (Active)" : "Git Mode"}
        >
          <GitIcon />
        </button>
        {/* Todo 按钮 */}
        <button
          type="button"
          className={`${styles.btn} ${styles.todoBtn} ${isTodoModeActive ? styles.active : ""}`}
          onClick={toggleTodoMode}
          title={isTodoModeActive ? "Todo Mode (Active)" : "Todo Mode"}
        >
          <TodoIcon />
        </button>
        {/* 分隔 */}
        <div className={styles.divider} />
        {/* Terminal 按钮 */}
        <button
          type="button"
          className={`${styles.btn} ${styles.terminalBtn} ${isPanelOpen ? styles.active : ""}`}
          onClick={togglePanel}
          title={isPanelOpen ? "Close Terminal" : "Open Terminal"}
        >
          <TerminalIcon />
        </button>
      </div>

      {/* 视图选择弹窗 - 紧凑型，贴在按钮顶部 */}
      {isViewSelectorOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsViewSelectorOpen(false)} />
          <div
            className={styles.viewSelectorCompact}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              bottom: "52px",
              left: viewBtnRef.current ? viewBtnRef.current.getBoundingClientRect().left : "50%",
              transform: viewBtnRef.current ? "none" : "translateX(-50%)",
            }}
          >
            <button
              type="button"
              className={`${styles.viewOptionCompact} ${viewMode === "grid" ? styles.active : ""}`}
              onClick={() => selectViewMode("grid")}
              title="Grid"
            >
              <GridIcon />
            </button>
            <button
              type="button"
              className={`${styles.viewOptionCompact} ${viewMode === "list" ? styles.active : ""}`}
              onClick={() => selectViewMode("list")}
              title="List"
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className={`${styles.viewOptionCompact} ${viewMode === "tree" ? styles.active : ""}`}
              onClick={() => selectViewMode("tree")}
              title="Tree"
            >
              <TreeIcon />
            </button>
          </div>
        </>
      )}

      {/* 新建files/directories对话框 */}
      {isNewModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCancelNew}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              New {newItemType === "file" ? "File" : "Directory"}
            </div>
            {/* 类型选择 */}
            <div className={styles.typeSelector}>
              <button
                type="button"
                className={`${styles.typeBtn} ${newItemType === "file" ? styles.typeBtnActive : ""}`}
                onClick={() => setNewItemType("file")}
              >
                <FileIcon />
                File
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${newItemType === "directory" ? styles.typeBtnActive : ""}`}
                onClick={() => setNewItemType("directory")}
              >
                <FolderIcon />
                Directory
              </button>
            </div>
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={
                  newItemType === "file" ? "Enter file name..." : "Enter directory name..."
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmNew();
                  if (e.key === "Escape") handleCancelNew();
                }}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.modalBtn} ${styles.cancelBtn}`}
                onClick={handleCancelNew}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.modalBtn} ${styles.confirmBtn}`}
                onClick={handleConfirmNew}
              >
                Create
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
                type="button"
                className={`${styles.modalBtn} ${styles.cancelBtn}`}
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                type="button"
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
  return <span style={{ fontSize: "14px", fontWeight: "bold", lineHeight: "1" }}>..</span>;
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

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="16"
      height="16"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="16"
      height="16"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
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

function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
