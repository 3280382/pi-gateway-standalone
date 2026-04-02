/**
 * Chat Feature - 聊天功能模块
 */

// Components
export { ChatPanel } from "./components/ChatPanel";
export { InputArea } from "./components/InputArea";
export { MessageList } from "./components/MessageList";
export { MessageItem } from "./components/MessageItem";

// Layout & Page
export { ChatLayout } from "./layout";
export { ChatPage } from "./page";

// Re-export from global stores/hooks/services for convenience
export { useChatStore } from "@/stores/chatStore";
