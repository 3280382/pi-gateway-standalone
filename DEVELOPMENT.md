# Development Guide

> **AI Assistants**: This is a supplementary document. Read [`AGENTS.md`](./AGENTS.md) first.

## Quick Start

```bash
# Tmux 3-pane mode (recommended)
bash scripts/start-tmux-dev.sh

# Or separate terminals
npm run dev        # Backend
npm run dev:react  # Frontend
```

## Architecture Principles

### Frontend: Feature-Based Organization

```
src/client/
├── features/chat/        # Chat feature (self-contained)
│   ├── components/       # UI components
│   ├── stores/          # Zustand stores
│   ├── services/        # API services
│   ├── hooks/           # Custom hooks
│   └── types/           # Type definitions
├── features/files/       # File feature
└── shared/              # Global shared (minimal)
```

### Backend: Feature-Based Organization

```
src/server/
├── features/chat/
│   ├── agent-session/   # PiAgentSession core
│   ├── ws-handlers/     # WebSocket handlers
│   └── controllers/     # HTTP controllers
└── shared/              # Shared utilities
```

### Import Constraints

```
client/  → Cannot import @server/*
server/  → Cannot import @client/*
shared/  → Types only (no runtime logic)
```

## Coding Standards

### Component Structure

```typescript
// Section markers for complex components
// ========== 1. State ==========
// ========== 2. Ref ==========
// ========== 3. Effects ==========
// ========== 4. Computed ==========
// ========== 5. Actions ==========
// ========== 6. Render ==========
```

### State Management

```typescript
// ✅ Good: Use selector
const messages = useChatStore((s) => s.messages);

// ❌ Bad: Destructure entire store
const store = useChatStore(); // Causes re-renders
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `MessageItem`, `ChatPage` |
| Hooks | camelCase + use | `useChat`, `useFileBrowser` |
| Stores | camelCase + Store | `chatStore`, `sessionStore` |
| Types | PascalCase | `Message`, `ChatState` |

### Performance

- Virtual scroll for large lists
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed to children

## WebSocket API

### Message Types

| Type | Direction | Description |
|-----|-----------|-------------|
| `init` | C→S | Initialize session |
| `prompt` | C→S | Send message to AI |
| `abort` | C→S | Abort generation |
| `set_model` | C→S | Set AI model |
| `list_models` | C→S | List available models |
| `change_dir` | C→S | Change working directory |

## Git Workflow

### Commit Format

```
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Example:
feat(chat): add message search
```

### Before Committing

```bash
npm run check  # Must pass
```

## Debugging

- **Frontend**: Vite hot reload, check browser DevTools
- **Backend**: tsx watch auto-restart, check `logs/backend_current.log`
- **WebSocket**: Browser Network WS tab
