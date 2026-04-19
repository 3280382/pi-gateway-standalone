/**
 * ModernHeader - Sleek header with session info and controls
 */

import React from "react";
import { Menu, Plus, Settings, Keyboard } from "lucide-react";
import { useMobile } from "@/features/chat/hooks/useMobile";
import styles from "./ModernHeader.module.css";

interface ModernHeaderProps {
  sessionId?: string;
  modelName?: string;
  onMenuClick?: () => void;
  onNewSession?: () => void;
  onSettingsClick?: () => void;
  onShortcutsClick?: () => void;
}

export const ModernHeader: React.FC<ModernHeaderProps> = ({
  sessionId,
  modelName,
  onMenuClick,
  onNewSession,
  onSettingsClick,
  onShortcutsClick,
}) => {
  const { isMobile, toggleSidebar } = useMobile();

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      toggleSidebar();
    }
  };

  return (
    <div className={styles.container}>
      {/* Left Section */}
      <div className={styles.left}>
        {(isMobile || !onMenuClick) && (
          <button
            className={styles.iconButton}
            onClick={handleMenuClick}
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
        )}
        
        {sessionId && (
          <div className={styles.sessionInfo}>
            <span className={styles.sessionLabel}>Session</span>
            <span className={styles.sessionId}>{sessionId}</span>
          </div>
        )}
      </div>

      {/* Center Section - Model Name */}
      {modelName && (
        <div className={styles.center}>
          <span className={styles.modelName}>{modelName}</span>
        </div>
      )}

      {/* Right Section */}
      <div className={styles.right}>
        <button
          className={styles.iconButton}
          onClick={onShortcutsClick}
          aria-label="Keyboard shortcuts"
          title="Shortcuts (/)"
        >
          <Keyboard size={18} />
        </button>
        
        <button
          className={styles.iconButton}
          onClick={onSettingsClick}
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
        
        <button
          className={`${styles.iconButton} ${styles.newSessionButton}`}
          onClick={onNewSession}
          aria-label="New session"
        >
          <Plus size={18} />
          {!isMobile && <span>New</span>}
        </button>
      </div>
    </div>
  );
};

export default ModernHeader;
