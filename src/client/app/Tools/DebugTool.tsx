/**
 * DebugTool - 调试系统工具
 * 职责：加载/控制 debug-system.js
 */

import { useCallback, useState } from "react";
import { IconButton } from "@/components/Icon/Icon";

export function DebugTool() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const toggle = useCallback(() => {
    if (!isLoaded) {
      // 首次加载
      if (!document.getElementById("debug-system-script")) {
        const script = document.createElement("script");
        script.id = "debug-system-script";
        script.src = "/debug-system.js";
        script.onload = () => {
          if ((window as any).DebugSystem) {
            (window as any).DebugSystem.show();
          }
        };
        document.head.appendChild(script);
      }
      setIsLoaded(true);
      setIsVisible(true);
    } else {
      // 切换显隐
      const debugSystem = (window as any).DebugSystem;
      if (debugSystem) {
        if (isVisible) {
          debugSystem.hide();
          setIsVisible(false);
        } else {
          debugSystem.show();
          setIsVisible(true);
        }
      }
    }
  }, [isLoaded, isVisible]);

  return (
    <IconButton
      name="bug"
      label="Debug"
      variant="ghost"
      suffix={isVisible ? "✓" : undefined}
      onClick={toggle}
      title={isVisible ? "Hide Debug" : "Show Debug"}
    />
  );
}
