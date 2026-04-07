# Architecture Refactor - Change Summary

## 📋 Overview

### Server Refactor (Completed)
Refactored from **technical layered architecture** (controllers/routes/services) to **Feature-Based architecture** (features/chat, features/session).

### Client Refactor (Completed 2025-04-06)
Refactored Chat Feature **UI components** to **Hook-Based architecture**, separating business logic from UI rendering.

---

## 📁 Client Refactor Details

### Directory Structure Changes

```
src/client/features/chat/
├── components/              # UI components (pure rendering, no business logic)
│   ├── ChatPanel.tsx       # Now: ~65 lines (was ~150 lines)
│   ├── InputArea.tsx       # Now: ~280 lines (was ~550 lines)
│   ├── MessageList.tsx     # Unchanged
│   ├── MessageItem.tsx     # Unchanged
│   └── Header/
│       ├── AppHeader.tsx   # Type error fixes, preparing to integrate hooks
│       └── DirectoryPicker.tsx  # Newly extracted component
│
├── hooks/                  # Business logic Hooks
│   ├── useChat.ts                 # Basic chat operations
│   ├── useChatInit.ts             # Initialization logic
│   ├── useChatMessages.ts         # Message filtering
│   ├── useChatPanel.ts            # [NEW] ChatPanel business logic
│   ├── useInputArea.ts            # [NEW] InputArea main logic
│   ├── useFilePicker.ts           # [NEW] @mention file selection
│   ├── useImageUpload.ts          # [NEW] Image upload & OCR
│   ├── useSlashCommands.ts        # [NEW] / command selection
│   ├── useDirectoryPicker.ts      # [NEW] Directory browser
│   ├── useModelSelector.ts        # [NEW] Model selection
│   ├── useThinkingSelector.ts     # [NEW] Thinking level
│   └── useSearchFilters.ts        # [NEW] Search filtering
│
├── stores/                 # State management
├── services/               # API services
└── types/                  # Type definitions
```

### New Hooks

| Hook | Responsibility | Corresponding Component | Lines of Code |
|------|---------------|------------------------|---------------|
| `useChatPanel` | Message scrolling, send coordination | ChatPanel | ~90 |
| `useInputArea` | Input handling, send logic | InputArea | ~200 |
| `useFilePicker` | @mention file selection | InputArea | ~140 |
| `useImageUpload` | Image upload, OCR | InputArea | ~120 |
| `useSlashCommands` | Slash command selection | InputArea | ~110 |
| `useDirectoryPicker` | Directory browser | AppHeader | ~100 |
| `useModelSelector` | Model selection | AppHeader | ~90 |
| `useThinkingSelector` | Thinking level selection | AppHeader | ~70 |
| `useSearchFilters` | Search filtering | AppHeader | ~130 |

### Code Line Changes

| Component/Hook | Before Refactor | After Refactor | Change |
|----------------|-----------------|----------------|--------|
| InputArea.tsx | ~550 | ~280 | -49% |
| ChatPanel.tsx | ~150 | ~65 | -57% |
| AppHeader.tsx | ~650 | ~630 | -3% (fixes only) |
| New Hooks | 0 | ~960 | +960 |
| **Total** | ~1350 | ~1935 | +43% (maintainability improved) |

### Architecture Principles

```
Before Refactor:
Component (UI + Logic + State) → Store → Service

After Refactor:
Component (UI only) → Hook (Logic) → Store → Service
              │
              └→ Sub-Hooks (FilePicker, ImageUpload, etc.)
```

### Usage Example

```typescript
// Before refactor: InputArea.tsx contains all logic internally
function InputArea(props) {
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileList, setFileList] = useState([]);
  // ... 200+ lines of logic
}

// After refactor: Logic delegated to Hook
function InputArea(props) {
  const inputArea = useInputArea(props);
  // Only responsible for UI rendering
}
```

---

## 📁 Server Refactor Details

---

## 📁 Final Directory Structure

```
src/server/
├── app/
│   ├── registerRoutes.ts      # HTTP route registration
│   └── registerWS.ts          # WebSocket handler registration entry
│
├── config/
│   └── index.ts               # Configuration
│
├── controllers/               # HTTP controllers (gradually migrating to features/*/http/)
│   ├── file.controller.ts
│   ├── llm-log.controller.ts
│   ├── model.controller.ts
│   ├── ocr.controller.ts
│   ├── session.controller.ts
│   └── version.controller.ts
│
├── core/
│   └── session/
│       ├── GatewaySession.ts  # Core session class
│       ├── index.ts           # Module exports
│       └── utils.ts           # Session utility functions
│
├── features/
│   ├── chat/
│   │   └── ws/                # Chat WebSocket handlers
│   │       ├── abort.ts
│   │       ├── command.ts
│   │       ├── index.ts
│   │       ├── list-models.ts
│   │       ├── prompt.ts
│   │       ├── set-llm-log.ts
│   │       ├── set-model.ts
│   │       ├── steer.ts
│   │       ├── thinking-level.ts
│   │       └── tool-request.ts
│   │
│   ├── session/
│   │   └── ws/                # Session WebSocket handlers
│   │       ├── change-dir.ts
│   │       ├── index.ts
│   │       ├── init.ts
│   │       ├── list-sessions.ts
│   │       ├── load-session.ts
│   │       └── new-session.ts
│   │
│   └── files/                 # Files Feature (HTTP controllers to be expanded)
│
├── lib/
│   ├── constants/
│   ├── errors/
│   ├── utils/
│   └── app-factory.ts
│
├── llm/                       # LLM logging and interceptor
│
├── session/                   # ⚠️ Compatibility directory (deprecated)
│   ├── gateway-session.ts     # Re-export
│   └── utils.ts               # Re-export
│
├── shared/
│   └── websocket/
│       ├── types.ts           # WebSocket type definitions
│       └── ws-router.ts       # WebSocket router core
│
├── index.ts                   # Unified export entry
└── server.ts                  # Significantly simplified
```

