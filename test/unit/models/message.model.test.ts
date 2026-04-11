import { beforeEach, describe, expect, it } from "vitest";
import { MessageModel } from "../../../src/client/models/message.model";

describe("MessageModel", () => {
  describe("构造函数", () => {
    it("应该使用默认值创建消息", () => {
      const message = new MessageModel();

      expect(message.id).toMatch(/^msg-\d+-[a-z0-9]+$/);
      expect(message.role).toBe("user");
      expect(message.content).toEqual([]);
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.isStreaming).toBe(false);
    });

    it("应该使用提供的数据创建消息", () => {
      const timestamp = new Date("2024-01-01T12:00:00Z");
      const message = new MessageModel({
        id: "test-id",
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        timestamp,
        isStreaming: true,
      });

      expect(message.id).toBe("test-id");
      expect(message.role).toBe("assistant");
      expect(message.content).toEqual([{ type: "text", text: "Hello" }]);
      expect(message.timestamp).toBe(timestamp);
      expect(message.isStreaming).toBe(true);
    });
  });

  describe("静态工厂方法", () => {
    it("应该创建用户消息", () => {
      const message = MessageModel.createUserMessage("Hello world");

      expect(message.role).toBe("user");
      expect(message.content).toEqual([{ type: "text", text: "Hello world" }]);
      expect(message.isStreaming).toBe(false);
    });

    it("应该创建助手消息", () => {
      const message = MessageModel.createAssistantMessage();

      expect(message.role).toBe("assistant");
      expect(message.isStreaming).toBe(true);
    });

    it("应该创建系统消息", () => {
      const message = MessageModel.createSystemMessage("System message");

      expect(message.role).toBe("system");
      expect(message.content).toEqual([{ type: "text", text: "System message" }]);
    });

    it("应该从JSON创建消息", () => {
      const json = {
        id: "json-id",
        role: "user" as const,
        content: [{ type: "text" as const, text: "JSON message" }],
        timestamp: "2024-01-01T12:00:00Z",
        isStreaming: false,
      };

      const message = MessageModel.fromJSON(json);

      expect(message.id).toBe("json-id");
      expect(message.role).toBe("user");
      expect(message.content).toEqual([{ type: "text", text: "JSON message" }]);
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.timestamp.toISOString()).toBe("2024-01-01T12:00:00.000Z");
    });
  });

  describe("内容管理", () => {
    let message: MessageModel;

    beforeEach(() => {
      message = new MessageModel();
    });

    it("应该添加内容", () => {
      message.addContent("text", { text: "Hello" });
      message.addContent("thinking", { thinking: "Thinking..." });

      expect(message.content).toHaveLength(2);
      expect(message.content[0]).toEqual({ type: "text", text: "Hello" });
      expect(message.content[1]).toEqual({
        type: "thinking",
        thinking: "Thinking...",
      });
    });

    it("应该获取文本内容", () => {
      message.addContent("text", { text: "Hello world" });
      message.addContent("thinking", { thinking: "Thinking..." });

      expect(message.getTextContent()).toBe("Hello world");
    });

    it("应该获取思考内容", () => {
      message.addContent("thinking", { thinking: "Deep thoughts" });
      message.addContent("text", { text: "Hello" });

      expect(message.getThinkingContent()).toBe("Deep thoughts");
    });

    it("应该获取工具内容", () => {
      message.addContent("tool", { toolName: "bash", args: {} });
      message.addContent("text", { text: "Hello" });
      message.addContent("tool", { toolName: "edit", args: {} });

      const toolContent = message.getToolContent();

      expect(toolContent).toHaveLength(2);
      expect(toolContent[0].toolName).toBe("bash");
      expect(toolContent[1].toolName).toBe("edit");
    });

    it("应该检查是否有工具", () => {
      expect(message.hasTools()).toBe(false);

      message.addContent("tool", { toolName: "bash", args: {} });
      expect(message.hasTools()).toBe(true);
    });

    it("应该检查是否有特定工具", () => {
      message.addContent("tool", { toolName: "bash", args: {} });
      message.addContent("tool", { toolName: "edit", args: {} });

      expect(message.hasTool("bash")).toBe(true);
      expect(message.hasTool("edit")).toBe(true);
      expect(message.hasTool("write")).toBe(false);
    });
  });

  describe("格式化方法", () => {
    it("应该格式化时间", () => {
      const message = new MessageModel({
        timestamp: new Date("2024-01-01T14:30:00Z"),
      });

      // 依赖于本地时区，所以只检查格式
      const time = message.formatTime();
      expect(time).toMatch(/^\d{1,2}:\d{2}(\s*[AP]M)?$/i);
    });

    it("应该格式化日期", () => {
      const message = new MessageModel({
        timestamp: new Date("2024-01-01T14:30:00Z"),
      });

      const date = message.formatDate();
      expect(typeof date).toBe("string");
      expect(date.length).toBeGreaterThan(0);
    });
  });

  describe("统计方法", () => {
    it("应该计算字数", () => {
      const message = new MessageModel();
      message.addContent("text", { text: "Hello world" });
      message.addContent("thinking", { thinking: "This is a test" });
      message.addContent("tool", { output: "Tool output here" });

      expect(message.getWordCount()).toBe(9); // Hello world(2) + This is a test(4) + Tool output here(3)
    });

    it("应该计算字符数", () => {
      const message = new MessageModel();
      message.addContent("text", { text: "Hello" });
      message.addContent("thinking", { thinking: "World" });

      expect(message.getCharacterCount()).toBe(10); // Hello(5) + World(5)
    });

    it("应该检查是否为空消息", () => {
      const emptyMessage = new MessageModel();
      expect(emptyMessage.isEmpty()).toBe(true);

      const nonEmptyMessage = new MessageModel();
      nonEmptyMessage.addContent("text", { text: "Hello" });
      expect(nonEmptyMessage.isEmpty()).toBe(false);

      const whitespaceMessage = new MessageModel();
      whitespaceMessage.addContent("text", { text: "   " });
      expect(whitespaceMessage.isEmpty()).toBe(true);
    });
  });

  describe("状态管理", () => {
    it("应该克隆消息", () => {
      const original = new MessageModel({
        id: "original",
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      });

      const clone = original.clone();

      expect(clone.id).toBe("original");
      expect(clone.role).toBe("user");
      expect(clone.content).toEqual([{ type: "text", text: "Hello" }]);
      expect(clone).not.toBe(original); // 应该是不同的实例
    });

    it("应该更新消息", () => {
      const message = new MessageModel({ id: "test" });

      message.update({
        role: "assistant",
        isStreaming: true,
        timestamp: "2024-01-01T12:00:00Z",
      });

      expect(message.role).toBe("assistant");
      expect(message.isStreaming).toBe(true);
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.timestamp.toISOString()).toBe("2024-01-01T12:00:00.000Z");
    });

    it("应该标记为完成流式生成", () => {
      const message = new MessageModel({ isStreaming: true });

      message.markAsFinished();

      expect(message.isStreaming).toBe(false);
    });

    it("应该切换折叠状态", () => {
      const message = new MessageModel();

      expect(message.isMessageCollapsed).toBe(false);

      message.toggleCollapse();
      expect(message.isMessageCollapsed).toBe(true);

      message.toggleCollapse();
      expect(message.isMessageCollapsed).toBe(false);
    });

    it("应该切换思考折叠状态", () => {
      const message = new MessageModel();

      expect(message.isThinkingCollapsed).toBe(false);

      message.toggleThinkingCollapse();
      expect(message.isThinkingCollapsed).toBe(true);

      message.toggleThinkingCollapse();
      expect(message.isThinkingCollapsed).toBe(false);
    });
  });

  describe("序列化", () => {
    it("应该转换为JSON", () => {
      const timestamp = new Date("2024-01-01T12:00:00Z");
      const message = new MessageModel({
        id: "json-test",
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        timestamp,
        isStreaming: true,
        isMessageCollapsed: true,
        isThinkingCollapsed: false,
      });

      const json = message.toJSON();

      expect(json).toEqual({
        id: "json-test",
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        timestamp,
        isStreaming: true,
        isMessageCollapsed: true,
        isThinkingCollapsed: false,
      });
    });
  });
});
