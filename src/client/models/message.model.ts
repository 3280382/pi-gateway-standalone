/**
 * Message Model - 消息数据模型
 * 前后端共享的消息业务逻辑和数据操作
 */

import type { ContentType, Message, MessageContent } from "@/types/chat.types";
import { BaseModel } from "./base.model";

export class MessageModel extends BaseModel<Message> {
	/**
	 * 构造函数
	 */
	constructor(data: Partial<Message> = {}) {
		const normalizedData = MessageModel.normalizeMessageData(data);
		super({
			id: normalizedData.id || MessageModel.generateId(),
			role: normalizedData.role || "user",
			content: normalizedData.content || [],
			timestamp: normalizedData.timestamp || new Date(),
			isStreaming: normalizedData.isStreaming || false,
			isThinkingCollapsed: normalizedData.isThinkingCollapsed || false,
			isMessageCollapsed: normalizedData.isMessageCollapsed || false,
		});
	}

	/**
	 * 标准化消息数据
	 */
	private static normalizeMessageData(
		data: Partial<Message>,
	): Partial<Message> {
		const normalized = { ...data };

		// 确保timestamp是Date实例
		if (normalized.timestamp && !(normalized.timestamp instanceof Date)) {
			normalized.timestamp = new Date(normalized.timestamp);
		}

		return normalized;
	}

	/**
	 * 生成消息ID
	 */
	private static generateId(): string {
		return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * 创建用户消息
	 */
	static createUserMessage(text: string): MessageModel {
		return new MessageModel({
			role: "user",
			content: [{ type: "text", text }],
		});
	}

	/**
	 * 创建助手消息
	 */
	static createAssistantMessage(): MessageModel {
		return new MessageModel({
			role: "assistant",
			isStreaming: true,
		});
	}

	/**
	 * 创建系统消息
	 */
	static createSystemMessage(text: string): MessageModel {
		return new MessageModel({
			role: "system",
			content: [{ type: "text", text }],
		});
	}

	/**
	 * 从JSON创建
	 */
	static fromJSON(data: Message): MessageModel {
		return new MessageModel({
			...data,
			timestamp: new Date(data.timestamp),
		});
	}

	/**
	 * 添加内容
	 */
	addContent(type: ContentType, data: Partial<MessageContent>): void {
		this.update({
			content: [...this.data.content, { type, ...data } as MessageContent],
		});
	}

	/**
	 * 获取文本内容
	 */
	getTextContent(): string {
		const textContent = this.data.content.find((c) => c.type === "text");
		return textContent?.text || "";
	}

	/**
	 * 获取思考内容
	 */
	getThinkingContent(): string {
		const thinkingContent = this.data.content.find(
			(c) => c.type === "thinking",
		);
		return thinkingContent?.thinking || "";
	}

	/**
	 * 获取工具内容
	 */
	getToolContent(): MessageContent[] {
		return this.data.content.filter((c) => c.type === "tool");
	}

	/**
	 * 是否有工具调用
	 */
	hasTools(): boolean {
		return this.data.content.some((c) => c.type === "tool");
	}

	/**
	 * 是否包含特定工具
	 */
	hasTool(toolName: string): boolean {
		return this.data.content.some(
			(c) => c.type === "tool" && c.toolName === toolName,
		);
	}

	/**
	 * 格式化时间
	 */
	formatTime(): string {
		return this.data.timestamp.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	/**
	 * 格式化日期
	 */
	formatDate(): string {
		return this.data.timestamp.toLocaleDateString();
	}

	/**
	 * 计算字数
	 */
	getWordCount(): number {
		let count = 0;
		this.data.content.forEach((content) => {
			const text = content.text || content.thinking || content.output || "";
			count += text.split(/\s+/).length;
		});
		return count;
	}

	/**
	 * 计算字符数
	 */
	getCharacterCount(): number {
		let count = 0;
		this.data.content.forEach((content) => {
			const text = content.text || content.thinking || content.output || "";
			count += text.length;
		});
		return count;
	}

	/**
	 * 是否为空消息
	 */
	isEmpty(): boolean {
		return (
			this.data.content.length === 0 ||
			this.data.content.every((c) => {
				const text = c.text || c.thinking || c.output || "";
				return text.trim().length === 0;
			})
		);
	}

	/**
	 * 标记为完成流式生成
	 */
	markAsFinished(): void {
		this.update({ isStreaming: false });
	}

	/**
	 * 切换折叠状态
	 */
	toggleCollapse(): void {
		this.update({
			isMessageCollapsed: !this.data.isMessageCollapsed,
		});
	}

	/**
	 * 切换思考折叠状态
	 */
	toggleThinkingCollapse(): void {
		this.update({
			isThinkingCollapsed: !this.data.isThinkingCollapsed,
		});
	}

	/**
	 * 更新消息数据
	 */
	update(updates: Partial<Message>): void {
		const normalizedUpdates = MessageModel.normalizeMessageData(updates);
		super.update(normalizedUpdates);
	}

	/**
	 * 便捷访问器
	 */
	get id(): string {
		return this.data.id;
	}
	get role(): "user" | "assistant" | "system" {
		return this.data.role;
	}
	get content(): MessageContent[] {
		return this.data.content;
	}
	get timestamp(): Date {
		return this.data.timestamp;
	}
	get isStreaming(): boolean | undefined {
		return this.data.isStreaming;
	}
	get isThinkingCollapsed(): boolean | undefined {
		return this.data.isThinkingCollapsed;
	}
	get isMessageCollapsed(): boolean | undefined {
		return this.data.isMessageCollapsed;
	}
}
