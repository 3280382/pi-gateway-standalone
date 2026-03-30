# Pi Gateway Standalone - AI Assistant Guide

## Project Identification

- **Name**: pi-gateway-standalone
- **Location**: /root/pi-gateway-standalone
- **GitHub**: https://github.com/3280382/pi-gateway-standalone

## First Message Rule

If the user did not give a concrete task, **ALWAYS read in parallel**:
1. `README.md` - Project overview
2. `DEVELOPMENT.md` - Development guide
3. `FEATURES.md` - Feature specification

Then ask which specific feature to work on.

## Architecture Overview

```
src/
├── client/           # React frontend
│   ├── components/
│   │   ├── layout/   # AppLayout, TopBar, BottomMenu, Sidebar
│   │   ├── chat/     # MessageList, InputArea
│   │   └── files/    # FileBrowser
│   ├── stores/       # Zustand state management
│   └── services/     # API & WebSocket services
├── server/           # Express backend
│   ├── session/      # GatewaySession management
│   └── routes/       # API routes
└── shared/           # Shared types
```

## Key Design Principles

### 1. Unified AppLayout

All views share the same layout structure:
- **Header** (64px): TopBar with controls
- **Sidebar** (280px): Collapsible, contains workspaces/sessions
- **Content**: Main area for MessageList or FileBrowser
- **Footer** (44px): BottomMenu for view switching
- **BottomPanel**: Overlay panel for terminal/preview

### 2. State Management Boundaries

- **LayoutContext**: React Context for UI state (sidebar visibility, current view)
- **sessionStore (persisted)**: User settings saved to localStorage
- **chatStore**: Ephemeral chat state (messages, streaming status)
- **GatewaySession**: Backend session management

### 3. Working Directory & Session

```
Working Directory ──► Session File ──► PID
    (static)            (static)      (dynamic)
```

When switching directories, the backend disposes the current session and starts a new pi process in the new directory.

## Development Rules

### Boundaries

| From | Cannot Import To |
|------|------------------|
| `client/` | `@server/*` |
| `server/` | `@client/*` |
| `shared/` | Runtime logic (types only) |

### Before Committing

```bash
npm run check  # Fix all errors, warnings
```

### Commit Format

```
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Example:
feat(chat): add message search
```

## Common Tasks

### Complete Workflow

```bash
npm run build      # 1. Build
npm run check      # 2. Lint & type check
npm test           # 3. Test
node scripts/tmux-controller.js status  # 4. Verify services
```

### View Switching

App.tsx uses `currentView` from LayoutContext:
- `'chat'`: Shows MessageList + InputArea
- `'files'`: Shows FileBrowser, no InputArea

### State Updates

```typescript
// ✅ Correct: Select specific action
const setCurrentDir = useSessionStore((s) => s.setCurrentDir);

// ❌ Wrong: Destructures entire store
const store = useSessionStore();  // Causes unnecessary re-renders
```

## Documentation

- `README.md` - Quick start, overview
- `DEVELOPMENT.md` - Detailed development guide
- `FEATURES.md` - UI specification
- `CHANGELOG.md` - Version history
