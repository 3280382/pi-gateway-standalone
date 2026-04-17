/**
 * UIMarkerTool - UI Marker 工具
 * 职责：控制 UI Marker 的激活/停用状态
 */

import { useCallback, useState, useEffect } from "react";
import { IconButton } from "@/components/Icon/Icon";

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

  // 读取初始状态并初始化 UI Marker
  useEffect(() => {
    const initUIMarker = () => {
      try {
        const value = localStorage.getItem(UI_MARKER_KEY);
        // 默认禁用（如果未设置）
        const enabled = value === "true";
        setIsEnabled(enabled);

        // 根据设置初始化 UI Marker
        if (window.uiMarker) {
          if (enabled) {
            window.uiMarker.activate();
            console.log("[UIMarkerTool] UI Marker activated on load");
          } else {
            window.uiMarker.deactivate();
          }
        } else {
          console.warn("[UIMarkerTool] window.uiMarker not found during init");
        }
      } catch {
        setIsEnabled(false);
      }
    };

    // 延迟初始化以确保 ui-marker.js 已加载
    if (window.uiMarker) {
      initUIMarker();
    } else {
      // 等待 ui-marker.js 加载
      const checkInterval = setInterval(() => {
        if (window.uiMarker) {
          clearInterval(checkInterval);
          initUIMarker();
        }
      }, 100);

      // 最多等待 5 秒
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.uiMarker) {
          console.warn("[UIMarkerTool] window.uiMarker not found after 5 seconds");
        }
      }, 5000);
    }
  }, []);

  const toggle = useCallback(() => {
    const newEnabled = !isEnabled;

    try {
      // 保存到 localStorage
      if (newEnabled) {
        localStorage.setItem(UI_MARKER_KEY, "true");
      } else {
        localStorage.setItem(UI_MARKER_KEY, "false");
      }

      // 控制 UI Marker
      if (window.uiMarker) {
        if (newEnabled) {
          window.uiMarker.activate();
          console.log("[UIMarkerTool] UI Marker activated");
        } else {
          window.uiMarker.deactivate();
          console.log("[UIMarkerTool] UI Marker deactivated");
        }
        // 更新状态
        setIsEnabled(newEnabled);
      } else {
        console.warn("[UIMarkerTool] window.uiMarker not found");
        // 即使 uiMarker 不存在，也更新状态
        setIsEnabled(newEnabled);
      }
    } catch (error) {
      console.error("[UIMarkerTool] Error toggling UI Marker:", error);
    }
  }, [isEnabled]);

  // 监听 UI Marker 状态变化
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (window.uiMarker) {
      // 定期检查状态，因为 UI Marker 可能被快捷键触发
      interval = setInterval(() => {
        if (window.uiMarker && window.uiMarker.isActive !== undefined) {
          const currentlyActive = window.uiMarker.isActive;
          if (currentlyActive !== isEnabled) {
            setIsEnabled(currentlyActive);
            // 同步 localStorage
            try {
              localStorage.setItem(UI_MARKER_KEY, currentlyActive ? "true" : "false");
            } catch {
              // ignore
            }
          }
        }
      }, 1000); // 每秒检查一次
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isEnabled]);

  return (
    <IconButton
      name="target"
      label="UI Marker"
      variant="ghost"
      suffix={isEnabled ? "✓" : undefined}
      onClick={toggle}
      title={isEnabled ? "UI Marker: On (Ctrl+Shift+M)" : "UI Marker: Off"}
    />
  );
}
