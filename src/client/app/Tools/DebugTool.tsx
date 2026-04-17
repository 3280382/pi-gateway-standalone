/**
 * DebugTool - Debug 开关控制
 * 职责：切换 localStorage 标记，控制首页是否加载 eruda
 */

import { useCallback, useState, useEffect } from "react";
import { IconButton } from "@/components/Icon/Icon";

const DEBUG_KEY = "DEBUG_ERUDA";

export function DebugTool() {
  const [isEnabled, setIsEnabled] = useState(true);

  // 读取初始状态
  useEffect(() => {
    try {
      const value = localStorage.getItem(DEBUG_KEY);
      // null（未设置）或 "true" 都表示启用，只有 "force" 表示禁用
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

      // 提示用户刷新生效
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
