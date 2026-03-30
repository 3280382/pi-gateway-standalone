/**
 * Store导出
 * 兼容新旧架构
 */

// 导出旧Store作为备用
export { useChatStore as useOldChatStore } from "./chatStore";
export { useModalStore } from "./modalStore";
// 导出新Store作为默认
export {
	chatStoreSelectors,
	useNewChatStore as useChatStore,
} from "./new-chat.store";
export { useSessionStore } from "./sessionStore";
export { useSidebarStore } from "./sidebarStore";
