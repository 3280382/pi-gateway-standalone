/**
 * DebugTool - Debug switch control
 * Responsibilities:切换 localStorage 标记，控制首Pages是否加载 eruda
 */

import { useCallback, useState, useEffect } from "react";
import { IconButton } from "@/components/Icon/Icon";

const DEBUG_KEY = "DEBUG_ERUDA";

export function DebugTool() {
  const [isEnabled, setIsEnabled] = useState(true);

  // Read initial state
  useEffect(() => {
    try {
      const value = localStorage.getItem(DEBUG_KEY);
      // null (unset) or "true" means enabled，only "force" means disabled
      setIsEnabled(value !== "force");
    } catch {
      setIsEnabled(true);
    }
  }, []);

  const toggle = useCallback(() => {
    try {
      const newValue = isEnabled ? "force" : null;
      if (newValue === null) {
        localStorage.removeItem(DEBUG_KEY);
      } else {
        localStorage.setItem(DEBUG_KEY, newValue);
      }
      setIsEnabled(!isEnabled);

      // Prompt user to refresh
      console.log(`[DebugTool] Eruda ${!isEnabled ? "enabled" : "disabled"} - refresh to apply`);
    } catch {
      // ignore
    }
  }, [isEnabled]);

  return (
    <IconButton
      name="bug"
      label={isEnabled ? "Debug: On" : "Debug: Off"}
      variant="ghost"
      suffix={isEnabled ? "✓" : undefined}
      onClick={toggle}
      title={
        isEnabled
          ? "Click to disable eruda (refresh required)"
          : "Click to enable eruda (refresh required)"
      }
    />
  );
}
