/**
 * ToolMenu - 工具菜单容器
 * 职责：管理工具菜单的展开/收起，渲染工具列表
 */

import { useEffect, useRef, useState } from "react";
import { SettingsModal } from "@/app/SettingsModal";
import { DebugTool } from "@/app/Tools/DebugTool";
import { PageAgentTool } from "@/app/Tools/PageAgentTool";
import { UIMarkerTool } from "@/app/Tools/UIMarkerTool";
import { StorageViewer } from "@/app/StorageViewer";
import { ProcessTreeViewer } from "@/app/Tools/ProcessTreeViewer";
import styles from "@/app/Tools/ToolMenu.module.css";
import { IconButton } from "@/components/Icon/Icon";

export function ToolMenu() {
  // 默认关闭菜单
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

      {/* Settings Modal - 独立于菜单生命周期 */}
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
