# Feature-Based 项目结构指南

## 1. 为什么使用 Feature-Based 结构

### 传统结构的痛点

```
src/
├── components/          # 所有组件放在一起
├── hooks/               # 所有 hooks 放在一起
├── stores/              # 所有 stores 放在一起
├── utils/               # 所有工具函数放在一起
└── services/            # 所有服务放在一起

问题：
1. 文件分散，难以找到相关代码
2. 修改一个功能需要跨多个目录
3. 依赖关系不清晰
4. 难以删除或重命名功能
```

### Feature-Based 的优势

```
src/
├── features/
│   ├── chat/            # Chat 功能的所有代码
│   ├── search/          # Search 功能的所有代码
│   └── files/           # Files 功能的所有代码
├── shared/              # 真正共享的代码
└── app/                 # 应用入口

优势：
1. 功能内聚，相关代码在一起
2. 清晰的边界和依赖关系
3. 易于理解和维护
4. 便于团队协作
5. AI 友好的结构
```

## 2. Feature 目录结构

### 标准 Feature 结构

```
features/chat/
├── components/          # 功能专用组件
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   └── InputArea.tsx
├── hooks/               # 功能专用 hooks
│   ├── useMessages.ts
│   └── useSendMessage.ts
├── stores/
│   └── chatSlice.ts     # 功能状态 slice
├── utils/
│   └── messageHelpers.ts
├── types.ts             # 功能类型定义
├── api.ts               # 功能 API 调用
├── constants.ts         # 功能常量
└── index.ts             # Feature 入口
```

### 完整示例

```typescript
// features/chat/index.ts
// Feature 公共 API

export { MessageList } from './components/MessageList'
export { MessageItem } from './components/MessageItem'
export { InputArea } from './components/InputArea'

export { useMessages } from './hooks/useMessages'
export { useSendMessage } from './hooks/useSendMessage'

export { createChatSlice } from './stores/chatSlice'

export type { Message, MessageStatus } from './types'

// Feature 配置
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 10000,
  MESSAGE_HISTORY_LIMIT: 1000,
  AUTO_SCROLL_THRESHOLD: 100,
} as const
```

## 3. Shared 目录

### 什么应该放在 Shared

```
shared/
├── components/          # 通用 UI 组件
│   ├── Button/
│   ├── Input/
│   ├── Modal/
│   └── Layout/
├── hooks/               # 通用 hooks
│   ├── useLocalStorage.ts
│   ├── useDebounce.ts
│   └── useMediaQuery.ts
├── utils/               # 通用工具
│   ├── formatDate.ts
│   ├── truncateText.ts
│   └── validateEmail.ts
├── lib/                 # 库配置
│   ├── axios.ts
│   └── queryClient.ts
└── types/               # 通用类型
    ├── api.ts
    └── common.ts
```

### Shared 组件示例

```typescript
// shared/components/Button/Button.tsx
import { forwardRef } from 'react'
import styles from './Button.module.css'

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, disabled, children, onClick }, ref) => {
    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${styles[size]}`}
        disabled={disabled || isLoading}
        onClick={onClick}
      >
        {isLoading ? <Spinner /> : children}
      </button>
    )
  }
)
```

## 4. Store 组织

### 统一的 Store 入口

```typescript
// stores/gatewayStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// 导入所有 slices
import { createChatSlice, ChatSlice } from '../features/chat/stores/chatSlice'
import { createSearchSlice, SearchSlice } from '../features/search/stores/searchSlice'
import { createSessionSlice, SessionSlice } from '../features/session/stores/sessionSlice'
import { createUISlice, UISlice } from './uiSlice'

// 组合所有 slices 的类型
type GatewayState = ChatSlice & SearchSlice & SessionSlice & UISlice

export const useGatewayStore = create<GatewayState>()(
  devtools(
    persist(
      (...args) => ({
        ...createChatSlice(...args),
        ...createSearchSlice(...args),
        ...createSessionSlice(...args),
        ...createUISlice(...args),
      }),
      {
        name: 'gateway-storage',
        partialize: (state) => ({
          // 只持久化必要的 state
          session: {
            currentSessionId: state.currentSessionId,
            currentDir: state.currentDir,
          },
          settings: state.settings,
        }),
      }
    ),
    { name: 'GatewayStore' }
  )
)

// 导出类型
export type { GatewayState }
```

### Slice 文件

```typescript
// features/chat/stores/chatSlice.ts
import { StateCreator } from 'zustand'
import { Message } from '../types'

export interface ChatState {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
}

export interface ChatActions {
  addMessage: (message: Message) => void
  updateStreamingContent: (content: string) => void
  finishStreaming: () => void
  clearMessages: () => void
}

