/**
 * 统一 Gateway Store 示例
 * 展示如何将多个 store 合并为单一 store + slices
 */

import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// ============================================================================
// 导入所有 Slices
// ============================================================================

import { type ChatSlice, createChatSlice } from "./slices/chatSlice";
import { createSearchSlice, type SearchSlice } from "./slices/searchSlice";
import { createSessionSlice, type SessionSlice } from "./slices/sessionSlice";
import { createUISlice, type UISlice } from "./slices/uiSlice";

// ============================================================================
// 组合所有 Slices 的类型
// ============================================================================

type GatewayState = ChatSlice & SearchSlice & SessionSlice & UISlice;

// ============================================================================
// 创建统一 Store
// ============================================================================

export const useGatewayStore = create<GatewayState>()(
	subscribeWithSelector(
		immer(
			devtools(
				persist(
					(...args) => ({
						// 组合所有 slices
						...createChatSlice(...args),
						...createSearchSlice(...args),
						...createSessionSlice(...args),
						...createUISlice(...args),
					}),
					{
						name: "gateway-storage",
						version: 1,

						// 只持久化必要的 state
						partialize: (state) => ({
							session: {
								currentSessionId: state.currentSessionId,
								currentDir: state.currentDir,
								currentModel: state.currentModel,
							},
							settings: {
								theme: state.theme,
								fontSize: state.fontSize,
							},
							// 不持久化临时状态
							// isLoading, error, streamingContent 等
						}),

						// 自定义序列化（可选）
						serialize: (state) => {
							return JSON.stringify({
								state,
								timestamp: Date.now(),
							});
						},

						// 自定义反序列化（可选）
						deserialize: (str) => {
							const data = JSON.parse(str);
							// 可以在这里进行数据迁移
							return data;
						},
					},
				),
				{
					name: "GatewayStore",
					enabled: process.env.NODE_ENV === "development",
				},
			),
		),
	),
);

// ============================================================================
// 导出类型
// ============================================================================

export type { ChatSlice, GatewayState, SearchSlice, SessionSlice, UISlice };

// ============================================================================
// 预设 Selectors (性能优化)
// ============================================================================

// Chat selectors
export const selectMessages = (state: GatewayState) => state.messages;
export const selectIsStreaming = (state: GatewayState) => state.isStreaming;
export const selectCurrentStreamingMessage = (state: GatewayState) =>
	state.currentStreamingMessage;

// Search selectors
export const selectSearchQuery = (state: GatewayState) => state.searchQuery;
export const selectSearchFilters = (state: GatewayState) => state.searchFilters;

// Session selectors
export const selectCurrentSessionId = (state: GatewayState) =>
	state.currentSessionId;
export const selectCurrentDir = (state: GatewayState) => state.currentDir;

// UI selectors
export const selectTheme = (state: GatewayState) => state.theme;
export const selectIsSidebarVisible = (state: GatewayState) =>
	state.isSidebarVisible;

// ============================================================================
// 组合 Selectors
// ============================================================================

import { filterMessages } from "../utils/messageFilters";

/**
 * 获取过滤后的消息（带搜索和筛选）
 */
export const selectFilteredMessages = (state: GatewayState) => {
	return filterMessages(state.messages, {
		query: state.searchQuery,
		filters: state.searchFilters,
	});
};

// ============================================================================
// Store 订阅 (用于非 React 上下文)
// ============================================================================

/**
 * 订阅消息变化
 */
export function subscribeToMessages(callback: (messages: Message[]) => void) {
	return useGatewayStore.subscribe((state) => state.messages, callback);
}

/**
 * 订阅会话变化
 */
export function subscribeToSession(
	callback: (sessionId: string | null) => void,
) {
	return useGatewayStore.subscribe((state) => state.currentSessionId, callback);
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 在组件中使用：
 *
 * ```tsx
 * import { useGatewayStore, selectMessages, selectIsStreaming } from '@/stores/gatewayStore'
 *
 * function ChatComponent() {
 *   // 方式 1: 使用细粒度 selector
 *   const messages = useGatewayStore(selectMessages)
 *   const isStreaming = useGatewayStore(selectIsStreaming)
 *
 *   // 方式 2: 使用内联 selector
 *   const addMessage = useGatewayStore((state) => state.addMessage)
 *
 *   // 方式 3: 使用组合 selector
 *   const filteredMessages = useGatewayStore(selectFilteredMessages)
 *
 *   return (...)
 * }
 * ```
 */
