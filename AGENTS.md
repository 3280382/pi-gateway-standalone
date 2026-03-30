# Pi Gateway Standalone - Development Rules

## 🎯 PROJECT IDENTIFICATION

**Current Project**: pi-gateway-standalone
**Location**: /root/pi-gateway-standalone
**GitHub**: https://github.com/3280382/pi-gateway-standalone

## First Message

If the user did not give you a concrete task in their first message,
**ALWAYS read these documents in parallel**:
- `README.md` - Project overview and quick start
- `DEVELOPMENT.md` - Development workflow and architecture
- `FEATURES.md` - Feature specification and UI layout

Only after reading these, ask which specific feature or module to work on.

## Project Overview

This is a **standalone** Pi Gateway project, independent from the pi-mono monorepo.

- **Name**: pi-gateway-standalone
- **Location**: ~/pi-gateway-standalone
- **Type**: Modular Monolith (client/server/shared)

## Architecture

```
src/
├── client/    # React frontend (browser)
│   ├── components/
│   │   ├── layout/     # AppLayout, TopBar, BottomMenu, Sidebar
│   │   ├── chat/       # MessageList, InputArea, MessageItem
│   │   └── files/      # FileBrowser, FileViewer, FileToolbar
│   ├── stores/         # Zustand state management
│   └── services/       # API & WebSocket services
├── server/    # Express backend (Node.js)
│   ├── session/        # GatewaySession management
│   ├── routes/         # Express routes
│   └── server.ts       # Server entry
└── shared/    # Shared types and constants
```

## Key Architecture Components

### 1. AppLayout System

All views use the unified `AppLayout` component:

```
┌─────────────────────────────────┐
│ Header (64px) - TopBar          │
│ Row1: Model | Thinking | Status │
│ Row2: Working Dir | Search      │
├──────────┬──────────────────────┤
│ Sidebar  │  Content             │
│ (280px)  │  ├─ contentBody      │
│          │  └─ inputArea        │
├──────────┴──────────────────────┤
│ Footer (44px) - BottomMenu      │
├─────────────────────────────────┤
│ BottomPanel (popup terminal)    │
└─────────────────────────────────┘
```

**Design Principle**: Layout styles are centralized in `AppLayout.module.css`. Child components only handle content rendering, not layout positioning.

### 2. State Management

**Frontend (Zustand + Persist)**:
```typescript
// sessionStore.ts - Persisted to localStorage
{
  currentDir,        // Current working directory
  currentSessionId,  // Current session ID
  currentModel,      // Selected model
  thinkingLevel,     // Thinking level
  theme,             // Theme preference
  recentWorkspaces,  // Recent workspaces
}
```

**Backend (GatewaySession)**:
```typescript
class GatewaySession {
  session: AgentSession | null;  // pi-coding-agent session
  workingDir: string;             // Working directory
  ws: WebSocket;                  // WebSocket connection
  
  initialize(workingDir, sessionId?)  // Init session
  dispose()                           // Cleanup & auto-save
}
```

### 3. Working Directory & Session Lifecycle

```
Working Directory  →  Session File  →  PID
     (static)           (static)     (dynamic)
```

When switching directories:
1. Frontend sends `change_dir` message
2. Backend disposes current session
3. Starts new pi process in new directory
4. Loads/creates session file
5. Returns new PID

## Development Workflow

### Prerequisites

- Node.js >= 18
- tmux (for 3-pane development)

### Start Development

```bash
# Tmux 3-pane mode (recommended)
bash scripts/start-tmux-dev.sh

# Layout:
# ┌─────────┬─────────┐  ← Top 33% (frontend | backend)
# ├─────────┴─────────┤
# │   AI/pi (bottom)  │  ← Bottom 67%
# └───────────────────┘
```

### Key Commands

```bash
# Development
npm run dev                    # Start dev server
bash scripts/start-tmux-dev.sh # Tmux 3-pane mode

# Build & Check
npm run build                  # Production build
npm run check                  # Biome + TypeScript check

# Testing
npm test                       # Run all tests
npm run test:unit             # Unit tests only

# Service Management
node scripts/tmux-controller.js status    # Check status
node scripts/tmux-controller.js restart-frontend
```

## Code Quality Rules

### TypeScript
- Strict mode enabled
- No `any` types unless absolutely necessary
- Use path aliases: `@/*`, `@shared/*`, `@server/*`

### Boundaries
- `client/` cannot import `@server/*`
- `server/` cannot import `@client/*`
- `shared/` only types/constants, no runtime logic

### Before Committing
```bash
npm run check  # Fix all errors, warnings, infos
```

## Testing

```bash
timeout 120 npm test                 # Unit + Integration tests
timeout 60 npm run test:unit        # Unit tests only
timeout 180 npm run test:e2e         # E2E tests
```

## Git

### Commit Message Format
```
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Example:
feat(chat): add message search
```

## Documentation

- `README.md` - Project overview
- `DEVELOPMENT.md` - Development guide
- `FEATURES.md` - Feature specification
- `CHANGELOG.md` - Version history

## Service Verification

```bash
# Check logs
tail -20 logs/frontend_current.log
tail -20 logs/backend_current.log

# Verify endpoints
timeout 5 curl -s http://127.0.0.1:5173 > /dev/null && echo "Frontend OK"
timeout 5 curl -s http://127.0.0.1:3000/api/settings > /dev/null && echo "Backend OK"
```

## Dependencies

Published npm packages:
- `@mariozechner/pi-ai`
- `@mariozechner/pi-agent-core`
- `@mariozechner/pi-coding-agent`
