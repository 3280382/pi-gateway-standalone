/**
 * Chat Feature - 聊天功能模块
 */

// Re-export from global stores/hooks/services for convenience
export { useChatStore } from "@/features/chat/stores/chatStore";
// Components
export { ChatPanel } from "./components/ChatPanel";
export { InputArea } from "./components/InputArea";
export { MessageItem } from "./components/MessageItem";
export { MessageList } from "./components/MessageList";
// Layout & Page
export { ChatLayout } from "./layout";
export { ChatPage } from "./page";
