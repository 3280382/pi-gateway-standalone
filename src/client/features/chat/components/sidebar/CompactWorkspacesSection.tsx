/**
 * CompactWorkspacesSection - 最近工作directories列表
 *
 * 最多显示3个最近使用的工作directories
 * 当前选中的蓝色高亮
 * 点击切换工作directories（后台 session 继续运行）
 */

import { useCallback } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import styles from "./SidebarPanel.module.css";

export function CompactWorkspacesSection() {
  const workingDir = useSidebarStore((state) => state.workingDir);
  const recentWorkspaces = useSidebarStore((state) => state.recentWorkspaces);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const controller = useSidebarController();

  const currentPath = workingDir?.path || "";

  const handleSwitch = useCallback(
    (path: string) => {
      if (path && path !== currentPath) {
        controller.changeWorkingDir(path);
      }
    },
    [controller, currentPath]
  );

  // 如果没有 recentWorkspaces，只显示当前工作directories
  const workspaces =
    recentWorkspaces.length > 0
      ? recentWorkspaces
      : currentPath
        ? [{ path: currentPath, displayName: currentPath.split("/").pop() || currentPath }]
        : [];

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Workspace</h3>
        {isLoading && <span className={styles.headerLoadingIndicator} />}
      </div>
      <div className={styles.compactList}>
        {workspaces.map((ws) => {
          const isActive = ws.path === currentPath;
          return (
            <button
              key={ws.path}
              type="button"
              className={`${styles.compactItem} ${isActive ? styles.active : ""}`}
              onClick={() => handleSwitch(ws.path)}
              title={ws.path}
              disabled={isLoading}
            >
              <div className={styles.folderIcon}>{isActive ? "📂" : "📁"}</div>
              <div className={styles.compactInfo}>
                <span className={styles.compactName}>{ws.displayName}</span>
                <span className={styles.compactPath}>{ws.path}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
