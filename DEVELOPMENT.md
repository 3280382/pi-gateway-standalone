# Development Guide

> **AI Assistants**: For quick reference and testing standards, read [`AGENTS.md`](./AGENTS.md) first.

## Quick Start

```bash
# Install dependencies
npm install

# Start development environment (tmux 3-pane mode)
bash ./dev-start.sh
```

## Project Architecture

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

### Import Constraints (Non-Violable)

```
client/  → Cannot import @server/*
server/  → Cannot import @client/*
shared/  → Types only (no runtime logic)
```

## Coding Standards

### Component Structure

Complex components should use section markers:

```typescript
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

### Performance Guidelines

- Virtual scroll for large lists
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed to children
- Never use `Math.random()` as React key

## WebSocket API

### Client → Server Messages

| Type | Description |
|------|-------------|
| `init` | Initialize session with working directory |
| `prompt` | Send message to AI |
| `abort` | Abort generation |
| `set_model` | Set AI model |
| `list_models` | List available models |
| `change_dir` | Change working directory |

### Server → Client Messages

| Type | Description |
|------|-------------|
| `ack` | Acknowledgment |
| `response` | AI response chunk |
| `tool_call` | Tool execution notification |
| `error` | Error notification |

## Development Environment

### Quick Start (Tmux Mode)

```bash
# Create tmux session with 3 panes
bash ./dev-start.sh create

# Start all services
bash ./dev-start.sh start

# Attach to session (Ctrl+b d to detach)
bash ./dev-start.sh attach
```

### Tmux Pane Layout

```
+-----------------+-----------------+
|   Frontend      |    Backend      |
|   (Vite HMR)    |  (tsx watch)    |
+-----------------+-----------------+
|                                   |
|         AI / Logs                 |
|                                   |
+-----------------------------------+
```

### Commands

```bash
bash ./dev-start.sh [command]

Commands:
  create    Create tmux session
  start     Start frontend + backend
  stop      Stop all services
  restart   Restart all services
  status    Check service status
  logs      View logs (frontend|backend)
  attach    Attach to session
  kill      Kill session
```

### Auto Reload

| Component | Command | Method |
|-----------|---------|--------|
| Backend | `npm run dev` | tsx watch - auto-restart on changes |
| Frontend | `npm run dev:react` | Vite HMR - browser auto-refresh |

## Testing

### Required Checks Before Commit

```bash
npm run check  # Biome + TypeScript check
```

### Test Script Guidelines

**Location:** Temporary scripts go to `test/tmp/`

**Principles:**
1. **Prefer existing tests** - Use `scripts/run-all-tests.sh` first
2. **Check existing logs** - Review `logs/backend_current.log` and browser console
3. **Avoid duplication** - Don't re-implement logging/testing infrastructure
4. **Clean up** - Move useful temporary tests to permanent test suites

### Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Unit tests (Vitest) |
| `bash scripts/run-terminal-tests.sh` | Integration tests |
| `npx playwright test` | E2E browser tests |

### Test Results

All test results are saved to `test-results/latest/`:

```
test-results/latest/
├── summary.md           # Human-readable report
├── backend/
│   ├── server.log      # Backend logs
│   └── test.log        # Test execution logs
├── browser/
│   ├── console.log     # Browser console output
│   └── ws-messages.json # WebSocket records
└── screenshots/        # Test screenshots
```

## Git Workflow

### Commit Format

```
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Example:
feat(chat): add message search
```

## Debugging

- **Frontend**: Vite hot reload, check browser DevTools
- **Backend**: tsx watch auto-restart, check `logs/backend_current.log`
- **WebSocket**: Browser Network → WS tab

## Prohibited Practices

- Direct `fetch` in components (use services/)
- Use `Math.random()` as React key
- Directly modify arrays/objects in state (return new objects)
- Write business logic in components (extract to hooks)
- Put runtime logic in `shared/` (types only)
