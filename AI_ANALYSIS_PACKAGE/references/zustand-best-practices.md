# Zustand 最佳实践指南

## 1. 单一 Store vs 多个 Store

### ❌ 避免：创建多个独立 Store

```typescript
// 不要这样做
const useChatStore = create(...)
const useSessionStore = create(...)
const useSearchStore = create(...)
const useSidebarStore = create(...)

// 问题：
// 1. 状态分散，难以同步
// 2. 跨 store 依赖复杂
// 3. 订阅性能问题
```

### ✅ 推荐：单一 Store + Slices

```typescript
// stores/gatewayStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// 组合所有 slices
export const useGatewayStore = create<GatewayState>()(
  devtools(
    persist(
      (...args) => ({
        ...createChatSlice(...args),
        ...createSessionSlice(...args),
        ...createSearchSlice(...args),
        ...createUISlice(...args),
      }),
      {
        name: 'gateway-storage',
        partialize: (state) => ({
          // 只持久化需要的数据
          session: state.session,
          settings: state.settings,
        }),
      }
    ),
    { name: 'GatewayStore' }
  )
)
```

## 2. Slice 模式

### Slice 文件结构

```typescript
// stores/slices/chatSlice.ts
import { StateCreator } from 'zustand'

// 1. 定义 State 类型
export interface ChatState {
  messages: Message[]
  isStreaming: boolean
  currentStreamingMessage: Message | null
}

// 2. 定义 Actions 类型
export interface ChatActions {
  addMessage: (message: Message) => void
  setStreaming: (isStreaming: boolean) => void
  clearMessages: () => void
}

// 3. 组合 Slice 类型
export type ChatSlice = ChatState & ChatActions

// 4. 创建 Slice
export const createChatSlice: StateCreator<
  ChatSlice,
  [],
  [],
  ChatSlice
> = (set, get) => ({
  // State
  messages: [],
  isStreaming: false,
  currentStreamingMessage: null,
  
  // Actions
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  
  setStreaming: (isStreaming) => set({ isStreaming }),
  
  clearMessages: () => set({ messages: [], currentStreamingMessage: null }),
})
```

## 3. Selector 优化

### ❌ 避免：解构整个 Store

```typescript
// 不要这样做
const { messages, isStreaming, addMessage } = useGatewayStore()
// 会导致任何状态变化都重新渲染
```

### ✅ 推荐：使用细粒度 Selector

```typescript
// 推荐做法
const messages = useGatewayStore((state) => state.messages)
const isStreaming = useGatewayStore((state) => state.isStreaming)
const addMessage = useGatewayStore((state) => state.addMessage)

// 或者使用预先定义的 selectors
const useMessages = () => useGatewayStore((state) => state.messages)
const useIsStreaming = () => useGatewayStore((state) => state.isStreaming)
```

## 4. 计算属性

### 使用 derive 中间件

```typescript
import { derive } from 'zustand-derive'

const useDerivedStore = create(
  derive((get) => ({
    // 计算属性
    filteredMessages: () => {
      const { messages, searchQuery, filters } = get()
      return filterMessages(messages, { query: searchQuery, filters })
    },
    messageCount: () => get().messages.length,
    hasMessages: () => get().messages.length > 0,
  }))
)
```

## 5. 异步 Actions

### 正确处理异步操作

```typescript
export const createAsyncSlice: StateCreator<AsyncSlice> = (set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  
  fetchData: async (id: string) => {
    // 设置加载状态
    set({ isLoading: true, error: null })
    
    try {
      const data = await api.fetchData(id)
      // 成功时更新数据
      set({ data, isLoading: false })
    } catch (error) {
      // 错误处理
      set({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false 
      })
    }
  },
})
```

## 6. 中间件组合

### 常用中间件组合

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { subscribeWithSelector } from 'zustand/middleware'

export const useStore = create<State>()(
  subscribeWithSelector(
    immer(
      devtools(
        persist(
          (set, get) => ({
            // state
          }),
          { name: 'store' }
        ),
        { name: 'Store' }
      )
    )
  )
)
```

## 7. 订阅外部事件

### WebSocket 集成

```typescript
export const createWebSocketSlice: StateCreator<WebSocketSlice> = (set, get) => {
  // 初始化 WebSocket
  const ws = new WebSocket(WS_URL)
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    switch (data.type) {
      case 'message':
        set((state) => ({
          messages: [...state.messages, data.message]
        }))
        break
      case 'status':
        set({ connectionStatus: data.status })
        break
    }
  }
  
  return {
    connectionStatus: 'disconnected',
    messages: [],
    sendMessage: (message: string) => {
      ws.send(JSON.stringify({ type: 'message', message }))
    },
  }
}
```

## 8. 测试最佳实践

### Store 测试

```typescript
import { act, renderHook } from '@testing-library/react'
import { useGatewayStore } from './gatewayStore'

describe('ChatSlice', () => {
  beforeEach(() => {
    // 重置 store 状态
    useGatewayStore.setState({
      messages: [],
      isStreaming: false,
    })
  })
  
  it('should add message', () => {
    const { result } = renderHook(() => useGatewayStore())
    
    act(() => {
      result.current.addMessage({ id: '1', text: 'Hello' })
    })
    
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].text).toBe('Hello')
  })
})
```

## 9. 常见陷阱

### ❌ 不要在组件内创建 Store

```typescript
// 错误
function MyComponent() {
  const useLocalStore = create(...) // 每次渲染都创建新 store
  const state = useLocalStore()
}
```

### ❌ 不要直接修改 State

```typescript
// 错误
set((state) => {
  state.messages.push(newMessage) // 直接修改
  return state
})

// 正确（不使用 immer）
set((state) => ({
  messages: [...state.messages, newMessage]
}))

// 正确（使用 immer）
set((state) => {
  state.messages.push(newMessage) // immer 允许这样写
})
```

### ❌ 避免在 Action 中访问其他 Slice

```typescript
// 不好
export const createBadSlice: StateCreator<BadSlice> = (set, get) => ({
  doSomething: () => {
    // 直接访问其他 slice 的状态
    const otherState = get().otherSliceState
    // 这会导致耦合
  }
})

// 更好：通过参数传递或使用事件机制
export const createGoodSlice: StateCreator<GoodSlice> = (set, get) => ({
  doSomething: (otherData: OtherData) => {
    // 通过参数接收数据
    set({ data: otherData })
  }
})
```

## 10. 性能优化

### 使用 subscribeWithSelector

```typescript
import { subscribeWithSelector } from 'zustand/middleware'

const useStore = create(
  subscribeWithSelector((set) => ({
    count: 0,
    text: '',
  }))
)

// 组件外订阅特定状态
useStore.subscribe(
  (state) => state.count,
  (count, prevCount) => {
    console.log('Count changed:', prevCount, '->', count)
  }
)
```

### 批量更新

```typescript
// 多个更新合并为一次
const batchUpdate = () => {
  set((state) => ({
    ...state,
    a: 1,
    b: 2,
    c: 3,
  }))
}
```

## 参考资源

- [Zustand 官方文档](https://docs.pmnd.rs/zustand)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [Zustand 中间件](https://github.com/pmndrs/zustand/tree/main/src/middleware)
