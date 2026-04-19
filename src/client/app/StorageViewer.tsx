/**
 * StorageViewer - LocalStorage 查看器
 * 作为 ToolMenu 的菜单项
 */

import { useState } from "react";
import styles from "./StorageViewer.module.css";
import menuStyles from "@/app/Tools/ToolMenu.module.css";

export function StorageViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [storageData, setStorageData] = useState<Record<string, unknown>>({});

  const handleClick = () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            data[key] = JSON.parse(value);
          } else {
            data[key] = null;
          }
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    setStorageData(data);
    setIsOpen(true);
  };

  return (
    <>
      <button type="button" className={menuStyles.item} onClick={handleClick}>
        <span className={menuStyles.menuIcon}>💾</span>
        <span>Storage</span>
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <span className={styles.title}>LocalStorage</span>
              <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>
            <div className={styles.content}>
              <pre>{JSON.stringify(storageData, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
