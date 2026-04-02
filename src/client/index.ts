/**
 * 主导出文件
 * 导出所有模块供外部使用
 */

// Controllers
export { chatController } from "@/features/chat/controllers";
export { fileController, sessionController } from "@/shared/controllers";

// Services
export { ServiceError } from "@/shared/services";
export { chatService } from "@/features/chat/services/chat.service";
export { fileService } from "@/shared/services/file.service";
export { sessionService } from "@/shared/services/session.service";
export { websocketService } from "@/shared/services/websocket.service";

// Stores
export { useChatStore } from "@/features/chat/stores";
export { useSessionStore } from "@/shared/stores";

// Hooks
export {
  useAppInitialization,
  useChatMessages,
  useTerminalCommands,
} from "@/shared/hooks";
export { useChat } from "@/features/chat/hooks";

// Types
export type {
  ChatState,
  ChatWebSocketMessage,
  Message,
  ToolExecution,
} from "@/features/chat/types";

// Shared UI
export { Button, IconButton, Input, Select } from "@/shared/ui";