---

## 🔑 Key Changes

### 1. WebSocket Router (Core Improvement)

**New File**: `src/server/shared/websocket/ws-router.ts`

```typescript
// Before: Giant switch/case in server.ts
switch (message.type) {
  case "prompt": await gatewaySession.prompt(...); break;
  case "abort": await gatewaySession.abort(); break;
  // ... 20+ cases
}

// After: Using Router for dispatch
await wsRouter.dispatch(type, ctx, payload);
```

**Features**:
- Express-like routing style
- Supports middleware chain
- Unified error handling
- Pluggable architecture

### 2. Feature Handlers

**Before**: All logic concentrated in `server.ts` (~400+ line switch/case)

**After**: One file per message type

```typescript
// features/chat/ws/prompt.ts
export async function handlePrompt(ctx: WSContext, payload: PromptPayload) {
  // Only handle prompt logic
}
```

### 3. Simplified server.ts

**Before**: ~400 lines WebSocket message processing logic

**After**: ~100 lines core logic

```typescript
ws.on("message", async (data) => {
  const { type, payload } = parseMessage(data);
  await wsRouter.dispatch(type, ctx, payload);
});
```

### 4. GatewaySession Moved to Core

**Before**: `src/server/session/gateway-session.ts`

**After**: `src/server/core/session/GatewaySession.ts`

- Old location maintains compatibility exports
- New code should import from core/session

---

## 🗑️ Deleted Files/Directories

| File/Directory | Reason |
|----------------|--------|
| `src/server/routes/index.ts` | Replaced by `app/registerRoutes.ts` |
| `src/server/middleware/` | Empty directory |
| `src/server/services/` | Empty directory |
| `src/server/types/` | Empty directory |
| `src/server/shared/errors/` | Empty directory |
| `src/server/shared/utils/` | Empty directory |
| `src/server/features/*/http/` | Temporarily unused |

---

## 📊 Code Statistics

| Metric | Before Refactor | After Refactor | Change |
|--------|-----------------|----------------|--------|
| server.ts lines | ~400 | ~280 | -30% |
| WebSocket handlers | 1 file | 15 files | Extensible |
| Handler responsibility | N/A | Single | ✅ |
| Empty directories | 6+ | 0 | ✅ |
| Type check errors | - | 0 | ✅ |

---

## 🔄 Backward Compatibility

### Maintained Compatible Old Files

```typescript
// session/gateway-session.ts
export { GatewaySession } from "../core/session/GatewaySession";

// session/utils.ts
export { AGENT_DIR, ... } from "../core/session/utils";
```

### Protocol Compatibility

- ✅ All WebSocket message types unchanged
- ✅ HTTP API paths unchanged
- ✅ Response format unchanged

---

## ⚠️ Client-Side Impact

**No modifications required** - Refactor only involves server-side internal architecture, all protocols and APIs remain unchanged.

Client-side message types and handler mapping:

| Client Message Type | Server Handler | Status |
|--------------------|----------------|--------|
| `prompt` | `features/chat/ws/prompt.ts` | ✅ |
| `abort` | `features/chat/ws/abort.ts` | ✅ |
| `thinking_level_change` | `features/chat/ws/thinking-level.ts` | ✅ |
| `load_session` | `features/session/ws/load-session.ts` | ✅ |
| `new_session` | `features/session/ws/new-session.ts` | ✅ |
| `change_dir` | `features/session/ws/change-dir.ts` | ✅ |
| `init` | `features/session/ws/init.ts` | ✅ |

---

## 🚀 Extension Guide

### Adding New WebSocket Handlers

```typescript
// 1. Create handler in corresponding feature directory
// features/my-feature/ws/my-handler.ts
export async function handleMyMessage(ctx: WSContext, payload: MyPayload) {
  // Processing logic
}

// 2. Register in index.ts
// features/my-feature/ws/index.ts
import { wsRouter } from "../../../shared/websocket/ws-router";
import { handleMyMessage } from "./my-handler";

export function registerMyFeatureWSHandlers() {
  wsRouter.register("my_message", handleMyMessage);
}
```

### Adding New Features

```typescript
// 1. Create directory structure
// features/new-feature/ws/
// features/new-feature/http/

// 2. Create and register handler
// features/new-feature/ws/index.ts
wsRouter.register("new_message", handler);

// 3. Import in registerWS.ts
import "./features/new-feature/ws/index";
```

---

## 📦 Dependency Relationships

```
server.ts
  ├── app/registerRoutes.ts (HTTP routes)
  ├── app/registerWS.ts (WebSocket handlers)
  │     ├── features/session/ws/ (init, change_dir, etc.)
  │     └── features/chat/ws/ (prompt, abort, etc.)
  ├── core/session/GatewaySession.ts
  └── shared/websocket/ws-router.ts
```

---

## ✅ Verification Checklist

- [x] Type checking passed (server-side)
- [x] WebSocket Router correctly dispatches messages
- [x] All handlers correctly registered
- [x] Backward compatibility maintained
- [x] GatewaySession correctly exported
- [x] Old file re-export compatibility layer
- [x] Empty directories cleaned up
- [x] Redundant files deleted
- [x] Client-side no modifications required
