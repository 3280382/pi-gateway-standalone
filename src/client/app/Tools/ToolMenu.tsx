/**
 * ToolMenu - Tool menu container
 * Responsibilities: Manage tool menu expand/collapse, render tool list
 */

import { useEffect, useRef, useState } from "react";
import { SettingsModal } from "@/app/SettingsModal";
import { StorageViewer } from "@/app/StorageViewer";
import { DebugTool } from "@/app/Tools/DebugTool";
import { PageAgentTool } from "@/app/Tools/PageAgentTool";
import { ProcessTreeViewer } from "@/app/Tools/ProcessTreeViewer";
import styles from "@/app/Tools/ToolMenu.module.css";
import { UIMarkerTool } from "@/app/Tools/UIMarkerTool";
import { IconButton } from "@/components/Icon/Icon";

export function ToolMenu() {
  // Default close menu
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close menu
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
        <IconButton
          name="tools"
          variant={isOpen ? "primary" : "toggle"}
          onClick={() => setIsOpen(!isOpen)}
          title="Tools"
        />

        {isOpen && (
          <div className={styles.menu}>
            <DebugTool />
            <PageAgentTool />
            <UIMarkerTool />
            <StorageViewer />
            <ProcessTreeViewer />
            <div className={styles.divider} />
            <button type="button" className={styles.item} onClick={openSettings}>
              <span className={styles.menuIcon}>⚙️</span>
              <span>Settings</span>
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal - Independent of menu lifecycle */}
      {isSettingsOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsSettingsOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsSettingsOpen(false)}
          role="button"
          tabIndex={0}
        >
          <div
            className={styles.popup}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
          >
            <SettingsModal />
          </div>
        </div>
      )}
    </>
  );
}
