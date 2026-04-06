/**
 * ToolMenu - 工具菜单容器
 * 职责：管理工具菜单的展开/收起，渲染工具列表
 */

import { useEffect, useRef, useState } from "react";
import { DebugTool } from "@/app/Tools/DebugTool";
import { PageAgentTool } from "@/app/Tools/PageAgentTool";
import { SettingsModal } from "@/app/SettingsModal";
import styles from "@/app/Tools/ToolMenu.module.css";

export function ToolMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  return (
    <>
      <div className={styles.container} ref={menuRef}>
        <button
          className={`${styles.trigger} ${isOpen ? styles.active : ""}`}
          onClick={() => setIsOpen(!isOpen)}
          title="Tools"
        >
          <ToolsIcon />
        </button>

        {isOpen && (
          <div className={styles.menu}>
            <DebugTool />
            <PageAgentTool />
            <div className={styles.divider} />
            <SettingsButton onClick={openSettings} />
          </div>
        )}
      </div>

      {/* Settings Modal - 独立于菜单生命周期 */}
      {isSettingsOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            <SettingsModal />
          </div>
        </div>
      )}
    </>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.item} onClick={onClick} title="Settings">
      <SettingsIcon />
      <span>Settings</span>
    </button>
  );
}

function ToolsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l-4.24-4.24M6.34 6.34L2.1 2.1" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
