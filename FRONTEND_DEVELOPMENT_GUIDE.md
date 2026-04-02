# Pi Gateway 前端开发规范

> 版本: 1.0  
> 适用项目: pi-gateway-standalone  
> 最后更新: 2026-04-02

---

## 一、整体架构原则

### 1.1 核心哲学

```
UI = f(State)
```

- **函数组件 + Hooks**: 全面使用 Function Component，禁止 Class Component
- **单向数据流**: 数据自上而下，事件自下而上
- **严格分层**: 视图(UI) ← 逻辑(Hooks) ← 状态(Store) ← 服务(API)
- **不可变性**: 所有状态更新必须返回新对象，禁止直接修改

### 1.2 禁止事项

```typescript
// ❌ 禁止: Class Component
class MyComponent extends React.Component {}

// ❌ 禁止: 直接修改状态
messages.push(newMessage);

// ❌ 禁止: 在组件中直接 fetch
useEffect(() => {
  fetch('/api/data').then(...);
}, []);

// ❌ 禁止: 使用 index 作为 key
{list.map((item, index) => <div key={index} />)}

// ❌ 禁止: 巨型组件 (>200行)
function HugeComponent() { /* 500行代码 */ }
```

---

## 二、项目结构（强制执行）

### 2.1 目录架构

```
src/client/
│
├── app/                          # 应用核心层
│   ├── layout/                   # 全局布局组件
│   │   ├── AppLayout/
│   │   ├── AppHeader/
│   │   ├── AppFooter/
│   │   ├── panels/
│   │   └── index.ts
│   ├── providers/                # 全局 Provider
│   └── navigation/               # 导航组件
│
├── features/                     # 功能域（按业务划分）
│   ├── chat/                     # 聊天功能
│   │   ├── components/           # 业务组件
│   │   ├── hooks/                # 业务 Hooks
│   │   ├── store/                # 业务状态 (可选)
│   │   └── types.ts              # 类型定义
│   ├── files/                    # 文件功能
│   ├── sidebar/                  # 侧边栏功能
│   └── system/                   # 系统功能
│
├── shared/                       # 共享资源
│   ├── components/               # 通用组件
│   │   └── ui/                   # 基础 UI
│   ├── hooks/                    # 通用 Hooks
│   └── utils/                    # 工具函数
│
├── pages/                        # 页面组件
├── stores/                       # 全局状态
├── services/                     # API 服务
├── hooks/                        # 全局 Hooks
└── types/                        # 全局类型
```

### 2.2 目录规则

| 目录 | 用途 | 示例 |
|------|------|------|
| `app/` | 应用级组件，不依赖业务 | layout, providers |
| `features/` | 按业务功能组织 | chat/, files/, sidebar/ |
| `shared/` | 纯技术组件，无业务逻辑 | Button, Input, useDebounce |
| `pages/` | 路由页面，简单组装 | ChatPage, FilesPage |

### 2.3 文件组织（组件目录）

```
ComponentName/
├── index.ts              # 统一导出
├── ComponentName.tsx     # 组件实现
├── ComponentName.module.css
├── ComponentName.test.tsx
└── types.ts              # 组件专属类型（可选）
```

---

## 三、组件设计规范

### 3.1 单一职责原则

```typescript
// ❌ 错误: 一个组件做多件事
function ChatComponent() {
  // 处理消息列表
  // 处理输入框
  // 处理 WebSocket 连接
  // 处理文件上传
  // 500行代码...
}

// ✅ 正确: 容器组件组装
function ChatPage() {
  return (
    <ChatContainer>
      <MessageList />
      <ChatInput />
    </ChatContainer>
  );
}
```

### 3.2 组件大小限制

- **软限制**: 单个组件不超过 150 行
- **硬限制**: 单个组件不超过 200 行
- **超过限制必须拆分**

### 3.3 组件类型

| 类型 | 命名 | 位置 | 职责 |
|------|------|------|------|
| 容器组件 | ChatContainer | features/*/components/ | 组装 UI，连接状态 |
| 展示组件 | MessageItem | features/*/components/ | 纯渲染，props 驱动 |
| 基础组件 | Button | shared/components/ui/ | 原子级，可复用 |
| 页面组件 | ChatPage | pages/ | 简单组装，无逻辑 |

### 3.4 Props 定义规范

```typescript
// ✅ 必须定义 TypeScript 类型
interface MessageItemProps {
  message: Message;
  showThinking: boolean;
  onToggleCollapse: () => void;
}

// ✅ 解构 + 默认值
export function MessageItem({
  message,
  showThinking = true,
  onToggleCollapse,
}: MessageItemProps) {
  // ...
}

// ❌ 禁止使用 any
interface Props {
  data: any;  // ❌
}
```

