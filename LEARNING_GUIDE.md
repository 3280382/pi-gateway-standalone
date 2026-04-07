# Pi Gateway - System Design and Learning Guide

> This document is for developers who need to deeply understand the system architecture, especially React performance optimization and complex state management.

## 📚 Table of Contents

1. [System Overall Architecture](#system-overall-architecture)
2. [Frontend Architecture Details](#frontend-architecture-details)
3. [Backend Architecture Details](#backend-architecture-details)
4. [React Performance Optimization Practices](#react-performance-optimization-practices)
5. [Technical Difficulties Analysis](#technical-difficulties-analysis)
6. [Development Process and Standards](#development-process-and-standards)

---

## System Overall Architecture

### Architecture Philosophy

```
UI = f(State)
```

The entire system follows **Functional Reactive Programming** principles:
- State-driven UI
- Unidirectional data flow
- Immutable data updates
- Declarative programming

### Layered Architecture

```
┌─────────────────────────────────────────┐
│           Presentation Layer (UI)        │
│  React Components + CSS Modules         │
├─────────────────────────────────────────┤
│            Logic Layer                   │
│  Hooks + Controllers                    │
├─────────────────────────────────────────┤
│            State Layer                   │
│  Zustand Stores                         │
├─────────────────────────────────────────┤
│           Service Layer                  │
│  API Clients + WebSocket                │
├─────────────────────────────────────────┤
│            Data Layer                    │
│  REST API + WebSocket Protocol          │
└─────────────────────────────────────────┘
```

---

## Frontend Architecture Details

### 1. Feature-Based Directory Structure

```
src/client/
├── app/                    # Application root layer (minimized)
│   ├── App.tsx            # Root component, only responsible for layout framework
│   ├── LayoutContext/     # Global layout state
│   └── pages/             # Page-level components
│
├── features/              # Feature domains (core)
│   ├── chat/              # Chat feature (fully self-contained)
│   │   ├── components/    # UI components
│   │   ├── stores/        # State management
│   │   ├── services/      # API services
│   │   ├── hooks/         # Business logic
│   │   └── types/         # Type definitions
│   │
│   └── files/             # File feature
│
└── shared/                # Global shared (minimum necessary)
    ├── ui/                # Atomic components
    ├── stores/            # Global state
    └── services/          # Base services
```

**Design Principles**:
- **High Cohesion**: Each Feature contains its own components, state, and services
- **Low Coupling**: Features communicate through clear interfaces
- **Pluggable**: New features only need to add new Feature directories

### 2. State Management Architecture

#### Zustand Store Design Pattern

```typescript
// Standard Store structure
interface Store {
  // State
  data: DataType[];
  isLoading: boolean;
  error: Error | null;
  
  // Actions (synchronous)
  setData: (data: DataType[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Actions (asynchronous)
  fetchData: () => Promise<void>;
  
  // Computed (using selector)
  getFilteredData: (filter: string) => DataType[];
}
```

#### Performance Optimization Key: Selector Pattern

```typescript
// ❌ Wrong: Subscribe to entire Store, any change triggers re-render
const store = useChatStore();

// ✅ Correct: Only subscribe to needed fields
const messages = useChatStore(s => s.messages);
const isStreaming = useChatStore(s => s.isStreaming);

// ✅ Better: Use predefined selector
const messages = useChatStore(selectMessages);
```

#### Batch Updates to Avoid Re-renders

```typescript
// chatStore.ts - Batch processing example
batchUpdateContent(updates: { 
  content?: string; 
  thinking?: string;
  toolCall?: ToolCallUpdate;
}) {
  // Merge all updates, only trigger one state change
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

### 3. WebSocket Real-time Communication Architecture

#### Event-Driven Design

```typescript
// WebSocketService - Pub/Sub pattern
class WebSocketService {
  private eventHandlers: Map<WebSocketEvent, Set<Function>>;
  
  on(event: WebSocketEvent, handler: Function): () => void {
    // Subscribe to event
  }
  
  emit(event: WebSocketEvent, data: any): void {
    // Broadcast event to all subscribers
  }
}
```

#### Message Flow Processing

```
WebSocket Message Flow
├── message_start      # Start new message
├── content_delta      # Text content increment
├── thinking_delta     # Thinking content increment  
├── toolcall_delta     # Tool call increment
├── tool_start         # Tool start execution
├── tool_update        # Tool execution update
├── tool_end           # Tool execution complete
├── message_end        # Message end
└── turn_end           # Complete turn end
```

#### Streaming Rendering Optimization

```typescript
// Use RAF (RequestAnimationFrame) to batch streaming updates
let rafId: number | null = null;
let pendingUpdates = {};

function scheduleRafUpdate() {
  if (rafId !== null) return; // Already have pending update
  
  rafId = requestAnimationFrame(() => {
    // Apply all accumulated updates in one animation frame
    applyPendingUpdates();
    rafId = null;
  });
}
```

---

## Backend Architecture Details

### 1. Feature-Based Backend Architecture

```
src/server/
├── features/
│   ├── chat/ws/           # Chat WebSocket handlers
│   ├── session/ws/        # Session WebSocket handlers
│   └── files/             # Files HTTP controllers
│
├── core/session/          # Core session management
├── shared/websocket/      # WebSocket infrastructure
└── app/                   # Application entry
```

### 2. WebSocket Router Design

```typescript
// Replace traditional switch/case
// Before: 400+ line giant switch
switch (message.type) {
  case "prompt": await handlePrompt(...); break;
  case "abort": await handleAbort(...); break;
  // ... 20+ cases
}

// After: Declarative routing
wsRouter.register("prompt", handlePrompt);
wsRouter.register("abort", handleAbort);

// Dispatch
await wsRouter.dispatch(type, ctx, payload);
```

### 3. Context Pattern

```typescript
interface WSContext {
  ws: WebSocket;              # WebSocket connection
  session: GatewaySession;    # Session instance
  connectionId: string;       # Connection unique identifier
  connectedAt: Date;          # Connection time
}

// Handler receives context and payload
async function handlePrompt(ctx: WSContext, payload: PromptPayload) {
  // Single responsibility: only handle prompt
}
```

---

## React Performance Optimization Practices

### 1. Render Optimization

#### Correct Use of memo

```typescript
// MessageItem.tsx - Custom comparison function
export const MessageItem = memo(
  function MessageItem({ message, showThinking, ...props }: Props) {
    // Component logic
  },
  // Custom comparison: only re-render when key properties change
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.isStreaming === nextProps.message.isStreaming &&
      // Streaming messages only compare content length when ending
      (!prevProps.message.isStreaming || 
        prevProps.message.content.length === nextProps.message.content.length)
    );
  }
);
```

#### useMemo for Complex Calculations

```typescript
// Cache message block parsing results
const blocks = useMemo(() => {
  return message.content.map((c, idx) => ({ 
    ...c, 
    originalIndex: idx 
  }));
}, [message.content]);

// Cache text extraction
const fullText = useMemo(() => {
  return blocks
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("");
}, [blocks]);
```

#### useCallback for Callback Caching

```typescript
// Avoid creating new function on each render
const handleCopy = useCallback(() => {
  navigator.clipboard.writeText(text);
}, [text]);

// Depend on stable callbacks
const handleToggle = useCallback((id: string) => {
  toggleMessage(id);
}, [toggleMessage]);
```

### 2. Streaming Content Performance Optimization

#### Problem: Character-by-character updates cause frequent re-renders

```
AI generates: "Hello world"
Traditional: 11 updates → 11 re-renders
Optimized: Use RAF batching → 1-2 re-renders
```

#### Solution: RAF Batching

```typescript
// Accumulate updates, apply uniformly in next frame
let pendingContent = "";
let pendingThinking = "";

function appendContent(text: string) {
  pendingContent += text;
  scheduleRafUpdate();
}

function scheduleRafUpdate() {
  if (rafId) return; // Already pending
  
  rafId = requestAnimationFrame(() => {
    // Apply all accumulated updates
    setState({
      streamingContent: pendingContent,
      streamingThinking: pendingThinking,
    });
    // Clear pending
    pendingContent = "";
    pendingThinking = "";
    rafId = null;
  });
}
```

### 3. Large Data List Optimization

#### Virtual Scrolling

```typescript
// Only render content in visible area
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

#### Pagination/Infinite Scroll

```typescript
// Only load currently needed data
const [visibleCount, setVisibleCount] = useState(50);

const visibleMessages = useMemo(() => {
  return messages.slice(0, visibleCount);
}, [messages, visibleCount]);

// Load more when scrolling to bottom
const loadMore = useCallback(() => {
  setVisibleCount(prev => prev + 50);
}, []);
```

### 4. State Selection Optimization

#### Fine-grained Subscription

```typescript
// ❌ Bad: Subscribe to entire store
const { messages, inputText, isStreaming } = useChatStore();

// ✅ Good: Only subscribe to needed fields
const messages = useChatStore(s => s.messages);
const inputText = useChatStore(s => s.inputText);
const isStreaming = useChatStore(s => s.isStreaming);
```

#### Derived State Using Selector

```typescript
// Use selector to compute derived state
const filteredMessages = useChatStore(
  useCallback(
    state => filterMessages(state.messages, filters),
    [filters]
  )
);
```

---

## Technical Difficulties Analysis

### Difficulty 1: Multi-round Processing of Streaming Messages

**Problem**: AI may perform multiple rounds of thinking and tool calls in one response

**Solution**:

```typescript
// Use turn_marker to mark turn boundaries
content.push({
  type: "turn_marker",
  turnNumber: currentTurn,
});

// Retain previous rounds when building content
const previousRounds = existingContent.slice(0, lastTurnMarkerIndex + 1);
const finalContent = [...previousRounds, ...currentRound];
```

### Difficulty 2: Synchronization of Message Collapse State

**Problem**: Streaming messages and completed messages share collapse state

**Solution**:

```typescript
// Update both messages and currentStreamingMessage simultaneously
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

### Difficulty 3: WebSocket Reconnection and State Recovery

**Solution**:

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

### Difficulty 4: Balance Between Code Highlighting and Streaming Rendering

**Problem**: Prism.js highlighting modifies DOM, conflicting with React's virtual DOM

**Solution**:

```typescript
// Only execute highlighting when not streaming
useEffect(() => {
  if (codeRef.current && window.Prism && !isStreaming) {
    window.Prism.highlightElement(codeRef.current);
  }
}, [code, language, isStreaming]);
```

---

## Development Process and Standards

### 1. Component Development Process

```
1. Define Props interface (TypeScript)
2. Write pure rendering component
3. Add styles (CSS Modules)
4. Optimize with memo
5. Write unit tests
6. Add Storybook documentation (optional)
```

### 2. Store Development Process

```
1. Define State interface
2. Define Actions interface
3. Implement create function
4. Add devtools middleware
5. Write selectors
6. Write unit tests
```

### 3. Code Review Checklist

#### Performance Check
- [ ] Is Selector used to subscribe to state?
- [ ] Is memo used to cache components?
- [ ] Is useMemo used to cache calculations?
- [ ] Is useCallback used to cache callbacks?
- [ ] Are there unnecessary re-renders?

#### Code Quality
- [ ] Are TypeScript types complete?
- [ ] Is component under 200 lines?
- [ ] Does it follow single responsibility principle?
- [ ] Is error handling complete?
- [ ] Are unit tests written?

### 4. Common Mistakes and Avoidance

| Mistake | Impact | Solution |
|---------|--------|----------|
| Destructure entire store | Unnecessary re-renders | Use selector |
| Create function/object in render | Unnecessary child re-renders | Use useCallback/useMemo |
| Use index as key | List update issues | Use stable unique ID |
| Directly modify state | Unpredictable state | Always return new object |
| Component too large | Hard to maintain | Split into small components |

### 5. Debugging Techniques

#### React DevTools Profiler

```
1. Open Profiler tab
2. Click "Record"
3. Perform operation
4. Stop recording
5. Analyze render time
```

#### Zustand DevTools

```typescript
// Enable Redux DevTools integration
const useStore = create(
  devtools(
    (set, get) => ({ ... }),
    { name: "ChatStore" }
  )
);
```

#### Performance Measurement

```typescript
// Use Performance API
const start = performance.now();
// ... Execute operation
const end = performance.now();
console.log(`Operation took ${end - start}ms`);
```

---

## Learning Path Recommendations

### Beginner (1-2 weeks)
1. Understand Feature-Based architecture
2. Master Zustand basic usage
3. Learn React memo/useMemo/useCallback
4. Familiarize with CSS Modules

### Intermediate (2-4 weeks)
1. Deeply understand Selector pattern
2. Master WebSocket communication
3. Learn streaming content processing
4. Understand state management best practices

### Advanced (4+ weeks)
1. Performance optimization techniques
2. Complex state synchronization problems
3. Architecture design decisions
4. Testing strategies

---

## Recommended Resources

### React Performance
- [React Official Performance Optimization Docs](https://react.dev/learn/render-and-commit)
- [Kent C. Dodds - Fix the slow render before you fix the re-render](https://kentcdodds.com/blog/fix-the-slow-render-before-you-fix-the-re-render)

### State Management
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Redux Performance Best Practices](https://redux.js.org/style-guide/#performance)

### Architecture Design
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

*Last updated: April 2024*
