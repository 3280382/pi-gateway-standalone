/**
 * Message Reconstruction Service
 *
 * 处理RefreshPages面后的消息重建，确保缓冲消息和Streaming message无缝衔接
 * 主要解决以下问题：
 * 1. 缺失 message_start 事件 - 自动创建消息容器
 * 2. 缺失 content block start 事件 - 自动补充开始标记
 * 3. 消息边界不完整 - 自动检测并修复
 * 4. 缓冲消息与实时消息衔接 - 确保连续性
 */

import type { Message } from "@/features/chat/types/chat";
type ContentPart = any;

interface ReconstructionState {
  currentMessage: Message | null;
  pendingBlocks: Map<number, PendingBlock>;
  isInsideMessage: boolean;
  lastEventType: string | null;
  messageStarted: boolean;
}

interface PendingBlock {
  type: "text" | "thinking" | "tool_use";
  index: number;
  started: boolean;
  ended: boolean;
  content: string;
  meta?: any;
}

export class MessageReconstructor {
  private state: ReconstructionState = {
    currentMessage: null,
    pendingBlocks: new Map(),
    isInsideMessage: false,
    lastEventType: null,
    messageStarted: false,
  };

  private eventSequence: string[] = [];
  private maxSequenceLength = 20;

  /**
   * 记录事件并检查序Cols完整性
   */
  recordEvent(eventType: string): void {
    this.eventSequence.push(eventType);
    if (this.eventSequence.length > this.maxSequenceLength) {
      this.eventSequence.shift();
    }
    this.state.lastEventType = eventType;
  }

  /**
   * 检查是否需要自动创建 message_start
   * 当收到 content 相关事件但没有 message_start 时调用
   */
  shouldCreateMessageStart(): boolean {
    // 如果已经在消息内部，不需要创建
    if (this.state.isInsideMessage) return false;

    // 如果上一个事件是 message_end，可能需要新消息
    if (this.state.lastEventType === "message_end") return true;

    // 如果没有任何事件历史，需要创建
    if (!this.state.lastEventType) return true;

    return false;
  }

  /**
   * 检查是否需要自动创建 content block start
   */
  shouldCreateContentBlockStart(index: number, _type: string): boolean {
    const block = this.state.pendingBlocks.get(index);
    if (!block) return true;
    if (block.started && block.ended) return true; // 需要新的 block
    return false;
  }

  /**
   * 开始新消息
   */
  startMessage(messageId?: string): Message {
    const message: Message = {
      id: messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "assistant",
      content: [],
      timestamp: new Date(),
      isStreaming: true,
      isThinkingCollapsed: true,
      isToolsCollapsed: true,
    };

    this.state.currentMessage = message;
    this.state.isInsideMessage = true;
    this.state.messageStarted = true;
    this.state.pendingBlocks.clear();

    return message;
  }

  /**
   * 开始内容块
   */
  startContentBlock(index: number, type: "text" | "thinking" | "tool_use", meta?: any): void {
    this.state.pendingBlocks.set(index, {
      type,
      index,
      started: true,
      ended: false,
      content: "",
      meta,
    });
  }

  /**
   * 追加内容到块
   */
  appendContent(index: number, delta: string): void {
    const block = this.state.pendingBlocks.get(index);
    if (block) {
      block.content += delta;
    }
  }

  /**
   * 结束内容块
   */
  endContentBlock(index: number): ContentPart | null {
    const block = this.state.pendingBlocks.get(index);
    if (!block?.started) return null;

    block.ended = true;

    // 转换为 ContentPart
    switch (block.type) {
      case "thinking":
        return { type: "thinking", thinking: block.content };
      case "text":
        return { type: "text", text: block.content };
      case "tool_use":
        return {
          type: "tool_use",
          id: block.meta?.toolCallId || `tool-${Date.now()}`,
          name: block.meta?.toolName || "unknown",
          input: block.meta?.args ? JSON.parse(block.meta.args) : {},
        };
      default:
        return null;
    }
  }

  /**
   * 结束消息并返回完整消息
   */
  endMessage(): Message | null {
    if (!this.state.currentMessage) return null;

    // 结束所有未结束的块
    const content: ContentPart[] = [];

    // 按索引Sort处理 blocks
    const sortedBlocks = Array.from(this.state.pendingBlocks.entries()).sort(([a], [b]) => a - b);

    for (const [index, block] of sortedBlocks) {
      if (block.started && !block.ended) {
        // 自动结束未完成的块
        const part = this.endContentBlock(index);
        if (part) content.push(part);
      } else if (block.started && block.ended) {
        // 已经结束的块，重新构建 part
        const part = this.buildContentPart(block);
        if (part) content.push(part);
      }
    }

    const message = {
      ...this.state.currentMessage,
      content,
      isStreaming: false,
    };

    // Reset state
    this.reset();

    return message;
  }

  /**
   * 构建 ContentPart
   */
  private buildContentPart(block: PendingBlock): ContentPart | null {
    switch (block.type) {
      case "thinking":
        return { type: "thinking", thinking: block.content };
      case "text":
        return { type: "text", text: block.content };
      case "tool_use":
        return {
          type: "tool_use",
          id: block.meta?.toolCallId || `tool-${Date.now()}`,
          name: block.meta?.toolName || "unknown",
          input: block.meta?.args ? JSON.parse(block.meta.args) : {},
        };
      default:
        return null;
    }
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state = {
      currentMessage: null,
      pendingBlocks: new Map(),
      isInsideMessage: false,
      lastEventType: null,
      messageStarted: false,
    };
    this.eventSequence = [];
  }

  /**
   * 获取当前状态
   */
  getState(): ReconstructionState {
    return { ...this.state };
  }

  /**
   * 检查是否正在消息内部
   */
  isInsideMessage(): boolean {
    return this.state.isInsideMessage;
  }

  /**
   * 自动修复消息序Cols
   * 当检测到异常序Cols时自动修复
   */
  autoFix(): { action: string; data?: any } | null {
    const seq = this.eventSequence;
    const last = seq[seq.length - 1];

    // 情况1: 收到 delta 但没有 start
    if (last?.includes("_delta") && !this.state.pendingBlocks.size) {
      const type = last.replace("_delta", "") as "text" | "thinking" | "tool_use";
      return { action: "create_block_start", data: { type, index: 0 } };
    }

    // 情况2: 收到 message_end 但有未结束的块
    if (last === "message_end") {
      const unendedBlocks = Array.from(this.state.pendingBlocks.values()).filter(
        (b) => b.started && !b.ended
      );
      if (unendedBlocks.length > 0) {
        return { action: "end_pending_blocks", data: unendedBlocks };
      }
    }

    // 情况3: 长时间没有 message_end，可能需要强制结束
    if (this.state.isInsideMessage && last?.includes("_delta")) {
      // 这里可以添加超时逻辑
    }

    return null;
  }
}

// 单例实例
export const messageReconstructor = new MessageReconstructor();

/**
 * 消息类型守卫
 */
export function isContentDeltaEvent(type: string): boolean {
  return type === "text_delta" || type === "thinking_delta" || type === "toolcall_delta";
}

export function isContentStartEvent(type: string): boolean {
  return type === "text_start" || type === "thinking_start" || type === "toolcall_start";
}

export function isContentEndEvent(type: string): boolean {
  return type === "text_end" || type === "thinking_end" || type === "toolcall_end";
}

export function getContentTypeFromDelta(type: string): "text" | "thinking" | "tool_use" | null {
  if (type === "text_delta") return "text";
  if (type === "thinking_delta") return "thinking";
  if (type === "toolcall_delta") return "tool_use";
  return null;
}