export type ChatSlice = ChatState & ChatActions

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  
  updateStreamingContent: (content) =>
    set((state) => ({
      streamingContent: state.streamingContent + content,
    })),
  
  finishStreaming: () =>
    set((state) => ({
      isStreaming: false,
      streamingContent: '',
    })),
  
  clearMessages: () =>
    set({ messages: [], isStreaming: false, streamingContent: '' }),
})
```

## 5. 跨 Feature 通信

### 方式 1：通过 Store

```typescript
// features/search/stores/searchSlice.ts
export const createSearchSlice: StateCreator<SearchSlice> = (set, get) => ({
  searchQuery: '',
  
  setSearchQuery: (query) => {
    set({ searchQuery: query })
    
    // 触发其他 slice 的 action
    const { filterMessages } = get()
    filterMessages(query)
  },
})
```

### 方式 2：通过事件系统

```typescript
// shared/lib/eventEmitter.ts
import { EventEmitter } from 'events'

export const appEvents = new EventEmitter()

// features/chat/stores/chatSlice.ts
export const createChatSlice: StateCreator<ChatSlice> = (set) => {
  // 监听其他 feature 的事件
  appEvents.on('sessionChanged', (sessionId) => {
    set({ currentSessionId: sessionId })
  })
  
  return {
    messages: [],
    currentSessionId: null,
    // ...
  }
}

// features/session/stores/sessionSlice.ts
export const createSessionSlice: StateCreator<SessionSlice> = (set) => ({
  changeSession: (sessionId) => {
    set({ currentSessionId: sessionId })
    // 触发事件
    appEvents.emit('sessionChanged', sessionId)
  },
})
```

### 方式 3：通过 Hook 组合

```typescript
// features/chat/hooks/useChatWithSearch.ts
import { useGatewayStore } from '@/stores/gatewayStore'
import { filterMessages } from '@/features/search/utils/messageFilters'

export function useChatWithSearch() {
  const messages = useGatewayStore((state) => state.messages)
  const searchQuery = useGatewayStore((state) => state.searchQuery)
  const searchFilters = useGatewayStore((state) => state.searchFilters)
  
  const filteredMessages = useMemo(() => {
    return filterMessages(messages, {
      query: searchQuery,
      filters: searchFilters,
    })
  }, [messages, searchQuery, searchFilters])
  
  return { messages: filteredMessages }
}
```

## 6. 路由与 Feature

### 按 Feature 组织路由

```typescript
// app/router.tsx
import { createBrowserRouter } from 'react-router-dom'

// Feature 页面
import { ChatPage } from '@/features/chat/pages/ChatPage'
import { FilesPage } from '@/features/files/pages/FilesPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <ChatPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
```

### Feature 页面结构

```typescript
// features/chat/pages/ChatPage.tsx
import { MessageList } from '../components/MessageList'
import { InputArea } from '../components/InputArea'
import { ChatSidebar } from '../components/ChatSidebar'
import { useChatInit } from '../hooks/useChatInit'

export function ChatPage() {
  useChatInit() // 初始化 chat feature
  
  return (
    <div className={styles.chatPage}>
      <ChatSidebar />
      <div className={styles.main}>
        <MessageList />
        <InputArea />
      </div>
    </div>
  )
}
```

## 7. 测试策略

### Feature 单元测试

```typescript
// features/chat/stores/chatSlice.test.ts
import { createChatSlice } from './chatSlice'

describe('chatSlice', () => {
  const set = jest.fn()
  const get = jest.fn()
  
  it('should add message', () => {
    const slice = createChatSlice(set, get, {
      messages: [],
      isStreaming: false,
      streamingContent: '',
    })
    
    const message = { id: '1', text: 'Hello', role: 'user' }
    slice.addMessage(message)
    
    expect(set).toHaveBeenCalledWith(expect.any(Function))
  })
})
```

### 集成测试

```typescript
// features/chat/Chat.integration.test.tsx
import { render, screen } from '@testing-library/react'
import { GatewayStoreProvider } from '@/stores/GatewayStoreProvider'
import { ChatPage } from './pages/ChatPage'

describe('Chat Feature', () => {
  it('should send and display message', async () => {
    render(
      <GatewayStoreProvider>
        <ChatPage />
      </GatewayStoreProvider>
    )
    
    // 测试完整流程
  })
})
```

## 8. AI 友好性

### 为什么 Feature-Based 对 AI 友好

1. **边界清晰**：AI 知道修改范围
2. **文件内聚**：相关代码在一起，减少上下文切换
3. **入口明确**：`index.ts` 提供清晰的 API
4. **依赖可见**：导入路径显示依赖关系

### AI 开发指南模板

```markdown
<!-- features/chat/AI_GUIDE.md -->
# Chat Feature AI 开发指南

## 文件结构
- `components/` - UI 组件
- `hooks/` - 业务逻辑 hooks
- `stores/chatSlice.ts` - 状态管理
- `utils/` - 工具函数

## 修改检查清单
- [ ] 修改 slice 后检查 selectors
- [ ] 新增组件添加类型定义
- [ ] 测试覆盖新功能

## 常见任务
### 添加新消息类型
1. 更新 `types.ts`
2. 更新 `chatSlice.ts`
3. 更新 `MessageItem.tsx`

### 修改消息显示
1. 修改 `MessageItem.tsx`
2. 更新样式
3. 检查响应式表现
```

## 参考资源

- [Feature Sliced Design](https://feature-sliced.design/)
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [React Folder Structure](https://reactjs.org/docs/faq-structure.html)
