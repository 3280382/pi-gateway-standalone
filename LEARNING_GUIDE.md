# Pi Gateway - 系统设计与学习指南

> 本文档面向需要深入理解系统架构的开发者，特别是 React 性能优化和复杂状态管理方面。

## 📚 目录

1. [系统整体架构](#系统整体架构)
2. [前端架构详解](#前端架构详解)
3. [后端架构详解](#后端架构详解)
4. [React 性能优化实践](#react-性能优化实践)
5. [技术难点分析](#技术难点分析)
6. [开发流程与规范](#开发流程与规范)

---

## 系统整体架构

### 架构哲学

```
UI = f(State)
```

整个系统遵循 **函数式响应编程** 思想：
- 状态驱动 UI
- 单向数据流
- 不可变数据更新
- 声明式编程

### 分层架构

```
┌─────────────────────────────────────────┐
│              表现层 (UI)                 │
│  React Components + CSS Modules         │
├─────────────────────────────────────────┤
│              逻辑层 (Logic)              │
│  Hooks + Controllers                    │
├─────────────────────────────────────────┤
│              状态层 (State)              │
│  Zustand Stores                         │
├─────────────────────────────────────────┤
│              服务层 (Service)            │
│  API Clients + WebSocket                │
├─────────────────────────────────────────┤
│              数据层 (Data)               │
│  REST API + WebSocket Protocol          │
└─────────────────────────────────────────┘
```

---

## 前端架构详解

### 1. Feature-Based 目录结构

```
src/client/
├── app/                    # 应用根层（最小化）
│   ├── App.tsx            # 根组件，只负责布局框架
│   ├── LayoutContext/     # 全局布局状态
│   └── pages/             # 页面级组件
│
├── features/              # 功能域（核心）
│   ├── chat/              # 聊天功能（完全自包含）
│   │   ├── components/    # UI 组件
│   │   ├── stores/        # 状态管理
│   │   ├── services/      # API 服务
│   │   ├── hooks/         # 业务逻辑
│   │   └── types/         # 类型定义
│   │
│   └── files/             # 文件功能
│
└── shared/                # 全局共享（最小必要）
    ├── ui/                # 原子组件
    ├── stores/            # 全局状态
    └── services/          # 基础服务
```

**设计原则**：
- **高内聚**：每个 Feature 包含自己的组件、状态、服务
- **低耦合**：Feature 间通过明确的接口通信
- **可插拔**：新增功能只需添加新的 Feature 目录

### 2. 状态管理架构

#### Zustand Store 设计模式

```typescript
// 标准 Store 结构
interface Store {
  // State
  data: DataType[];
  isLoading: boolean;
  error: Error | null;
  
  // Actions (同步)
  setData: (data: DataType[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Actions (异步)
  fetchData: () => Promise<void>;
  
  // Computed (使用 selector)
  getFilteredData: (filter: string) => DataType[];
}
```

#### 性能优化关键：Selector 模式

```typescript
// ❌ 错误：订阅整个 Store，任何变化都触发重渲染
const store = useChatStore();

// ✅ 正确：只订阅需要的字段
const messages = useChatStore(s => s.messages);
const isStreaming = useChatStore(s => s.isStreaming);

// ✅ 更优：使用预定义的 selector
const messages = useChatStore(selectMessages);
```

#### 批量更新避免重渲染

```typescript
// chatStore.ts - 批处理示例
batchUpdateContent(updates: { 
  content?: string; 
  thinking?: string;
  toolCall?: ToolCallUpdate;
}) {
  // 合并所有更新，只触发一次状态变更
  set({
    streamingContent: newContent,
    streamingThinking: newThinking,
    streamingToolCalls: newToolCalls,
    currentStreamingMessage: {
      ...state.currentStreamingMessage,
      content: contentArray,
    },
  });
}
```

### 3. WebSocket 实时通信架构

#### 事件驱动设计

```typescript
// WebSocketService - 发布订阅模式
class WebSocketService {
  private eventHandlers: Map<WebSocketEvent, Set<Function>>;
  
  on(event: WebSocketEvent, handler: Function): () => void {
    // 订阅事件
  }
  
  emit(event: WebSocketEvent, data: any): void {
    // 广播事件给所有订阅者
  }
}
```

#### 消息流处理

```
WebSocket 消息流
├── message_start      # 开始新消息
├── content_delta      # 文本内容增量
├── thinking_delta     # 思考内容增量  
├── toolcall_delta     # 工具调用增量
├── tool_start         # 工具开始执行
├── tool_update        # 工具执行更新
├── tool_end           # 工具执行完成
├── message_end        # 消息结束
└── turn_end           # 完整回合结束
```

#### 流式渲染优化

```typescript
// 使用 RAF (RequestAnimationFrame) 批处理流式更新
let rafId: number | null = null;
let pendingUpdates = {};

function scheduleRafUpdate() {
  if (rafId !== null) return; // 已有待处理更新
  
  rafId = requestAnimationFrame(() => {
    // 在一次动画帧中应用所有累积的更新
    applyPendingUpdates();
    rafId = null;
  });
}
```

---

## 后端架构详解

### 1. Feature-Based 后端架构

```
src/server/
├── features/
│   ├── chat/ws/           # Chat WebSocket 处理器
│   ├── session/ws/        # Session WebSocket 处理器
│   └── files/             # Files HTTP 控制器
│
├── core/session/          # 核心会话管理
├── shared/websocket/      # WebSocket 基础设施
└── app/                   # 应用入口
```

### 2. WebSocket Router 设计

```typescript
// 替代传统的 switch/case
// 之前: 400+ 行的巨型 switch
switch (message.type) {
  case "prompt": await handlePrompt(...); break;
  case "abort": await handleAbort(...); break;
  // ... 20+ cases
}

// 之后: 声明式路由
wsRouter.register("prompt", handlePrompt);
wsRouter.register("abort", handleAbort);

// 分发
await wsRouter.dispatch(type, ctx, payload);
```

### 3. 上下文模式 (Context Pattern)

```typescript
interface WSContext {
  ws: WebSocket;              # WebSocket 连接
  session: GatewaySession;    # 会话实例
  connectionId: string;       # 连接唯一标识
  connectedAt: Date;          # 连接时间
}

// 处理器接收上下文和负载
async function handlePrompt(ctx: WSContext, payload: PromptPayload) {
  // 单一职责：只处理 prompt
}
```

---

## React 性能优化实践

### 1. 渲染优化

#### memo 的正确使用

```typescript
// MessageItem.tsx - 自定义比较函数
export const MessageItem = memo(
  function MessageItem({ message, showThinking, ...props }: Props) {
    // 组件逻辑
  },
  // 自定义比较：只在关键属性变化时重渲染
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.isStreaming === nextProps.message.isStreaming &&
      // 流式消息只在结束时比较内容
      (!prevProps.message.isStreaming || 
        prevProps.message.content.length === nextProps.message.content.length)
    );
  }
);
```

#### useMemo 缓存复杂计算

```typescript
// 缓存消息块解析结果
const blocks = useMemo(() => {
  return message.content.map((c, idx) => ({ 
    ...c, 
    originalIndex: idx 
  }));
}, [message.content]);

// 缓存文本提取
const fullText = useMemo(() => {
  return blocks
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("");
}, [blocks]);
```

#### useCallback 缓存回调

```typescript
// 避免每次渲染创建新函数
const handleCopy = useCallback(() => {
  navigator.clipboard.writeText(text);
}, [text]);

// 依赖稳定的回调
const handleToggle = useCallback((id: string) => {
  toggleMessage(id);
}, [toggleMessage]);
```

### 2. 流式内容性能优化

#### 问题：每字符更新导致频繁重渲染

```
AI 生成: "Hello world"
传统方式: 11 次更新 → 11 次重渲染
优化方式: 使用 RAF 批处理 → 1-2 次重渲染
```

#### 解决方案：RAF 批处理

```typescript
// 累积更新，在下一帧统一应用
let pendingContent = "";
let pendingThinking = "";

function appendContent(text: string) {
  pendingContent += text;
  scheduleRafUpdate();
}

function scheduleRafUpdate() {
  if (rafId) return; // 已有待处理
  
  rafId = requestAnimationFrame(() => {
    // 应用所有累积的更新
    setState({
      streamingContent: pendingContent,
      streamingThinking: pendingThinking,
    });
    // 清空待处理
    pendingContent = "";
    pendingThinking = "";
    rafId = null;
  });
}
```

### 3. 大数据列表优化

#### 虚拟滚动

```typescript
// 只渲染可视区域的内容
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={500}
  itemCount={messages.length}
  itemSize={100}
  itemData={messages}
>
  {MessageRow}
</FixedSizeList>
```

#### 分页/无限滚动

```typescript
// 只加载当前需要的数据
const [visibleCount, setVisibleCount] = useState(50);

const visibleMessages = useMemo(() => {
  return messages.slice(0, visibleCount);
}, [messages, visibleCount]);

// 滚动到底部时加载更多
const loadMore = useCallback(() => {
  setVisibleCount(prev => prev + 50);
}, []);
```

### 4. 状态选择优化

#### 细粒度订阅

```typescript
// ❌ 坏：订阅整个 store
const { messages, inputText, isStreaming } = useChatStore();

// ✅ 好：只订阅需要的字段
const messages = useChatStore(s => s.messages);
const inputText = useChatStore(s => s.inputText);
const isStreaming = useChatStore(s => s.isStreaming);
```

#### 派生状态使用 selector

```typescript
// 使用 selector 计算派生状态
const filteredMessages = useChatStore(
  useCallback(
    state => filterMessages(state.messages, filters),
    [filters]
  )
);
```

---

## 技术难点分析

### 难点 1：流式消息的多轮处理

**问题**：AI 可能在一次回复中进行多轮思考和工具调用

**解决方案**：

```typescript
// 使用 turn_marker 标记轮次边界
content.push({
  type: "turn_marker",
  turnNumber: currentTurn,
});

// 构建内容时保留之前轮次
const previousRounds = existingContent.slice(0, lastTurnMarkerIndex + 1);
const finalContent = [...previousRounds, ...currentRound];
```

### 难点 2：消息折叠状态的同步

**问题**：流式消息和已完成消息共享折叠状态

**解决方案**：

```typescript
// 同时更新 messages 和 currentStreamingMessage
set(state => {
  const updatedMessages = state.messages.map(msg =>
    msg.id === messageId
      ? { ...msg, isToolsCollapsed: !msg.isToolsCollapsed }
      : msg
  );
  
  const updatedStreaming = 
    state.currentStreamingMessage?.id === messageId
      ? { ...state.currentStreamingMessage, isToolsCollapsed: ... }
      : state.currentStreamingMessage;
      
  return { messages: updatedMessages, currentStreamingMessage: updatedStreaming };
});
```

### 难点 3：WebSocket 重连与状态恢复

**解决方案**：

```typescript
class WebSocketService {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  private setupReconnect(wsUrl: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
      
      setTimeout(() => {
        this.connect(wsUrl).catch(console.error);
      }, delay);
    }
  }
}
```

### 难点 4：代码高亮与流式渲染的平衡

**问题**：Prism.js 高亮会修改 DOM，与 React 的虚拟 DOM 冲突

**解决方案**：

```typescript
// 只在非流式时执行高亮
useEffect(() => {
  if (codeRef.current && window.Prism && !isStreaming) {
    window.Prism.highlightElement(codeRef.current);
  }
}, [code, language, isStreaming]);
```

---

## 开发流程与规范

### 1. 组件开发流程

```
1. 定义 Props 接口（TypeScript）
2. 编写纯渲染组件
3. 添加样式（CSS Modules）
4. 使用 memo 优化
5. 编写单元测试
6. 添加 Storybook 文档（可选）
```

### 2. Store 开发流程

```
1. 定义 State 接口
2. 定义 Actions 接口
3. 实现 create 函数
4. 添加 devtools 中间件
5. 编写 selectors
6. 编写单元测试
```

### 3. 代码审查清单

#### 性能检查
- [ ] 是否使用了 Selector 订阅状态？
- [ ] 是否使用了 memo 缓存组件？
- [ ] 是否使用了 useMemo 缓存计算？
- [ ] 是否使用了 useCallback 缓存回调？
- [ ] 是否存在不必要的重渲染？

#### 代码质量
- [ ] TypeScript 类型是否完整？
- [ ] 组件是否小于 200 行？
- [ ] 是否遵循单一职责原则？
- [ ] 错误处理是否完善？
- [ ] 是否编写了单元测试？

### 4. 常见错误与避免

| 错误 | 影响 | 解决方案 |
|------|------|----------|
| 解构整个 store | 不必要的重渲染 | 使用 selector |
| 在 render 中创建函数/对象 | 子组件不必要重渲染 | 使用 useCallback/useMemo |
| 使用 index 作为 key | 列表更新问题 | 使用稳定唯一 ID |
| 直接修改 state | 状态不可预测 | 始终返回新对象 |
| 过大的组件 | 难以维护 | 拆分为小组件 |

### 5. 调试技巧

#### React DevTools Profiler

```
1. 打开 Profiler 标签
2. 点击 "Record"
3. 执行操作
4. 停止记录
5. 分析渲染时间
```

#### Zustand DevTools

```typescript
// 启用 Redux DevTools 集成
const useStore = create(
  devtools(
    (set, get) => ({ ... }),
    { name: "ChatStore" }
  )
);
```

#### 性能测量

```typescript
// 使用 Performance API
const start = performance.now();
// ... 执行操作
const end = performance.now();
console.log(`Operation took ${end - start}ms`);
```

---

## 学习路径建议

### 初级（1-2 周）
1. 理解 Feature-Based 架构
2. 掌握 Zustand 基础使用
3. 学习 React memo/useMemo/useCallback
4. 熟悉 CSS Modules

### 中级（2-4 周）
1. 深入理解 Selector 模式
2. 掌握 WebSocket 通信
3. 学习流式内容处理
4. 理解状态管理最佳实践

### 高级（4+ 周）
1. 性能优化技术
2. 复杂状态同步问题
3. 架构设计决策
4. 测试策略

---

## 推荐资源

### React 性能
- [React 官方性能优化文档](https://react.dev/learn/render-and-commit)
- [Kent C. Dodds - Fix the slow render before you fix the re-render](https://kentcdodds.com/blog/fix-the-slow-render-before-you-fix-the-re-render)

### 状态管理
- [Zustand 文档](https://docs.pmnd.rs/zustand)
- [Redux 性能最佳实践](https://redux.js.org/style-guide/#performance)

### 架构设计
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

*最后更新: 2024年4月*
