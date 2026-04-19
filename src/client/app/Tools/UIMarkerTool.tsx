/**
 * UIMarkerTool - UI Marker tool
 * Responsibilities:点击红色按钮后显示 UI Marker 功能
 */

import { useCallback, useState, useEffect } from "react";
import styles from "@/app/Tools/ToolMenu.module.css";

// Extend Window interface for uiMarker
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

// localStorage key
const UI_MARKER_KEY = "UI_MARKER_ENABLED";

export function UIMarkerTool() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  // Read initial state
  useEffect(() => {
    try {
      const value = localStorage.getItem(UI_MARKER_KEY);
      const enabled = value === "true";
      setIsEnabled(enabled);
    } catch {
      setIsEnabled(false);
    }
  }, []);

  // Activate UI Marker functionality
  const activate = useCallback(() => {
    setIsActivated(true);
    
    // Wait for ui-marker.js to load
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
      // Wait for loading
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.uiMarker) {
          clearInterval(checkInterval);
          activateMarker();
        } else if (attempts > 50) { // 5 second timeout
          clearInterval(checkInterval);
          console.warn("[UIMarkerTool] window.uiMarker not found after 5 seconds");
        }
      }, 100);
    }
  }, []);

  // Deactivate UI Marker
  const deactivate = useCallback(() => {
    if (window.uiMarker) {
      window.uiMarker.deactivate();
    }
    setIsEnabled(false);
    setIsActivated(false);
    localStorage.setItem(UI_MARKER_KEY, "false");
    console.log("[UIMarkerTool] UI Marker deactivated");
  }, []);

  // If not activated, show red activation button
  if (!isActivated) {
    return (
      <button type="button" className={styles.item} onClick={activate}>
        <span className={styles.menuIcon} style={{ color: "#ff4444" }}>●</span>
        <span style={{ color: "#ff4444" }}>UI Marker</span>
      </button>
    );
  }

  // Activated, show toggle
  return (
    <button type="button" className={styles.item} onClick={deactivate}>
      <span className={styles.menuIcon} style={{ color: "#ff4444" }}>●</span>
      <span>UI Marker</span>
      <span style={{ marginLeft: "auto", color: "#4CAF50" }}>✓</span>
    </button>
  );
}
