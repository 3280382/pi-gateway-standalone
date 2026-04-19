/**
 * CompactWorkspacesSection - 当前工作directories显示
 *
 * 简化版：只显示当前工作directories
 * （recentWorkspaces 功能已移除）
 */

import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import styles from "./SidebarPanel.module.css";

export function CompactWorkspacesSection() {
  const workingDir = useSidebarStore((state) => state.workingDir);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const controller = useSidebarController();

  const currentPath = workingDir?.path || "";
  const displayName = workingDir?.displayName || currentPath.split("/").pop() || "~";

  const handleClick = () => {
    if (currentPath) {
      controller.changeWorkingDir(currentPath);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Workspace</h3>
        </div>
        <div className={styles.loading}>Loading...</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Workspace</h3>
      </div>
      <div className={styles.compactList}>
        <button
          type="button"
          className={`${styles.compactItem} ${styles.active}`}
          onClick={handleClick}
          title={currentPath}
        >
          <div className={styles.folderIcon}>📁</div>
          <div className={styles.compactInfo}>
            <span className={styles.compactName}>{displayName}</span>
            <span className={styles.compactPath}>{currentPath}</span>
          </div>
        </button>
      </div>
    </section>
  );
}
