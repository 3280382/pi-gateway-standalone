# LLM Message Loop Architecture Refactor Design

## Document Information
- **Status**: Design Proposal
- **Author**: AI Assistant
- **Date**: 2026-04-20
- **Version**: 1.0

---

## 1. Executive Summary

### Current Problem
The current LLM message loop architecture suffers from excessive complexity due to:
- Multi-layer event transformation (SDK → PiAgentSession → WebSocket → chatApi → chatStore)
- Fragmented state management across client and server
- Complex content block lifecycle tracking (start/delta/end for text/thinking/tool_use)
- Client-side message reconstruction logic for handling missing events
- Unclear boundary between "turn" and "message" concepts

### Proposed Solution
Introduce a **Unified Message Stream Protocol (UMSP)** that:
- Eliminates intermediate event layers
- Uses semantic message types instead of low-level content blocks
- Centralizes state management on the server
- Makes client a thin rendering layer

---

## 2. Current Architecture Analysis

### 2.1 Event Flow Diagram (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CURRENT ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │     │  PiAgent    │     │  WebSocket  │     │   chatApi   │
│   Session   │────▶│   Session   │────▶│   Service   │────▶│  (client)   │
│   (SDK)     │     │  (server)   │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                              ┌────────────────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Message Recon  │◀── Complex auto-fix logic
                    │   structor      │     for missing events
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    chatStore    │◀── Fragmented streaming state
                    │  (Zustand)      │    (streamingContent,
                    └────────┬────────┘     streamingThinking,
                             │              streamingToolCalls,
                    ┌────────▼────────┐     activeTools...)
                    │   UI Components │
                    └─────────────────┘

Event Types (Current):
- turn_start, turn_end
- message_start, message_end
- text_start, text_delta, text_end
- thinking_start, thinking_delta, thinking_end
- toolcall_start, toolcall_delta, toolcall_end
- tool_execution_start, tool_execution_end
- compaction_start, compaction_end
- auto_retry_start, auto_retry_end
```

### 2.2 Complexity Metrics

| Component | Lines of Code | Event Handlers | State Variables |
|-----------|--------------|----------------|-----------------|
| piAgentSession.ts | 1526 | 15+ | 12+ |
| chatStore.ts | 1200+ | N/A (reactive) | 25+ |
| chatApi.ts | 600+ | 25+ | 0 (uses store) |
| messageReconstruction.ts | 250+ | 6 | 8 |
| **Total** | **~3600** | **46+** | **45+** |

### 2.3 Key Pain Points

1. **Dual State Management**: Both server and client track content block states
2. **Event Fragility**: Missing `*_start` events require client-side reconstruction
3. **Complex Streaming Logic**: RAF batching, content preservation, tool merging
4. **Unclear Semantics**: `turn` vs `message` distinction is confusing
5. **Tool Handling Duplication**: Tool args accumulated in both server and client

---

## 3. Proposed Architecture

### 3.1 Design Principles

1. **Server-Authoritative**: Server maintains complete conversation state
2. **Semantic Events**: Events represent user-meaningful occurrences, not wire format
3. **Idempotent Updates**: Client can safely replay/reconnect without state corruption
4. **Minimal Client State**: Client only tracks UI state, not business logic
5. **Explicit Over Implicit**: Avoid "implicit" events; be declarative

### 3.2 New Event Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROPOSED ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────────────────────────────┐     ┌─────────────┐
│   Agent     │     │         Unified Message             │     │   Client    │
│   Session   │────▶│        Stream Protocol              │────▶│  Renderer   │
│   (SDK)     │     │      (Semantic Transformer)         │     │  (Thin)     │
└─────────────┘     └─────────────────────────────────────┘     └─────────────┘
                             │
                    ┌────────┴────────┐
                    │  Conversation   │◀── Single source of truth
                    │    State Mgr    │
                    └─────────────────┘

Event Types (Proposed - Reduced to 8):
- conversation_updated   (delta for new/modified messages)
- conversation_sync      (full state for reconnect)
- agent_thinking         (AI reasoning - collapsible)
- tool_invoked           (Tool call with args)
- tool_completed         (Tool result/error)
- system_notification    (compaction, retry, errors)
- status_changed         (idle/thinking/executing/waiting)
- user_action_required   (Auth, clarification, etc.)
```