### 3.5 事件命名规范

```typescript
// ✅ 使用 on + 动词 + 名词
onToggleCollapse
onSendMessage
onSelectFile

// ❌ 避免模糊命名
handleClick     // ❌ 不够具体
onChange        // ❌ 缺少上下文
```

---

## 四、状态管理规范

### 4.1 状态分层

| 状态类型 | 工具 | 使用场景 |
|----------|------|----------|
| 局部状态 | useState | 表单输入、开关状态 |
| 组件共享 | props drilling | 父子组件简单传递 |
| 功能域状态 | Zustand (feature store) | 聊天消息、文件列表 |
| 全局状态 | Zustand (global store) | 用户信息、主题设置 |
| 服务端数据 | React Query (如引入) | API 数据缓存 |

### 4.2 Zustand Store 规范

```typescript
// ✅ 文件: features/chat/store/chatStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// 1. 定义状态类型
interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  // ...
}

// 2. 定义 Actions 类型
interface ChatActions {
  addMessage: (message: Message) => void;
  setStreaming: (streaming: boolean) => void;
  // ...
}

// 3. 创建 Store
export const useChatStore = create<ChatState & ChatActions>()(
  devtools(
    (set, get) => ({
      // 初始状态
      messages: [],
      isStreaming: false,
      
      // Actions
      addMessage: (message) => 
        set((state) => ({ 
          messages: [...state.messages, message] 
        }), false, 'addMessage'),
      
      setStreaming: (streaming) => 
        set({ isStreaming: streaming }, false, 'setStreaming'),
    }),
    { name: 'ChatStore' }
  )
);

// 4. 导出 Selectors（用于性能优化）
export const selectMessages = (state: ChatState) => state.messages;
export const selectIsStreaming = (state: ChatState) => state.isStreaming;
```

### 4.3 状态更新规范

```typescript
// ✅ 使用函数式更新
set((state) => ({ 
  messages: [...state.messages, newMessage] 
}));

// ✅ 批量更新（减少重渲染）
batchUpdate({ 
  content: newContent, 
  thinking: newThinking 
});

// ❌ 禁止直接修改
messages.push(newMessage);  // ❌

// ❌ 禁止全量替换大数据
set({ messages: [...messages, newMessage] }); // 大数据时性能差
```

### 4.4 大数据状态管理

```typescript
// ✅ 针对上万条数据的优化
interface LargeListState {
  // 使用 Map 存储，O(1) 查询
  itemsMap: Map<string, Item>;
  // 只保留可见区域的 ID 列表
  visibleIds: string[];
  // 总数量（不存储全部数据）
  totalCount: number;
}

// ✅ append 模式更新
appendItems: (newItems: Item[]) => set((state) => {
  const newMap = new Map(state.itemsMap);
  newItems.forEach(item => newMap.set(item.id, item));
  return { itemsMap: newMap };
});
```

---

## 五、Hooks 规范

### 5.1 自定义 Hooks 规则

```typescript
// ✅ 必须以 use 开头
function useChat() { }
function useVirtualList() { }

// ❌ 非法命名
function chatHook() { }     // ❌
function ChatHelper() { }   // ❌
```

### 5.2 Hooks 分层

