/**
 * useSidebarVisibility - 通知服务器Sidebar可见性状态
 *
 * Responsibilities:
 * - 当Sidebar打开/Close时通知服务器
 * - 服务器根据此状态决定是否广播 session 状态
 */

import { useEffect } from "react";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { websocketService } from "@/services/websocket.service";

export function useSidebarVisibility(): void {
  const isVisible = useSidebarStore((state) => state.isVisible);

  useEffect(() => {
    // 通知服务器Sidebar状态变化
    websocketService.send("sidebar_visibility", {
      visible: isVisible,
    });

    console.log(`[useSidebarVisibility] Sidebar ${isVisible ? "opened" : "closed"}`);
  }, [isVisible]);
}
