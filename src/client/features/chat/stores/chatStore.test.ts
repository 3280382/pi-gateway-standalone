/**
 * Chat Store - Unit Tests
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Message } from "@/features/chat/types/chat";
import { useChatStore } from "./chatStore";

describe("ChatStore", () => {
	beforeEach(() => {
		// Reset store to initial state
		const store = useChatStore.getState();
		if ("reset" in store && typeof store.reset === "function") {
			store.reset();
		} else {
			// 如果reset方法不存在，手动重置状态
			store.setMessages([]);
			store.setInputText("");
			store.isStreaming = false;
			store.streamingContent = "";
			store.streamingThinking = "";
			store.activeTools = new Map();
		}
	});

	it("should add messages", () => {
		const store = useChatStore.getState();

		const message: Message = {
			id: "1",
			role: "user",
			content: [{ type: "text", text: "Hello" }],
			timestamp: new Date(),
		};

		store.addMessage(message);

		expect(useChatStore.getState().messages).toHaveLength(1);
		expect(useChatStore.getState().messages[0].content[0].text).toBe("Hello");
	});

	it("should update input text", () => {
		const store = useChatStore.getState();

		store.setInputText("Test input");

		expect(useChatStore.getState().inputText).toBe("Test input");
	});

	it("should clear input", () => {
		const store = useChatStore.getState();

		store.setInputText("Test");
		store.clearInput();

		expect(useChatStore.getState().inputText).toBe("");
	});

	it("should start and finish streaming", () => {
		const store = useChatStore.getState();

		store.startStreaming();

		expect(useChatStore.getState().isStreaming).toBe(true);
		expect(useChatStore.getState().currentStreamingMessage).not.toBeNull();

		store.finishStreaming();

		expect(useChatStore.getState().isStreaming).toBe(false);
		expect(useChatStore.getState().currentStreamingMessage).toBeNull();
		expect(useChatStore.getState().messages).toHaveLength(1);
	});

	it("should append streaming content", async () => {
		const store = useChatStore.getState();

		store.startStreaming();
		store.appendStreamingContent("Hello");
		store.appendStreamingContent(" World");

		// RAF updates are async, wait for them
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(useChatStore.getState().streamingContent).toBe("Hello World");
	});

	it("should toggle message collapse", () => {
		const store = useChatStore.getState();

		const message: Message = {
			id: "1",
			role: "assistant",
			content: [{ type: "text", text: "Test" }],
			timestamp: new Date(),
			isMessageCollapsed: false,
		};

		store.addMessage(message);
		store.toggleMessageCollapse("1");

		expect(useChatStore.getState().messages[0].isMessageCollapsed).toBe(true);
	});

	it("should set show thinking", () => {
		const store = useChatStore.getState();

		store.setShowThinking(false);

		expect(useChatStore.getState().showThinking).toBe(false);
	});

	it("should clear messages", () => {
		const store = useChatStore.getState();

		store.addMessage({
			id: "1",
			role: "user",
			content: [{ type: "text", text: "Hello" }],
			timestamp: new Date(),
		});
		store.clearMessages();

		expect(useChatStore.getState().messages).toHaveLength(0);
	});

	it("should handle batch content updates", () => {
		const store = useChatStore.getState();

		store.startStreaming();
		store.batchUpdateContent({ content: "Hello" });
		store.batchUpdateContent({ thinking: "Thinking..." });

		expect(useChatStore.getState().streamingContent).toBe("Hello");
		expect(useChatStore.getState().streamingThinking).toBe("Thinking...");
	});

	it("should handle tool execution", () => {
		const store = useChatStore.getState();

		store.startStreaming();
		store.setActiveTool({
			id: "tool-1",
			name: "read_file",
			args: { path: "/test.txt" },
			status: "running",
			startTime: new Date(),
		});

		expect(useChatStore.getState().activeTools.has("tool-1")).toBe(true);

		store.updateToolOutput("tool-1", "File content here");

		const tool = useChatStore.getState().activeTools.get("tool-1");
		expect(tool?.output).toBe("File content here");
		expect(tool?.status).toBe("success");
	});

	it("should handle search functionality", () => {
		const store = useChatStore.getState();

		store.setSearchQuery("test query");
		expect(useChatStore.getState().searchQuery).toBe("test query");

		store.setSearchFilters({ user: false });
		expect(useChatStore.getState().searchFilters.user).toBe(false);
		expect(useChatStore.getState().searchFilters.assistant).toBe(true);

		store.setSearching(true);
		expect(useChatStore.getState().isSearching).toBe(true);
	});

	it("should handle session management", () => {
		const store = useChatStore.getState();

		store.setSessionId("session-123");
		expect(useChatStore.getState().sessionId).toBe("session-123");

		store.setCurrentModel("deepseek-chat");
		expect(useChatStore.getState().currentModel).toBe("deepseek-chat");
	});

	it("should reset to initial state", () => {
		const store = useChatStore.getState();

		store.addMessage({
			id: "1",
			role: "user",
			content: [{ type: "text", text: "Hello" }],
			timestamp: new Date(),
		});
		store.setInputText("Test");
		store.startStreaming();
		store.setSearchQuery("query");

		store.reset();

		expect(useChatStore.getState().messages).toHaveLength(0);
		expect(useChatStore.getState().inputText).toBe("");
		expect(useChatStore.getState().isStreaming).toBe(false);
		expect(useChatStore.getState().searchQuery).toBe("");
		expect(useChatStore.getState().currentStreamingMessage).toBeNull();
	});
});