| 层级 | 位置 | 职责 | 示例 |
|------|------|------|------|
| 基础 Hooks | shared/hooks/ | 纯技术，无业务 | useDebounce, useLocalStorage |
| 业务 Hooks | features/*/hooks/ | 业务逻辑封装 | useChat, useFileBrowser |
| 全局 Hooks | hooks/ | 跨功能复用 | useAppInitialization |

### 5.3 Hooks 实现规范

```typescript
// ✅ 文件: features/chat/hooks/useChat.ts

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';

export function useChat() {
  // 1. 从 Store 获取状态
  const messages = useChatStore(selectMessages);
  const isStreaming = useChatStore(selectIsStreaming);
  
  // 2. 获取 Actions
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  
  // 3. 封装业务逻辑
  const sendMessage = useCallback(async (text: string) => {
    // 实现...
  }, [addMessage, setStreaming]);
  
  // 4. 返回状态和方法
  return {
    messages,
    isStreaming,
    sendMessage,
  };
}
```

### 5.4 useEffect 使用规范

```typescript
// ✅ 副作用必须清理
useEffect(() => {
  const subscription = websocketService.subscribe(callback);
  return () => subscription.unsubscribe();
}, []);

// ✅ 依赖数组必须完整
useEffect(() => {
  console.log(userId);
}, [userId]);  // ✅ 包含所有依赖

// ❌ 禁止滥用 useEffect 进行状态派生
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);  // ❌
}, [firstName, lastName]);

// ✅ 使用 useMemo 进行派生
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);
```

### 5.5 useEffect 适用场景

| 场景 | 示例 |
|------|------|
| ✅ 数据请求 | 初始化加载数据 |
| ✅ 订阅 | WebSocket、EventListener |
| ✅ 定时器 | setInterval、setTimeout |
| ✅ DOM 操作 | 聚焦、测量（极少） |
| ❌ 状态派生 | 用 useMemo 代替 |
| ❌ props 转 state | 直接计算 |

---

## 六、性能优化（强制执行）

### 6.1 大数据列表优化

```typescript
// ✅ 虚拟滚动（必须用于 >100 条数据）
import { FixedSizeList } from 'react-window';

function MessageList({ messages }: { messages: Message[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={messages.length}
      itemSize={80}
      itemData={messages}
    >
      {MessageRow}
    </FixedSizeList>
  );
}

// ✅ 稳定 key（禁止使用 index）
{messages.map((msg) => (
  <MessageItem key={msg.id} message={msg} />  // ✅
))}

{messages.map((msg, index) => (
  <MessageItem key={index} message={msg} />   // ❌
))}
```

### 6.2 渲染优化

```typescript
// ✅ 使用 Selector 订阅局部状态
const messages = useChatStore((s) => s.messages);      // ✅ 只订阅 messages
const isStreaming = useChatStore((s) => s.isStreaming); // ✅ 只订阅 isStreaming

// ❌ 禁止订阅整个 Store
const store = useChatStore();  // ❌ 任何状态变化都会重渲染

// ✅ 使用 useMemo 缓存计算
const filteredMessages = useMemo(() => 
  messages.filter(m => m.visible),
  [messages]
);

// ✅ 使用 useCallback 缓存回调
const handleToggle = useCallback((id: string) => {
  toggleMessage(id);
}, [toggleMessage]);
```

### 6.3 避免 Render 阶段计算

```typescript
// ❌ 不要在 render 中执行重计算
function Component({ data }) {
  const processed = heavyCalculation(data);  // ❌ 每次渲染都执行
  return <div>{processed}</div>;
}

// ✅ 使用 useMemo
function Component({ data }) {
  const processed = useMemo(() => 
    heavyCalculation(data),
    [data]
  );
  return <div>{processed}</div>;
}
```

---

## 七、服务层规范

### 7.1 API 请求封装

```typescript
// ✅ 文件: services/api/chatApi.ts

import { client } from './client';

export interface SendMessageRequest {
  text: string;
  sessionId?: string;
}

export interface SendMessageResponse {
  messageId: string;
  content: string;
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const response = await client.post('/api/chat/send', request);
  return response.data;
}
```

### 7.2 Controller 模式

```typescript
// ✅ 文件: controllers/chatController.ts

import { chatApi } from '@/services/api/chatApi';
import { useChatStore } from '@/features/chat/store/chatStore';

export class ChatController {
  private store = useChatStore;
  
  async sendMessage(text: string) {
    // 1. 更新本地状态
    this.store.getState().setStreaming(true);
    
    // 2. 调用 API
    try {
      const response = await chatApi.sendMessage({ text });
      // 3. 更新状态
      this.store.getState().addMessage(response);
    } catch (error) {
      // 4. 错误处理
      this.store.getState().setError(error);
    } finally {
      this.store.getState().setStreaming(false);
    }
  }
}

export const chatController = new ChatController();
```

---

## 八、代码风格

### 8.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | MessageItem, ChatPage |
| Hooks | camelCase + use | useChat, useVirtualList |
| Store | camelCase + Store | chatStore, sessionStore |
| 类型 | PascalCase | Message, ChatState |
| 接口 | PascalCase + Props | MessageItemProps |
| 常量 | UPPER_SNAKE_CASE | MAX_MESSAGE_COUNT |

### 8.2 文件命名

```
组件:        MessageItem.tsx
Hook:        useChat.ts
Store:       chatStore.ts
类型:        chat.types.ts
工具:        formatDate.ts
样式:        MessageItem.module.css
测试:        MessageItem.test.tsx
```

### 8.3 导入顺序

```typescript
// 1. React 核心
import { useState, useCallback } from 'react';

// 2. 第三方库
import { create } from 'zustand';

// 3. 内部共享
import { Button } from '@/shared/components/ui';
import { useDebounce } from '@/shared/hooks';

// 4. 功能域内
import { useChatStore } from '../store/chatStore';
import { MessageItem } from './MessageItem';

// 5. 类型
import type { Message } from '../types';

// 6. 样式
import styles from './ChatList.module.css';
```

---

## 九、TypeScript 规范

### 9.1 严格类型检查

```typescript
// ✅ 严格模式必须开启
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// ✅ 禁止隐式 any
function process(data: any) { }  // ❌
function process(data: unknown) { }  // ✅

// ✅ 使用类型守卫
function isMessage(data: unknown): data is Message {
  return data && typeof (data as Message).id === 'string';
}
```

### 9.2 类型定义位置

```typescript
// ✅ 组件 Props 与组件同文件
interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) { }

// ✅ 共享类型放在 types.ts
// features/chat/types.ts
export interface Message {
  id: string;
  content: string;
  timestamp: Date;
}

// ✅ 全局类型放在 src/types/
// src/types/global.ts
export interface User {
  id: string;
  name: string;
}
```

---

## 十、测试规范

### 10.1 测试文件位置

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.test.tsx  # 同目录
└── __tests__/              # 或子目录
    └── ComponentName.test.tsx
```

### 10.2 测试命名

```typescript
// ✅ 描述性行为测试
describe('MessageItem', () => {
  it('should render message content', () => {});
  it('should call onToggle when clicked', () => {});
  it('should display thinking block when showThinking is true', () => {});
});
```

---

## 十一、常见错误清单

### ❌ 禁止清单

| 错误 | 正确做法 |
|------|----------|
| `document.getElementById` | 使用 React ref |
| `window.addEventListener` | 使用 React 事件或 useEffect 清理 |
| `Math.random()` 作为 key | 使用稳定唯一 ID |
| `JSON.parse(JSON.stringify(obj))` | 使用结构化克隆或 immer |
| 直接修改数组/对象 | 返回新对象 `[...arr]` |
| 在 render 中创建新函数 | 使用 useCallback |
| 在 render 中创建新对象 | 使用 useMemo |
| 滥用 useEffect | 优先使用事件处理 |
| 组件 > 200 行 | 拆分组件 |
| props 穿透超过 3 层 | 使用 Context 或 Store |

---

## 十二、示例：完整组件实现

```typescript
/**
 * MessageList - 消息列表组件
 * 
 * 设计原则:
 * 1. 纯展示组件，props 驱动
 * 2. 虚拟滚动优化大数据
 * 3. 稳定 key 避免重渲染
 */