### 3.3 Message Structure (UMSP)

```typescript
// Unified Message Stream Protocol
interface UMSPMessage {
  id: string;                    // Unique message ID
  type: 'assistant' | 'system' | 'tool_result';
  timestamp: number;
  
  // Content blocks - self-contained, no "delta" concept
  content: ContentBlock[];
  
  // Metadata for UI rendering
  metadata: {
    isComplete: boolean;         // false while streaming
    turnNumber: number;          // Replaces turn_start/end
    model?: string;
    usage?: TokenUsage;
  };
  
  // For client state reconstruction
  replacesPrevious?: boolean;    // For message regeneration
}

type ContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'thinking'; content: string; isCollapsible: true }
  | { type: 'tool_call'; toolCallId: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; toolCallId: string; output: string; error?: string }
  | { type: 'image'; url: string };

// Server-to-Client Event
interface UMSPEvent {
  eventId: string;               // For ACK/ordering
  type: 'delta' | 'sync' | 'notification';
  
  // For delta events: partial message updates
  delta?: {
    messageId: string;
    contentIndex: number;        // Which block is being updated
    partialContent: Partial<ContentBlock>;
  };
  
  // For sync events: complete conversation state
  sync?: {
    messages: UMSPMessage[];
    activeToolCalls: ActiveToolCall[];
    currentStatus: AgentStatus;
  };
  
  // For notifications: system events
  notification?: {
    level: 'info' | 'warning' | 'error';
    message: string;
    details?: Record<string, unknown>;
  };
}

// Client-to-Server Actions (unchanged, but better typed)
interface ClientAction {
  type: 'prompt' | 'abort' | 'steer' | 'switch_session' | 'set_model';
  payload: unknown;
  requestId: string;             // For correlating responses
}
```

---

## 4. Component Refactoring

### 4.1 Server Side: New `ConversationManager`

