/**
 * StorageViewer - LocalStorage 查看器
 * 放在全局 Footer 右下角
 */

import { useState } from "react";
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
    setStorageData(data);
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={styles.storageBtn}
        onClick={handleClick}
        title="View LocalStorage"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="3" width="20" height="7" rx="2" />
          <rect x="2" y="14" width="20" height="7" rx="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="17" x2="6.01" y2="17" />
        </svg>
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
