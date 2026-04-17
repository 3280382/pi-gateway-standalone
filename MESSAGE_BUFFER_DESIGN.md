# 后台消息缓存机制设计文档

## 概述

为了实现"后台多个 session 运行，前台只关联一个查看"的需求，我们实现了智能的消息缓存和转发机制。

## 核心逻辑

```
┌─────────────────────────────────────────────────────────────────┐
│                     消息处理流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AgentSession 事件                                               │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────┐     WebSocket OPEN?      ┌──────────────┐     │
│  │  send()     │ ───────────────────────► │ 发送到客户端  │     │
│  │   方法      │    是                    │ (实时转发)   │     │
│  └─────────────┘                          └──────────────┘     │
│        │                                                        │
│        │ 否 (WebSocket 未连接)                                   │
│        ▼                                                        │
│  ┌─────────────┐                                               │
│  │ message_    │ ──► 清空旧缓存                                │
│  │ start?      │     开始新消息缓存                            │
│  └─────────────┘                                               │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────┐                                               │
│  │ 缓存到       │ ──► messageEventBuffer[]                      │
│  │ messageEvent │                                               │
│  │ Buffer       │                                               │
│  └─────────────┘                                               │
│        │                                                        │
│        ▼                                                        │
│  message_end ──► 保留完整消息缓存                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     重新关联流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  reconnect(ws) 被调用                                           │
│        │                                                        │
│        ▼                                                        │
│  1. 更新 WebSocket 引用                                         │
│        │                                                        │
│        ▼                                                        │
│  2. 重新订阅 AgentSession 事件                                   │
│        │                                                        │
│        ▼                                                        │
│  3. flushMessageBuffer()                                        │
│        │ ──► 发送缓存的所有事件到新的 WebSocket                  │
│        │ ──► 清空缓存                                           │
│        │                                                        │
│        ▼                                                        │
│  4. 发送 session_reconnected 通知                               │
│        │ ──► 告知客户端已重新连接                                │
│        │ ──► 告知重放了多少条消息                                │
│        │                                                        │
│        ▼                                                        │
│  5. 继续实时转发新事件                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 实现细节

### 1. 新增属性

```typescript
/** 
 * Message buffer for disconnected mode
 * When WebSocket is not connected, events are cached here
 * Cleared on each message_start, only keeps the most recent complete message
 */
private messageEventBuffer: ServerMessage[] = [];

/** 
 * Whether currently buffering messages (WebSocket not connected)
 * Set to true when disconnected, false when connected
 */
private isBuffering: boolean = false;

/** Track if we're currently inside a message (between message_start and message_end) */
private insideMessage: boolean = false;
```

### 2. 修改 send() 方法

核心逻辑：
- 检测到 `message_start` 时，清空上一次的缓存
- WebSocket 连接时，直接发送
- WebSocket 未连接时，缓存到队列

```typescript
send(message: ServerMessage) {
  // Track message boundaries for buffer management
  if (message.type === "message_start") {
    // Clear previous buffer on new message start
    if (this.messageEventBuffer.length > 0) {
      console.log(`[PiAgentSession.send] Clearing ${this.messageEventBuffer.length} buffered events from previous message`);
      this.messageEventBuffer = [];
    }
    this.insideMessage = true;
  } else if (message.type === "message_end") {
    this.insideMessage = false;
  }

  // Check if WebSocket exists and is open
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    // Cache the message for later playback
    this.messageEventBuffer.push(message);
    this.isBuffering = true;
    return;
  }

  // WebSocket is connected, send immediately
  this.ws.send(JSON.stringify(message));
  this.wsConnected = true;
  this.isBuffering = false;
}
```

### 3. 新增 flushMessageBuffer() 方法

在重新关联时调用，发送所有缓存的消息：

```typescript
flushMessageBuffer(): number {
  const bufferSize = this.messageEventBuffer.length;
  if (bufferSize === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
    return 0;
  }

  console.log(`[PiAgentSession.flushMessageBuffer] Flushing ${bufferSize} buffered messages`);
  
  // Send all buffered messages
  for (const message of this.messageEventBuffer) {
    this.ws.send(JSON.stringify(message));
  }

  // Clear the buffer after successful flush
  this.messageEventBuffer = [];
  this.isBuffering = false;
  
  return bufferSize;
}
```

### 4. 修改 reconnect() 方法

在重新订阅事件后，先刷新缓存，再发送连接通知：

```typescript
reconnect(ws: WebSocket) {
  // Update WebSocket and re-subscribe events
  this.ws = ws;
  this.setupEventHandlers();

  // Flush buffered messages BEFORE sending reconnected notification
  const flushedCount = this.flushMessageBuffer();
  if (flushedCount > 0) {
    console.log(`[PiAgentSession.reconnect] Flushed ${flushedCount} buffered messages`);
  }

  // Notify client that session is reconnected
  this.send({
    type: "session_reconnected",
    message: "Session reconnected, resuming...",
    workingDir: this.workingDir,
    flushedMessages: flushedCount, // Inform client how many messages were replayed
  });
}
```

## 关键行为

### 1. 缓存清理策略

```
message_start 事件
        │
        ▼
┌───────────────────┐
│ 清空旧缓存        │ ◄── 确保只保留最近一条完整消息
│ 开始新消息缓存    │
└───────────────────┘
```

### 2. 消息完整性保证

- 只有当前正在关联的 session 才会实时转发消息
- 其他运行的 session 会缓存消息
- 每次新消息开始时，清空上一次的缓存
- 确保缓存中只有最近一条完整消息的所有事件

### 3. 重新关联时的消息回放

```
客户端切换 Session
        │
        ▼
┌───────────────────────┐
│ 1. WebSocket 断开     │
│ 2. 新消息事件被缓存   │
└───────────────────────┘
        │
        ▼
客户端重新关联该 Session
        │
        ▼
┌───────────────────────┐
│ 1. 建立新 WebSocket   │
│ 2. flushMessageBuffer │ ◄── 发送所有缓存事件
│ 3. 实时转发新事件     │
└───────────────────────┘
```

## 日志输出示例

```
# 断开连接时的缓存
[PiAgentSession.send] WebSocket not OPEN (state=3), caching message: turn_start
[PiAgentSession.send] WebSocket not OPEN (state=3), caching message: message_start
[PiAgentSession.send] WebSocket not OPEN (state=3), caching message: thinking_start
[PiAgentSession.send] WebSocket not OPEN (state=3), caching message: text_start
...

# 新消息开始，清空旧缓存
[PiAgentSession.send] Clearing 15 buffered events from previous message

# 重新关联时刷新缓存
[PiAgentSession.reconnect] Flushed 20 buffered messages to client
```

## 优势

1. **内存效率**：只缓存最近一条完整消息，避免无限增长
2. **实时性**：当前关联的 session 无延迟转发
3. **完整性**：重新关联时能恢复完整的消息历史
4. **顺序保证**：缓存消息按原始顺序发送

## 注意事项

1. 缓存只在 WebSocket 断开时发生
2. 每条新消息开始时自动清空旧缓存
3. 重新关联时，客户端会收到 `flushedMessages` 字段，告知重放数量
4. 即使缓存刷新失败，也不会影响 session 的继续运行