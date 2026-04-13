/**
 * FilesPage - 文件页面
 *
 * 职责：文件功能完整布局
 * - 包含 FileToolbar、FileSidebar、FileBrowser、Panel、BottomMenu
 * - 所有状态通过 Hooks 内部获取
 * - 实现 KeepAlive：首次激活才挂载，之后通过 display 控制显示隐藏
 * - 仅在文件视图激活时加载数据
 */

// ===== [ANCHOR:IMPORTS] =====

import { FileBottomMenu } from "@/features/files/components/BottomMenu/FileBottomMenu";
import { FileBrowser } from "@/features/files/components/FileBrowser/FileBrowser";
import { FileToolbar } from "@/features/files/components/Header/FileToolbar";
import { TerminalPanel } from "@/features/files/components/panels/TerminalPanel";
import { FileSidebar } from "@/features/files/components/Sidebar/FileSidebar";
import styles from "@/features/files/FilesLayout.module.css";
import { useFileBrowser, useFileNavigation } from "@/features/files/hooks";
import { useFileStore, useViewerStore } from "@/features/files/stores";
import { useAppStore } from "@/stores/appStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

// ===== [ANCHOR:COMPONENT] =====

export function FilesPage() {
  // ===== [ANCHOR:STATE] =====
  const { currentView } = useAppStore();
  const isActive = currentView === "files";

  const {
    isSidebarVisible,
    isBottomPanelOpen,
    bottomPanelHeight,
    closeBottomPanel,
    setBottomPanelHeight,
  } = useFileStore();

  // 全局工作目录（用于 FileToolbar 显示）
  const { workingDir } = useWorkspaceStore();

  const { terminalCommand, setTerminalCommand } = useViewerStore();

  // ===== [ANCHOR:HOOKS] =====
  // 仅在激活状态下加载数据
  const { refresh } = useFileBrowser({ isActive });
  const { navigateTo } = useFileNavigation();

  // ===== [ANCHOR:RENDER] =====
  return (
    <div className={styles.layout}>
      {/* FileToolbar */}
      <header className={styles.header}>
        <FileToolbar workingDir={workingDir} onRefresh={refresh} onNavigate={navigateTo} />
      </header>

      {/* Body: FileSidebar + Content */}
      <div className={styles.body}>
        {isSidebarVisible && <FileSidebar visible={true} onNavigate={navigateTo} />}

        <main className={styles.content}>
          <FileBrowser
            isActive={isActive}
            onExecuteOutput={(output) => console.log("[Files] Execute output:", output)}
            onOpenBottomPanel={setTerminalCommand}
          />
          {isBottomPanelOpen && (
            <TerminalPanel
              height={bottomPanelHeight}
              onClose={closeBottomPanel}
              onHeightChange={setBottomPanelHeight}
              initialCommand={terminalCommand}
              onExecuteCommand={(cmd) => {
                setTerminalCommand(cmd);
              }}
            />
          )}
        </main>
      </div>

      <FileBottomMenu />
    </div>
  );
}

export default FilesPage;
