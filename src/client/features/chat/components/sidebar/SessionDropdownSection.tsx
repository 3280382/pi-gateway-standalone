/**
 * SessionDropdownSection - Session table with rich information
 *
 * Responsibilities:
 * - 以表格形式显示所有历史 session
 * - 显示会话 ID、运行状态、消息数、最后修改时间
 * - 只在侧边栏打开时定期通过 WebSocket 更新
 * - 支持切换 session
 *
 * 注意：新建会话的唯一入口是聊天输入框右侧的新建按钮
 */

import { useCallback, useEffect, useRef } from "react";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { listChatSessions } from "@/features/chat/services/chatWebSocket";
import type { Session } from "@/features/chat/types/sidebar";
import { formatSessionId } from "@/features/chat/utils/sessionUtils";
import styles from "./SidebarPanel.module.css";

// Constants
const REFRESH_INTERVAL_MS = 5000;
const DEBOUNCE_MS = 3000;

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

// 获取状态图标和Color类名
function getStatusInfo(status: string | undefined): { icon: string; className: string; label: string } {
  switch (status) {
    case "history":
      return { icon: "📜", className: styles.statusHistory, label: "History" };
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
      return { icon: "💤", className: styles.statusIdle, label: "Idle" };
    default:
      return { icon: "📜", className: styles.statusHistory, label: "History" };
  }
}

export function SessionDropdownSection() {
  console.log("[SessionDropdownSection] Rendering");
  
  // ========== 1. State ==========
  const sessions = useSidebarStore((state) => state.sessions);
  const currentSessionId = useSidebarStore((state) => state.selectedSessionId);
  const runtimeStatus = useSidebarStore((state) => state.runtimeStatus);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const isSidebarVisible = useSidebarStore((state) => state.isVisible);
  const workingDir = useSessionStore((state) => state.workingDir);
  const lastFetchRef = useRef<number>(0);

  // ========== 2. Effects ==========
  // 只在侧边栏打开时定期请求会话列表更新
  useEffect(() => {
    if (!workingDir || !isSidebarVisible) return;

    // Debounce: ensure at least DEBOUNCE_MS between requests
    const now = Date.now();
    if (now - lastFetchRef.current < DEBOUNCE_MS) return;
    lastFetchRef.current = now;

    // Fetch immediately
    listChatSessions(workingDir);

    // Refresh periodically
    const interval = setInterval(() => {
      listChatSessions(workingDir);
      lastFetchRef.current = Date.now();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [workingDir, isSidebarVisible]);

  // ========== 3. Actions ==========
  const handleSelect = useCallback(
    async (session: Session) => {
      console.log("CLICKED SESSION:", session.id, session.path);
      
      // 执行实际的session切换（让sessionManager处理状态更新）
      console.log("About to call sessionManager.selectSession...");
      await sessionManager.selectSession(session.id);
      console.log("sessionManager.selectSession DONE!");
      
      // 切换后立即刷新session列表（获取最新状态）
      if (workingDir) {
        listChatSessions(workingDir);
      }
    },
    [workingDir]
  );

  // ========== 4. Computed ==========
  // 对会话进行排序：选中 > streaming > thinking > tooling > waiting > idle > history
  // streaming/thinking/tooling 是活跃状态，优先显示
  const getStatusPriority = (status: string | undefined): number => {
    switch (status) {
      case "streaming": return 1;  // 最活跃：正在输出
      case "thinking": return 2;   // AI 思考中
      case "tooling": return 3;    // 使用工具
      case "waiting": return 4;    // waiting for user input
      case "idle": return 5;       // 空闲
      case "error": return 6;      // 错误状态
      case "history": return 7;    // 历史会话
      default: return 8; // unknown status
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    // 1. 当前选中的会话优先（最高优先级）
    if (a.id === currentSessionId) return -1;
    if (b.id === currentSessionId) return 1;

    // 2. 按状态优先级排序：waiting > thinking > tooling > idle > history
    const aPriority = getStatusPriority(runtimeStatus[a.id]);
    const bPriority = getStatusPriority(runtimeStatus[b.id]);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // 3. 相同优先级按最后修改时间排序（最新的在前）
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
                  data-session-id={session.id}
                  className={`${styles.sessionTableRow} ${isSelected ? styles.sessionTableRowSelected : ""}`}
                  onClick={() => handleSelect(session)}
                >
                  <td className={styles.sessionTableCell}>
                    <span className={`${styles.sessionId} ${isSelected ? styles.sessionIdSelected : ""}`}>
                      {formatSessionId(session.id)}
                    </span>
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
