/**
 * UIMarkerTool - UI Marker 工具
 * 职责：点击红色按钮后显示 UI Marker 功能
 */

import { useCallback, useState, useEffect } from "react";
import styles from "@/app/Tools/ToolMenu.module.css";

// 扩展 Window 接口以包含 uiMarker
declare global {
  interface Window {
    uiMarker?: {
      activate: () => void;
      deactivate: () => void;
      toggle: () => void;
      isActive?: boolean;
    };
  }
}

// localStorage 键
const UI_MARKER_KEY = "UI_MARKER_ENABLED";

export function UIMarkerTool() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  // 读取初始状态
  useEffect(() => {
    try {
      const value = localStorage.getItem(UI_MARKER_KEY);
      const enabled = value === "true";
      setIsEnabled(enabled);
    } catch {
      setIsEnabled(false);
    }
  }, []);

  // 激活 UI Marker 功能
  const activate = useCallback(() => {
    setIsActivated(true);
    
    // 等待 ui-marker.js 加载
    const activateMarker = () => {
      if (window.uiMarker) {
        window.uiMarker.activate();
        setIsEnabled(true);
        localStorage.setItem(UI_MARKER_KEY, "true");
        console.log("[UIMarkerTool] UI Marker activated");
      } else {
        console.warn("[UIMarkerTool] window.uiMarker not found");
      }
    };

    if (window.uiMarker) {
      activateMarker();
    } else {
      // 等待加载
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.uiMarker) {
          clearInterval(checkInterval);
          activateMarker();
        } else if (attempts > 50) { // 5秒超时
          clearInterval(checkInterval);
          console.warn("[UIMarkerTool] window.uiMarker not found after 5 seconds");
        }
      }, 100);
    }
  }, []);

  // 停用 UI Marker
  const deactivate = useCallback(() => {
    if (window.uiMarker) {
      window.uiMarker.deactivate();
    }
    setIsEnabled(false);
    setIsActivated(false);
    localStorage.setItem(UI_MARKER_KEY, "false");
    console.log("[UIMarkerTool] UI Marker deactivated");
  }, []);

  // 如果未激活，显示红色激活按钮
  if (!isActivated) {
    return (
      <button type="button" className={styles.item} onClick={activate}>
        <span className={styles.menuIcon} style={{ color: "#ff4444" }}>●</span>
        <span style={{ color: "#ff4444" }}>UI Marker</span>
      </button>
    );
  }

  // 已激活，显示开关
  return (
    <button type="button" className={styles.item} onClick={deactivate}>
      <span className={styles.menuIcon} style={{ color: "#ff4444" }}>●</span>
      <span>UI Marker</span>
      <span style={{ marginLeft: "auto", color: "#4CAF50" }}>✓</span>
    </button>
  );
}