```typescript
// Replaces PiAgentSession event handling
class ConversationManager {
  private conversation: ConversationState;
  private messageBuilder: MessageBuilder;
  private subscribers: Set<EventSubscriber>;
  
  // Single entry point from SDK
  handleSDKEvent(event: AgentSessionEvent): void {
    const actions = this.messageBuilder.process(event);
    
    for (const action of actions) {
      switch (action.type) {
        case 'create_message':
          this.conversation.addMessage(action.message);
          this.broadcast({ type: 'delta', delta: action.delta });
          break;
          
        case 'update_message':
          this.conversation.updateMessage(action.messageId, action.updates);
          this.broadcast({ type: 'delta', delta: action.delta });
          break;
          
        case 'complete_message':
          this.conversation.finalizeMessage(action.messageId);
          this.broadcast({ type: 'delta', delta: action.finalDelta });
          break;
          
        case 'system_event':
          this.broadcast({ 
            type: 'notification', 
            notification: action.notification 
          });
          break;
      }
    }
  }
  
  // Client reconnection - send full state
  syncClient(subscriber: EventSubscriber): void {
    subscriber.send({
      type: 'sync',
      sync: {
        messages: this.conversation.getAllMessages(),
        activeToolCalls: this.conversation.getActiveToolCalls(),
        currentStatus: this.conversation.getStatus()
      }
    });
  }
}

// MessageBuilder: SDK Event → UMSP Actions
class MessageBuilder {
  private partialMessages: Map<string, PartialMessage>;
  
  process(event: AgentSessionEvent): UMSPAction[] {
    // All complexity isolated here
    // Returns declarative actions instead of sending events directly
    
    switch (event.type) {
      case 'turn_start':
        return [{ type: 'status_change', status: 'thinking' }];
        
      case 'message_start':
        this.partialMessages.set(event.message.id, new PartialMessage(event.message));
        return []; // Don't broadcast until content arrives
        
      case 'thinking_delta':
        return this.handleThinkingDelta(event);
        
      case 'text_delta':
        return this.handleTextDelta(event);
        
      case 'toolcall_start':
        return this.handleToolCallStart(event);
        
      case 'tool_execution_start':
        return this.handleToolExecutionStart(event);
        
      case 'tool_execution_end':
        return this.handleToolExecutionEnd(event);
        
      case 'message_end':
        return this.finalizeMessage(event);
        
      case 'turn_end':
        return [
          { type: 'status_change', status: 'waiting' },
          ...this.flushAnyPendingMessages()
        ];
    }
  }
  
  private handleThinkingDelta(event): UMSPAction[] {
    const partial = this.partialMessages.get(event.messageId);
    if (!partial) return this.reconstructMissingStart(event);
    
    partial.appendThinking(event.delta);
    
    return [{
      type: 'update_message',
      messageId: event.messageId,
      updates: { thinking: partial.getThinking() },
      delta: {
        messageId: event.messageId,
        contentIndex: partial.getThinkingBlockIndex(),
        partialContent: { type: 'thinking', content: partial.getThinking() }
      }
    }];
  }
  
  private reconstructMissingStart(event): UMSPAction[] {
    // Server-side reconstruction instead of client-side
    const partial = new PartialMessage({ id: event.messageId, role: 'assistant' });
    this.partialMessages.set(event.messageId, partial);
    
    return [
      {
        type: 'create_message',
        message: partial.toMessage(),
        delta: { /* ... */ }
      },
      // Recursively process the actual event
      ...this.handleThinkingDelta(event)
    ];
  }
}
```

### 4.2 Client Side: Simplified Store

```typescript
// New simplified chat store
interface ChatState {
  // Single source of truth
  messages: UMSPMessage[];
  
  // UI state only (not business logic)
  isTyping: boolean;           // Derived from last message metadata
  expandedMessageIds: Set<string>;
  collapsedThinkingIds: Set<string>;
  
  // Connection state
  connectionStatus: 'connected' | 'disconnected' | 'syncing';
}

const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  isTyping: false,
  expandedMessageIds: new Set(),
  collapsedThinkingIds: new Set(),
  connectionStatus: 'disconnected',
  
  // Simple, synchronous updates
  applyDelta: (delta: UMSPDelta) => {
    set(state => ({
      messages: applyMessageDelta(state.messages, delta),
      isTyping: !delta.isComplete
    }));
  },
  
  syncState: (sync: UMSPSync) => {
    set({
      messages: sync.messages,
      isTyping: sync.currentStatus === 'thinking'
    });
  },
  
  // UI actions only
  toggleMessageExpand: (id: string) => {
    set(state => ({
      expandedMessageIds: toggleSet(state.expandedMessageIds, id)
    }));
  },
  
  toggleThinkingCollapse: (messageId: string) => {
    set(state => ({
      collapsedThinkingIds: toggleSet(state.collapsedThinkingIds, messageId)
    }));
  }
}));

// Pure function - no side effects
function applyMessageDelta(
  messages: UMSPMessage[], 
  delta: UMSPDelta
): UMSPMessage[] {
  const existingIndex = messages.findIndex(m => m.id === delta.messageId);
  
  if (existingIndex === -1) {
    // New message
    return [...messages, createMessageFromDelta(delta)];
  }
  
  // Update existing
  const updated = [...messages];
  updated[existingIndex] = mergeDeltaIntoMessage(updated[existingIndex], delta);
  return updated;
}
```

### 4.3 Removed Components

| Component | Reason |
|-----------|--------|
| `messageReconstruction.ts` | Server now handles reconstruction |
| `streamingContent` state | Replaced by `isTyping` boolean |
| `streamingThinking` state | Part of message content array |
| `streamingToolCalls` Map | Part of message content array |
| `activeTools` Map | Tracked in conversation state |
| `*_start`, `*_end` events | Replaced by `isComplete` metadata |

