import { beforeEach, describe, expect, it } from "vitest";
import { MessageModel } from "@/models/message.model";
import { chatStoreSelectors, useNewChatStore } from "./new-chat.store";

describe("New Chat Store", () => {
	beforeEach(() => {
		useNewChatStore.getState().reset();
	});

	describe("基本状态管理", () => {
		it("应该初始化状态", () => {
			const state = useNewChatStore.getState();

			expect(state.messages).toEqual([]);
			expect(state.isStreaming).toBe(false);
			expect(state.inputText).toBe("");
			expect(state.sessionId).toBeNull();
		});

		it("应该设置消息", () => {
			const { setMessages } = useNewChatStore.getState();

			const messages = [
				new MessageModel({ role: "user", content: [{ type: "text", text: "Hello" }] }).toJSON(),
				new MessageModel({ role: "assistant", content: [{ type: "text", text: "Hi there!" }] }).toJSON(),
			];

			setMessages(messages);

			const state = useNewChatStore.getState();
			expect(state.messages).toHaveLength(2);
			expect(state.messages[0].role).toBe("user");
			expect(state.messages[1].role).toBe("assistant");
		});

		it("应该添加消息", () => {
			const { addMessage } = useNewChatStore.getState();

			const message = new MessageModel({
				role: "user",
				content: [{ type: "text", text: "Test message" }],
			}).toJSON();

			addMessage(message);

			const state = useNewChatStore.getState();
			expect(state.messages).toHaveLength(1);
			expect(state.messages[0].content[0].text).toBe("Test message");
		});

		it("应该更新消息", () => {
			const { addMessage, updateMessage } = useNewChatStore.getState();

			const message = new MessageModel({
				id: "test-id",
				role: "user",
				content: [{ type: "text", text: "Original" }],
			}).toJSON();

			addMessage(message);
			updateMessage("test-id", { isMessageCollapsed: true });

			const state = useNewChatStore.getState();
			expect(state.messages[0].isMessageCollapsed).toBe(true);
		});

		it("应该删除消息", () => {
			const { addMessage, deleteMessage } = useNewChatStore.getState();

			const message1 = new MessageModel({ id: "msg-1" }).toJSON();
			const message2 = new MessageModel({ id: "msg-2" }).toJSON();

			addMessage(message1);
			addMessage(message2);
			deleteMessage("msg-1");

			const state = useNewChatStore.getState();
			expect(state.messages).toHaveLength(1);
			expect(state.messages[0].id).toBe("msg-2");
		});
	});

	describe("输入状态管理", () => {
		it("应该设置输入文本", () => {
			const { setInputText } = useNewChatStore.getState();

			setInputText("Hello world");

			const state = useNewChatStore.getState();
			expect(state.inputText).toBe("Hello world");
		});

		it("应该清除输入文本", () => {
			const { setInputText, clearInput } = useNewChatStore.getState();

			setInputText("Hello world");
			clearInput();

			const state = useNewChatStore.getState();
			expect(state.inputText).toBe("");
		});
	});

	describe("流式状态管理", () => {
		it("应该设置流式状态", () => {
			const { setStreaming } = useNewChatStore.getState();

			setStreaming(true);

			const state = useNewChatStore.getState();
			expect(state.isStreaming).toBe(true);
		});

		it("应该设置流式内容", () => {
			const { setStreamingContent, appendStreamingContent } = useNewChatStore.getState();

			setStreamingContent("Hello");
			appendStreamingContent(" World");

			const state = useNewChatStore.getState();
			expect(state.streamingContent).toBe("Hello World");
		});

		it("应该设置流式思考内容", () => {
			const { setStreamingThinking, appendStreamingThinking } = useNewChatStore.getState();

			setStreamingThinking("Thinking...");
			appendStreamingThinking(" more thoughts");

			const state = useNewChatStore.getState();
			expect(state.streamingThinking).toBe("Thinking... more thoughts");
		});

		it("应该重置流式状态", () => {
			const { setStreaming, setStreamingContent, resetStreaming } = useNewChatStore.getState();

			setStreaming(true);
			setStreamingContent("Some content");
			resetStreaming();

			const state = useNewChatStore.getState();
			expect(state.isStreaming).toBe(false);
			expect(state.streamingContent).toBe("");
			expect(state.streamingThinking).toBe("");
		});
	});

	describe("工具状态管理", () => {
		it("应该设置活动工具", () => {
			const { setActiveTool } = useNewChatStore.getState();

			const tool = {
				id: "tool-1",
				name: "test_tool",
				args: { param: "value" },
				status: "executing" as const,
				startTime: new Date(),
			};

			setActiveTool("tool-1", tool);

			const state = useNewChatStore.getState();
			expect(state.activeTools.get("tool-1")).toEqual(tool);
		});

		it("应该更新活动工具", () => {
			const { setActiveTool, updateActiveTool } = useNewChatStore.getState();

			const tool = {
				id: "tool-1",
				name: "test_tool",
				args: {},
				status: "executing" as const,
				startTime: new Date(),
			};

			setActiveTool("tool-1", tool);
			updateActiveTool("tool-1", { status: "success", output: "Done!" });

			const state = useNewChatStore.getState();
			const updatedTool = state.activeTools.get("tool-1");
			expect(updatedTool?.status).toBe("success");
			expect(updatedTool?.output).toBe("Done!");
		});

		it("应该移除活动工具", () => {
			const { setActiveTool, removeActiveTool } = useNewChatStore.getState();

			const tool = {
				id: "tool-1",
				name: "test_tool",
				args: {},
				status: "executing" as const,
				startTime: new Date(),
			};

			setActiveTool("tool-1", tool);
			removeActiveTool("tool-1");

			const state = useNewChatStore.getState();
			expect(state.activeTools.has("tool-1")).toBe(false);
		});

		it("应该清除所有活动工具", () => {
			const { setActiveTool, clearActiveTools } = useNewChatStore.getState();

			setActiveTool("tool-1", {
				id: "tool-1",
				name: "test_tool",
				args: {},
				status: "executing" as const,
				startTime: new Date(),
			});

			setActiveTool("tool-2", {
				id: "tool-2",
				name: "another_tool",
				args: {},
				status: "executing" as const,
				startTime: new Date(),
			});

			clearActiveTools();

			const state = useNewChatStore.getState();
			expect(state.activeTools.size).toBe(0);
		});
	});

	describe("选择器", () => {
		beforeEach(() => {
			const { setMessages } = useNewChatStore.getState();

			const messages = [
				new MessageModel({
					id: "msg-1",
					role: "user",
					content: [{ type: "text", text: "Hello" }],
				}).toJSON(),
				new MessageModel({
					id: "msg-2",
					role: "assistant",
					content: [
						{
							type: "text",
							text: "Hi there!",
						},
					],
				}).toJSON(),
				new MessageModel({
					id: "msg-3",
					role: "user",
					content: [{ type: "text", text: "Another message" }],
				}).toJSON(),
			];

			setMessages(messages);
		});

		it("应该通过ID获取消息", () => {
			const selector = chatStoreSelectors.getMessageById("msg-2");
			const message = selector(useNewChatStore.getState());

			expect(message?.id).toBe("msg-2");
			expect(message?.role).toBe("assistant");
		});

		it("应该获取最后一条消息", () => {
			const lastMessage = chatStoreSelectors.getLastMessage(useNewChatStore.getState());

			expect(lastMessage?.id).toBe("msg-3");
			expect(lastMessage?.role).toBe("user");
		});

		it("应该获取用户消息", () => {
			const userMessages = chatStoreSelectors.getUserMessages(useNewChatStore.getState());

			expect(userMessages).toHaveLength(2);
			expect(userMessages[0].id).toBe("msg-1");
			expect(userMessages[1].id).toBe("msg-3");
		});

		it("应该获取助手消息", () => {
			const assistantMessages = chatStoreSelectors.getAssistantMessages(useNewChatStore.getState());

			expect(assistantMessages).toHaveLength(1);
			expect(assistantMessages[0].id).toBe("msg-2");
		});

		it("应该获取消息计数", () => {
			const count = chatStoreSelectors.getMessageCount(useNewChatStore.getState());

			expect(count).toBe(3);
		});

		it("应该获取字数统计", () => {
			const wordCount = chatStoreSelectors.getWordCount(useNewChatStore.getState());

			// "Hello" + "Hi there!" + "Another message" = 5 words
			expect(wordCount).toBe(5);
		});
	});

	describe("搜索功能", () => {
		it("应该设置搜索查询", () => {
			const { setSearchQuery } = useNewChatStore.getState();

			setSearchQuery("test query");

			const state = useNewChatStore.getState();
			expect(state.searchQuery).toBe("test query");
		});

		it("应该设置搜索过滤器", () => {
			const { setSearchFilters } = useNewChatStore.getState();

			setSearchFilters({ user: false, thinking: false });

			const state = useNewChatStore.getState();
			expect(state.searchFilters.user).toBe(false);
			expect(state.searchFilters.thinking).toBe(false);
			expect(state.searchFilters.assistant).toBe(true); // 保持默认值
			expect(state.searchFilters.tools).toBe(true); // 保持默认值
		});

		it("应该设置搜索结果", () => {
			const { setSearchResults } = useNewChatStore.getState();

			setSearchResults(["msg-1", "msg-3"]);

			const state = useNewChatStore.getState();
			expect(state.searchResults).toEqual(["msg-1", "msg-3"]);
		});
	});

	describe("重置状态", () => {
		it("应该重置所有状态", () => {
			const { setInputText, setStreaming, addMessage, reset } = useNewChatStore.getState();

			setInputText("Hello");
			setStreaming(true);
			addMessage(new MessageModel({ role: "user" }).toJSON());
			reset();

			const state = useNewChatStore.getState();
			expect(state.inputText).toBe("");
			expect(state.isStreaming).toBe(false);
			expect(state.messages).toEqual([]);
		});
	});
});
