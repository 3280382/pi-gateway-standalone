/**
 * SessionDropdownSection - Session table with rich information
 *
 * Responsibilities:
 * - Display sessions in a two-row compact format
 * - Row 1: ID, Status, Message Count, Last Activity
 * - Row 2: Editable Name and Summary
 * - Support inline name editing with blur save
 * - Auto-initialize session config on load
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteSession, updateSessionName } from "@/features/chat/services/api/sessionConfigApi";
import { listChatSessions } from "@/features/chat/services/chatWebSocket";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import { formatSessionId } from "@/features/chat/utils/sessionUtils";
import styles from "./SidebarPanel.module.css";

// Constants
const REFRESH_INTERVAL_MS = 5000;
const DEBOUNCE_MS = 3000;

// Format relative time
function formatRelativeTime(dateInput: Date | string): string {
  const dateString = dateInput instanceof Date ? dateInput.toISOString() : dateInput;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString();
}

// Get status icon and class
function getStatusInfo(status: string | undefined): {
  icon: string;
  className: string;
  label: string;
} {
  switch (status) {
    case "history":
      return { icon: "📜", className: styles.statusHistory, label: "History" };
    case "thinking":
      return { icon: "🤔", className: styles.statusThinking, label: "Thinking" };
    case "tooling":
      return { icon: "🔧", className: styles.statusTooling, label: "Tools" };
    case "streaming":
      return { icon: "📝", className: styles.statusStreaming, label: "Streaming" };
    case "waiting":
      return { icon: "⏳", className: styles.statusWaiting, label: "Waiting" };
    case "error":
      return { icon: "❌", className: styles.statusError, label: "Error" };
    case "idle":
      return { icon: "💤", className: styles.statusIdle, label: "Idle" };
    case "retrying":
      return { icon: "🔄", className: styles.statusRetrying, label: "Retry" };
    case "compacting":
      return { icon: "📦", className: styles.statusCompacting, label: "Compact" };
    default:
      return { icon: "📜", className: styles.statusHistory, label: "History" };
  }
}

// Single session row component with inline editing
interface SessionRowProps {
  session: Session;
  isSelected: boolean;
  status: string | undefined;
  onSelect: () => void;
}

function SessionRow({ session, isSelected, status, onSelect }: SessionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 点击编辑图标进入编辑状态，再次点击保存
  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isEditing) {
        // 保存
        if (editName.trim() && editName !== session.name) {
          updateSessionName(session.id, editName.trim());
        }
        setIsEditing(false);
      } else {
        // 进入编辑状态
        setIsEditing(true);
        setEditName(session.name);
      }
    },
    [isEditing, editName, session.name, session.id]
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    deleteSession(session.id);
    setShowConfirm(false);
  }, [session.id]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const handleSave = useCallback(() => {
    if (editName.trim() && editName !== session.name) {
      updateSessionName(session.id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, session.id, session.name]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setEditName(session.name);
        setIsEditing(false);
      }
    },
    [handleSave, session.name]
  );

  const statusInfo = getStatusInfo(status);

  return (
    <div
      className={`${styles.sessionRow} ${isSelected ? styles.sessionRowSelected : ""}`}
      onClick={onSelect}
    >
      {/* Row 1: ID, Status, Count, Time */}
      <div className={styles.sessionRowPrimary}>
        <div className={styles.sessionIdContainer}>
          <span className={`${styles.sessionId} ${isSelected ? styles.sessionIdSelected : ""}`}>
            {formatSessionId(session.id)}
          </span>
          {session.hasClient && (
            <span className={styles.clientIndicator} title="Active client connected">
              ●
            </span>
          )}
        </div>

        <div className={styles.sessionMeta}>
          <span
            className={`${styles.statusBadge} ${statusInfo.className}`}
            title={statusInfo.label}
          >
            {statusInfo.icon} {statusInfo.label}
          </span>
          <span className={styles.messageCount}>{session.messageCount || 0}</span>
          <span className={styles.relativeTime}>{formatRelativeTime(session.lastModified)}</span>
        </div>
      </div>

      {/* Row 2: Name (editable) and Agent Name */}
      <div className={styles.sessionRowSecondary}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className={styles.nameInput}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className={styles.sessionName}>{session.name || "Untitled"}</span>
            {session.agentName && (
              <span className={styles.agentTag} title={`Agent: ${session.agentName}`}>
                🤖 {session.agentName}
              </span>
            )}
          </>
        )}
        <span
          className={styles.editIcon}
          onClick={handleEditClick}
          title={isEditing ? "Save" : "Edit name"}
        >
          {isEditing ? "✓" : "✎"}
        </span>
        {!isEditing && (
          <span className={styles.deleteIcon} onClick={handleDeleteClick} title="Delete session">
            🗑
          </span>
        )}
      </div>

      {showConfirm && (
        <div className={styles.confirmOverlay} onClick={handleCancelDelete}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <p className={styles.confirmText}>
              Delete session <strong>{session.name || "Untitled"}</strong>?
            </p>
            <p className={styles.confirmSubtext}>
              This will permanently remove the session file and its log.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className={styles.confirmDelete} onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionDropdownSection() {
  // ========== 1. State ==========
  const sessions = useSidebarStore((state) => state.sessions);
  const currentSessionId = useSidebarStore((state) => state.selectedSessionId);
  const runtimeStatus = useSidebarStore((state) => state.runtimeStatus);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const isSidebarVisible = useSidebarStore((state) => state.isVisible);
  const workingDir = useSessionStore((state) => state.workingDir);
  const lastFetchRef = useRef<number>(0);

  // ========== 2. Effects ==========
  useEffect(() => {
    if (!workingDir || !isSidebarVisible) return;

    const now = Date.now();
    if (now - lastFetchRef.current < DEBOUNCE_MS) return;
    lastFetchRef.current = now;

    listChatSessions(workingDir);

    const interval = setInterval(() => {
      listChatSessions(workingDir);
      lastFetchRef.current = Date.now();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [workingDir, isSidebarVisible]);

  // ========== 3. Actions ==========
  const handleSelect = useCallback(
    async (session: Session) => {
      await sessionManager.selectSession(session.id);
      if (workingDir) {
        listChatSessions(workingDir);
      }
    },
    [workingDir]
  );

  // ========== 4. Computed ==========
  const getStatusPriority = (status: string | undefined): number => {
    switch (status) {
      case "streaming":
        return 1;
      case "thinking":
        return 2;
      case "tooling":
        return 3;
      case "retrying":
        return 4;
      case "compacting":
        return 5;
      case "waiting":
        return 6;
      case "idle":
        return 7;
      case "error":
        return 8;
      case "history":
        return 9;
      default:
        return 10;
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.id === currentSessionId) return -1;
    if (b.id === currentSessionId) return 1;

    const aPriority = getStatusPriority(runtimeStatus[a.id]);
    const bPriority = getStatusPriority(runtimeStatus[b.id]);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

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
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>
          Sessions ({sessions.length})
          {isLoading && <span className={styles.headerLoadingIndicator} />}
        </h3>
      </div>

      <div className={styles.sessionListContainer}>
        {sortedSessions.slice(0, 15).map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isSelected={session.id === currentSessionId}
            status={runtimeStatus[session.id]}
            onSelect={() => handleSelect(session)}
          />
        ))}
      </div>
    </section>
  );
}