import { memo, useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import { MessageItem } from '../MessageItem';
import type { Message } from '../../types';
import styles from './MessageList.module.css';

// Props 接口定义
interface MessageListProps {
  messages: Message[];
  showThinking: boolean;
  onToggleMessage: (id: string) => void;
}

// 列表项渲染组件（memo 优化）
const MessageRow = memo(({ 
  index, 
  data 
}: { 
  index: number; 
  data: Message[];
}) => {
  const message = data[index];
  return (
    <MessageItem
      key={message.id}  // 稳定 key
      message={message}
      index={index}
    />
  );
});

MessageRow.displayName = 'MessageRow';

// 主组件
export function MessageList({
  messages,
  showThinking,
  onToggleMessage,
}: MessageListProps) {
  // 缓存回调
  const handleToggle = useCallback((id: string) => {
    onToggleMessage(id);
  }, [onToggleMessage]);

  // 空状态
  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={styles.container}>
      <FixedSizeList
        height={600}
        itemCount={messages.length}
        itemSize={80}
        itemData={messages}
        className={styles.list}
      >
        {MessageRow}
      </FixedSizeList>
    </div>
  );
}

// 子组件拆分
function EmptyState() {
  return (
    <div className={styles.empty}>
      <p>No messages yet</p>
    </div>
  );
}
```

---

## 十三、重构检查清单

重构组件前，确保：

- [ ] 组件 < 200 行
- [ ] 使用 TypeScript 严格类型
- [ ] Props 接口完整定义
- [ ] 使用稳定 key
- [ ] 大数据使用虚拟滚动
- [ ] 复杂逻辑抽离到 Hook
- [ ] 副作用有清理函数
- [ ] 回调使用 useCallback
- [ ] 计算使用 useMemo
- [ ] 使用 Selector 订阅状态

---

## 十四、附录

### 推荐工具

| 类别 | 工具 | 用途 |
|------|------|------|
| 状态管理 | Zustand | 全局状态 |
| 虚拟滚动 | react-window | 大数据列表 |
| 不可变性 | immer | 状态更新 |
| 请求 | axios | HTTP 请求 |
| 测试 | vitest | 单元测试 |
| lint | eslint | 代码检查 |

### 参考资源

- [React 官方文档](https://react.dev/)
- [Zustand 文档](https://docs.pmnd.rs/zustand)
- [React 性能优化](https://react.dev/reference/react/memo)

---

**注意**: 本规范为强制执行规范，代码审查时必须遵守。如有特殊情况需申请例外。
