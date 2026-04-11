/**
 * CompactWorkspacesSection - Compact workspace list display
 * Show up to 3 items with "more" button to expand
 */

import { useCallback, useState } from "react";
import { IconButton } from "@/components/Icon/Icon";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useWorkspaceStore } from "@/features/files/stores";
import styles from "./SidebarPanel.module.css";

interface CompactWorkspacesSectionProps {
  maxItems?: number;
}

export function CompactWorkspacesSection({ maxItems = 3 }: CompactWorkspacesSectionProps) {
  // ========== 1. State ==========
  const recentWorkspaces = useWorkspaceStore((state) => state.recentWorkspaces);
  const clearRecentWorkspaces = useWorkspaceStore((state) => state.clearRecentWorkspaces);
  const workingDir = useSidebarStore((state) => state.workingDir);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const controller = useSidebarController();
  const [expanded, setExpanded] = useState(false);

  // ========== 4. Computed ==========
  const currentPath = workingDir?.path || "";
  const displayWorkspaces = expanded ? recentWorkspaces : recentWorkspaces.slice(0, maxItems);
  const hasMore = recentWorkspaces.length > maxItems;

  // ========== 5. Actions ==========
  const handleClear = useCallback(() => {
    clearRecentWorkspaces();
  }, [clearRecentWorkspaces]);

  const handleSelect = useCallback(
    (path: string) => {
      controller.changeWorkingDir(path);
    },
    [controller]
  );

  const toggleExpand = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  // ========== 6. Render ==========
  if (isLoading && recentWorkspaces.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Workspaces</h3>
        </div>
        <div className={styles.loading}>Loading...</div>
      </section>
    );
  }

  if (recentWorkspaces.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Workspaces</h3>
        </div>
        <div className={styles.empty}>No workspaces</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Workspaces</h3>
        <div className={styles.sectionActions}>
          {hasMore && (
            <button
              type="button"
              className={styles.moreButton}
              onClick={toggleExpand}
              title={expanded ? "Collapse" : "Show more"}
            >
              {expanded ? "Collapse" : "More"}
            </button>
          )}
          <IconButton
            name="trash"
            onClick={handleClear}
            title="Clear history"
            className={styles.clearButton}
          />
        </div>
      </div>
      <div className={styles.compactList}>
        {displayWorkspaces.map((safeWorkspace) => {
          const path = safeWorkspace.replace(/\/$/, "");
          const name = path.split("/").pop() || path;
          const isActive = currentPath === path || currentPath === safeWorkspace;

          return (
            <button
              type="button"
              key={path}
              className={`${styles.compactItem} ${isActive ? styles.active : ""}`}
              onClick={() => handleSelect(path)}
              title={path}
            >
              <div className={styles.folderIcon}>📁</div>
              <div className={styles.compactInfo}>
                <span className={styles.compactName}>{name}</span>
                <span className={styles.compactPath}>{path}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
