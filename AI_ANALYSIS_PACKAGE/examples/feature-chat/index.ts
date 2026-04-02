/**
 * Chat Feature 入口
 *
 * 这是 Feature-Based 架构的示例
 * 所有与 Chat 相关的代码都在这个目录中
 */

// ============================================================================
// 组件导出
// ============================================================================

export { ChatContainer } from "./components/ChatContainer";
export { InputArea } from "./components/InputArea";
export { MessageItem } from "./components/MessageItem";
export { MessageList } from "./components/MessageList";

// ============================================================================
// Hooks 导出
// ============================================================================

export { useChatScroll } from "./hooks/useChatScroll";
export { useMessages } from "./hooks/useMessages";
export { useSendMessage } from "./hooks/useSendMessage";

// ============================================================================
// Store 导出
// ============================================================================

export type { ChatActions, ChatSlice, ChatState } from "./stores/chatSlice";
export { createChatSlice } from "./stores/chatSlice";

// ============================================================================
// 工具函数导出
// ============================================================================

export { formatMessage, groupMessagesByDate } from "./utils/messageHelpers";

// ============================================================================
// 类型导出
// ============================================================================

export type { Message, MessageRole, MessageStatus } from "./types";

// ============================================================================
// 常量配置
// ============================================================================

export const CHAT_CONFIG = {
	// 消息限制
	MAX_MESSAGE_LENGTH: 10000,
	MAX_MESSAGES_PER_SESSION: 1000,

	// 流式输出
	STREAMING_DEBOUNCE_MS: 50,
	STREAMING_CHUNK_SIZE: 10,

	// 滚动
	AUTO_SCROLL_THRESHOLD: 100,
	SCROLL_TO_BOTTOM_DURATION: 300,

	// 防抖
	SEARCH_DEBOUNCE_MS: 300,
	SAVE_DEBOUNCE_MS: 1000,
} as const;

// ============================================================================
// Feature 元数据 (用于 AI 理解和文档生成)
// ============================================================================

export const CHAT_FEATURE_META = {
	name: "chat",
	description: "聊天功能，包括消息列表、输入框、流式输出",
	dependencies: ["session", "search"], // 依赖的其他 feature

	components: [
		{ name: "MessageList", description: "消息列表容器" },
		{ name: "MessageItem", description: "单个消息展示" },
		{ name: "InputArea", description: "消息输入框" },
		{ name: "ChatContainer", description: "聊天页面容器" },
	],

	hooks: [
		{ name: "useMessages", description: "获取和管理消息列表" },
		{ name: "useSendMessage", description: "发送消息逻辑" },
		{ name: "useChatScroll", description: "自动滚动控制" },
	],

	stateKeys: [
		"messages",
		"isStreaming",
		"currentStreamingMessage",
		"streamingContent",
	],

	lastUpdated: "2026-03-31",
} as const;

// ============================================================================
// AI 开发指南
// ============================================================================

/**
 * @ai-guide Chat Feature 开发指南
 *
 * ## 修改检查清单
 * - [ ] 修改 stores/chatSlice.ts 后检查 selectors
 * - [ ] 新增组件时添加对应的类型定义
 * - [ ] 更新 utils/messageHelpers.ts 中的工具函数
 * - [ ] 运行测试: npm test -- --feature=chat
 *
 * ## 常见任务
 *
 * ### 添加新消息类型
 * 1. 更新 types.ts 中的 Message 类型
 * 2. 更新 stores/chatSlice.ts 的相关逻辑
 * 3. 更新 MessageItem.tsx 的渲染逻辑
 * 4. 添加测试用例
 *
 * ### 修改消息显示
 * 1. 修改 MessageItem.tsx
 * 2. 更新对应的 CSS Module
 * 3. 检查响应式表现
 * 4. 检查无障碍访问
 *
 * ### 添加新 hook
 * 1. 在 hooks/ 目录创建新文件
 * 2. 在 index.ts 中导出
 * 3. 添加 JSDoc 注释
 * 4. 添加测试用例
 */