---

## 5. Migration Strategy

### Phase 1: Server-side UMSP Layer (Week 1-2)
1. Create `MessageBuilder` class alongside existing code
2. Add UMSP event translation layer
3. Dual-publish events (old + new) for backward compatibility
4. Add feature flag to switch between protocols

### Phase 2: Client-side Simplification (Week 2-3)
1. Create new simplified store alongside existing
2. Implement UMSP event handlers
3. Add protocol version negotiation
4. Gradual rollout with fallback to old protocol

### Phase 3: Cleanup (Week 4)
1. Remove old event types
2. Delete `messageReconstruction.ts`
3. Simplify `piAgentSession.ts`
4. Update documentation

### Backward Compatibility

```typescript
// Protocol negotiation on connection
interface Handshake {
  clientVersion: '1.0' | '2.0';
  supportedProtocols: ('legacy' | 'umsp')[];
}

// Server selects protocol
function selectProtocol(handshake: Handshake): 'legacy' | 'umsp' {
  if (handshake.supportedProtocols.includes('umsp')) {
    return 'umsp';
  }
  return 'legacy';
}
```

---

## 6. Benefits Summary

### Quantitative Improvements

| Metric | Current | Proposed | Reduction |
|--------|---------|----------|-----------|
| Event Types | 25+ | 8 | 68% |
| LOC (server) | ~1500 | ~600 | 60% |
| LOC (client) | ~2000 | ~600 | 70% |
| State Variables | 45+ | 12 | 73% |
| Reconnection Logic | 250+ LOC | ~50 LOC | 80% |

### Qualitative Benefits

1. **Maintainability**: Single transformation layer instead of scattered handlers
2. **Testability**: Pure functions for message transformation
3. **Reliability**: Server authoritative prevents state divergence
4. **Debuggability**: Clear event semantics, no implicit behavior
5. **Extensibility**: New content types only require schema update
6. **Mobile-Friendly**: Smaller client state, better for memory constraints

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing sessions | Low | High | Dual-publish during migration |
| Performance regression | Low | Medium | Benchmark before/after |
| Incomplete feature parity | Medium | Medium | Comprehensive test suite |
| SDK compatibility | Low | High | Abstract SDK behind adapter |

---

## 8. Open Questions

1. **Binary Protocol**: Should we consider binary encoding (Protobuf/MessagePack) for efficiency?
2. **Pagination**: How should large conversation history be handled in sync events?
3. **Offline Support**: Should client cache messages for offline viewing?
4. **Collaboration**: Does this design support multi-user collaboration in future?

---

## 9. Appendix: Current vs Proposed Event Mapping

| Current Events | Proposed Event | Notes |
|----------------|----------------|-------|
| `turn_start` | `status_changed` | Status: 'thinking' |
| `message_start` | `conversation_updated` | New message with `isComplete: false` |
| `thinking_start/delta/end` | `conversation_updated` | Thinking as content block |
| `text_start/delta/end` | `conversation_updated` | Text as content block |
| `toolcall_start/delta/end` | `conversation_updated` | Tool call as content block |
| `tool_execution_start/end` | `conversation_updated` | Tool result as content block |
| `message_end` | `conversation_updated` | `isComplete: true` |
| `turn_end` | `status_changed` | Status: 'waiting' |
| `compaction_start/end` | `system_notification` | With structured details |
| `auto_retry_start/end` | `system_notification` | With attempt count |
| `usage` | Part of message metadata | Included in `message_end` |

---

## 10. Conclusion

The proposed UMSP architecture reduces complexity by:
- Consolidating 25+ event types into 8 semantic events
- Eliminating client-side message reconstruction
- Making server the single source of truth
- Creating clear, testable transformation boundaries

This refactoring will significantly improve maintainability while maintaining full feature parity.
