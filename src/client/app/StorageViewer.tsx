/**
 * StorageViewer - LocalStorage viewer
 * As ToolMenu menu item
 */

import { useState } from "react";
import menuStyles from "@/app/Tools/ToolMenu.module.css";
import styles from "./StorageViewer.module.css";

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
    // 按第一级 key 名称排序
    const sortedData: Record<string, unknown> = {};
    Object.keys(data)
      .sort()
      .forEach((key) => {
        sortedData[key] = data[key];
      });
    setStorageData(sortedData);
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
