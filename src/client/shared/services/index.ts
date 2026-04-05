/**
 * Services 导出 - 统一入口
 *
 * 全局共享 services 直接导出
 * Feature services 通过 re-export 保持兼容性
 */

// Feature services (re-export for backward compatibility)
export {
	createChatController,
	setupWebSocketListeners,
	useChatController,
} from "@/features/chat/services/api/chatApi";
export {
	createSidebarController,
	useSidebarController,
} from "@/features/chat/services/api/sidebarApi";
export { systemPromptApi } from "@/features/chat/services/api/systemPromptApi";
export {
	fileApi,
	useFileController,
} from "@/features/files/services/api/fileApi";
export { fetchApi } from "./api/client";
// Base & Core
export { ServiceError } from "./base.service";
export { sessionService } from "./session.service";
export { websocketService } from "./websocket.service";
