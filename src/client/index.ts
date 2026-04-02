/**
 * 主导出文件
 * 导出所有模块供外部使用
 */

// 导出控制器
export { chatController } from "./controllers/chat.controller";
export { fileController } from "./controllers/file.controller";
export { sessionController } from "./controllers/session.controller";
export { FileModel } from "./models/file.model";
// 导出模型
export { MessageModel } from "./models/message.model";
// 导出服务
export { BaseService, ServiceError } from "./services/base.service";
export { chatService } from "./services/chat.service";
export type {
	BrowseResponse,
	FileContentResponse,
	FileItem,
} from "./services/file.service";
export { fileService } from "./services/file.service";
export type {
	BackupInfo,
	SessionStats,
	UserSettings,
	WorkspaceInfo,
} from "./services/session.service";
export { sessionService } from "./services/session.service";
export { websocketService } from "./services/websocket.service";
// 导出共享 UI 组件
export { Button, IconButton, Input, Select } from "./shared/ui";
// 导出Store
export { useChatStore } from "./stores/chatStore";
// 导出类型
export type {
	ChatState,
	ChatWebSocketMessage,
	Message,
	ToolExecution,
} from "./types/chat";
