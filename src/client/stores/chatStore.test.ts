/**
 * Chat Store - Unit Tests
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Message } from "@/types/chat";
import { useChatStore } from "./chatStore";

describe("ChatStore", () => {
	beforeEach(() => {
		// Reset store to initial state
		useChatStore.getState().reset();
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

	it("should start and stop streaming", () => {
		const store = useChatStore.getState();

		store.startStreaming();

		expect(useChatStore.getState().isStreaming).toBe(true);
		expect(useChatStore.getState().currentStreamingMessage).not.toBeNull();

		store.finalizeStreamingMessage();

		expect(useChatStore.getState().isStreaming).toBe(false);
		expect(useChatStore.getState().currentStreamingMessage).toBeNull();
		expect(useChatStore.getState().messages).toHaveLength(1);
	});

	it("should append streaming content", () => {
		const store = useChatStore.getState();

		store.startStreaming();
		store.appendStreamingContent("Hello");
		store.appendStreamingContent(" World");

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
});
