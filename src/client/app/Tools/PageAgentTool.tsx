/**
 * PageAgentTool - Page Agent tool
 * Responsibilities: Load/control page-agent
 */

import { useCallback, useState } from "react";
import { IconButton } from "@/components/Icon/Icon";

export function PageAgentTool() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const toggle = useCallback(() => {
    if (!isLoaded) {
      // First load
      if (!document.getElementById("page-agent-script")) {
        const script = document.createElement("script");
        script.id = "page-agent-script";
        script.src = "/vendor/page-agent/page-agent.demo.js";
        script.onload = () => console.log("[Page Agent] Loaded");
        document.head.appendChild(script);
      }
      setIsLoaded(true);
      setIsVisible(true);
    } else {
      // Toggle visibility
      const mask = document.querySelector(".page-agent-mask") as HTMLElement;
      if (mask) {
        if (isVisible) {
          mask.style.visibility = "hidden";
          mask.style.pointerEvents = "none";
          setIsVisible(false);
        } else {
          mask.style.visibility = "visible";
          mask.style.pointerEvents = "auto";
          setIsVisible(true);
        }
      }
    }
  }, [isLoaded, isVisible]);

  return (
    <IconButton
      name="robot"
      label="Page Agent"
      variant="ghost"
      suffix={isVisible ? "✓" : undefined}
      onClick={toggle}
      title={isVisible ? "Hide Page Agent" : "Show Page Agent"}
    />
  );
}
