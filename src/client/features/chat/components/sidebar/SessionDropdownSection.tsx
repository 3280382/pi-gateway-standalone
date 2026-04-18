/**
 * SessionDropdownSection - Session table with rich information
 *
 * 职责：
 * - 以表格形式显示所有历史 session
 * - 显示会话 ID、运行状态、消息数、最后修改时间
 * - 只在侧边栏打开时定期通过 WebSocket 更新
 * - 支持切换 session
 *
 * 注意：新建会话的唯一入口是聊天输入框右侧的新建按钮
 */

import { useCallback, useEffect } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import type { Session } from "@/features/chat/types/sidebar";
import { formatSessionId } from "@/features/chat/utils/sessionUtils";
import styles from "./SidebarPanel.module.css";

// 格式化时间为相对时间
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// 获取状态图标和颜色类名
function getStatusInfo(status: string | undefined): { icon: string; className: string; label: string } {
  switch (status) {
    case "thinking":
      return { icon: "🤔", className: styles.statusThinking, label: "Thinking" };
    case "tooling":
      return { icon: "🔧", className: styles.statusTooling, label: "Using Tools" };
    case "streaming":
      return { icon: "📝", className: styles.statusStreaming, label: "Streaming" };
    case "waiting":
      return { icon: "⏳", className: styles.statusWaiting, label: "Waiting" };
    case "error":
      return { icon: "❌", className: styles.statusError, label: "Error" };
    case "idle":
    default:
      return { icon: "💤", className: styles.statusIdle, label: "Idle" };
  }
}

export function SessionDropdownSection() {
  // ========== 1. State ==========
  const sessions = useSidebarStore((state) => state.sessions);
  const currentSessionId = useSidebarStore((state) => state.selectedSessionId);
  const runtimeStatus = useSidebarStore((state) => state.runtimeStatus);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const isSidebarVisible = useSidebarStore((state) => state.isVisible);
  const workingDir = useSessionStore((state) => state.workingDir);
  const controller = useSidebarController();

  // ========== 2. Effects ==========
  // Log runtimeStatus changes for debugging
  useEffect(() => {
    console.log("[SessionDropdown] runtimeStatus updated:", runtimeStatus);
  }, [runtimeStatus]);

  // 只在侧边栏打开时定期请求会话列表更新
  useEffect(() => {
    if (!workingDir || !isSidebarVisible) return;

    // 立即请求一次
    controller.listSessions();

    // 每 5 秒刷新一次
    const interval = setInterval(() => {
      controller.listSessions();
    }, 5000);

    return () => clearInterval(interval);
  }, [workingDir, isSidebarVisible, controller]);

  // ========== 3. Actions ==========
  const handleSelect = useCallback(
    async (session: Session) => {
      await controller.selectSession(session.id);
    },
    [controller]
  );

  // ========== 4. Computed ==========
  // 对会话进行排序：当前选中的在前，然后是活跃的，其他按最后修改时间排序
  const sortedSessions = [...sessions].sort((a, b) => {
    // 1. 当前选中的会话优先
    if (a.id === currentSessionId) return -1;
    if (b.id === currentSessionId) return 1;

    // 2. 有运行状态的会话（非 idle）优先
    const aStatus = runtimeStatus[a.id];
    const bStatus = runtimeStatus[b.id];
    const aActive = aStatus && aStatus !== "idle";
    const bActive = bStatus && bStatus !== "idle";
    
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    
    // 3. 按最后修改时间排序（最新的在前）
    const aTime = new Date(a.lastModified).getTime();
    const bTime = new Date(b.lastModified).getTime();
    return bTime - aTime;
  });

  // ========== 5. Render ==========
  if (isLoading && sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Sessions</h3>
        </div>
        <div className={styles.loading}>Loading...</div>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Sessions</h3>
        </div>
        <div className={styles.emptyText}>No sessions found</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      {/* 覆盖式 Loading 遮罩 */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>Updating...</span>
        </div>
      )}

      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Sessions ({sessions.length})</h3>
      </div>

      <div className={styles.sessionTableContainer}>
        <table className={styles.sessionTable}>
          <thead>
            <tr>
              <th className={styles.sessionTableHeader}>ID</th>
              <th className={styles.sessionTableHeader}>Status</th>
              <th className={styles.sessionTableHeader}>Messages</th>
              <th className={styles.sessionTableHeader}>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.map((session) => {
              const isSelected = session.id === currentSessionId;
              const status = runtimeStatus[session.id];
              const statusInfo = getStatusInfo(status);
              
              return (
                <tr
                  key={session.id}
                  className={`${styles.sessionTableRow} ${isSelected ? styles.sessionTableRowSelected : ""}`}
                  onClick={() => handleSelect(session)}
                >
                  <td className={styles.sessionTableCell}>
                    <span className={styles.sessionId}>
                      {formatSessionId(session.id)}
                    </span>
                    {isSelected && (
                      <span className={styles.currentIndicator} title="Current session">
                        ←
                      </span>
                    )}
                  </td>
                  <td className={styles.sessionTableCell}>
                    <span 
                      className={`${styles.statusBadge} ${statusInfo.className}`}
                      title={statusInfo.label}
                    >
                      {statusInfo.icon} {statusInfo.label}
                    </span>
                  </td>
                  <td className={styles.sessionTableCell}>
                    <span className={styles.messageCount}>
                      {session.messageCount || 0}
                    </span>
                  </td>
                  <td className={styles.sessionTableCell}>
                    <span className={styles.relativeTime}>
                      {formatRelativeTime(session.lastModified)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
