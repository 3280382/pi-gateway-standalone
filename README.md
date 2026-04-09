# Pi Gateway

Web gateway for Pi Coding Agent, providing a beautiful AI chat interface and file management functionality.

**Tech Stack**: React 19 + TypeScript + Vite (Frontend) | Node.js + Express + TypeScript (Backend)

## Quick Start

```bash
# Clone repository
git clone https://github.com/3280382/pi-gateway-standalone.git
cd pi-gateway-standalone

# Install dependencies
npm install

# Start development server
bash dev-start.sh
```

Visit: http://127.0.0.1:5173 (Frontend) | http://127.0.0.1:3000 (Backend)

## Project Architecture

Adopts **Modular Monolith Architecture**:

```
src/
├── client/                 # Frontend: components, state management, API client
│   ├── app/                # 🎯 Application root layer
│   │   ├── App.tsx         # Root component
│   │   ├── Footer.tsx      # Bottom view switcher
│   │   ├── LayoutContext/  # Global layout state
│   │   └── pages/          # ErrorScreen, LoadingScreen
│   │
│   ├── features/           # 📦 Feature domains (fully self-contained)
│   │   ├── chat/           # 💬 Chat feature
│   │   │   ├── components/     # ChatPanel, InputArea, MessageList...
│   │   │   ├── sidebar/        # SidebarPanel, Sessions, Settings...
│   │   │   ├── stores/         # chatStore, sidebarStore, searchStore...
│   │   │   ├── services/       # chatApi, sidebarApi...
│   │   │   ├── controllers/    # chat.controller
│   │   │   ├── hooks/          # useChat
│   │   │   └── types/          # chat, sidebar
│   │   │
│   │   └── files/          # 📁 File feature
│   │       ├── components/     # FileBrowser, FileGrid...
│   │       ├── stores/         # fileStore, fileViewerStore
│   │       ├── services/       # fileApi
│   │       └── hooks/          # useDragDrop, useGesture
│   │
│   ├── shared/             # 🔧 Global shared (minimum necessary)
│   │   ├── ui/                 # Button, Input, Select...
│   │   ├── stores/             # sessionStore
│   │   ├── services/           # websocket.service, base.service...
│   │   ├── controllers/        # file.controller, session.controller
│   │   ├── hooks/              # useAppInitialization, useChatMessages...
│   │   └── types/              # Global type definitions
│   │
│   └── lib/                # Utility libraries (debug, logger, utils)
│   └── hooks/index.ts      # Compatibility entry
│
├── server/                 # 🖥️ Backend code - Feature-Based architecture
│   ├── app/
│   │   ├── registerRoutes.ts   # HTTP route registration
│   │   └── registerWS.ts       # WebSocket handler registration entry
│   │
│   ├── features/
│   │   ├── chat/               # Chat feature (fully self-contained)
│   │   │   ├── agent-session/  # Pi Agent Session core
│   │   │   │   ├── agentSession.ts
│   │   │   │   └── utils.ts
│   │   │   ├── session-ws/     # Session WebSocket handlers
│   │   │   │   ├── init.ts
│   │   │   │   ├── change-dir.ts
│   │   │   │   └── ...
│   │   │   ├── session-controllers/  # Session HTTP controllers
│   │   │   │   └── session.controller.ts
│   │   │   ├── ws/             # Chat WebSocket handlers
│   │   │   │   ├── prompt.ts
│   │   │   │   ├── abort.ts
│   │   │   │   └── ...
│   │   │   └── controllers/    # Chat HTTP controllers
│   │   │       └── model.controller.ts
│   │   │
│   │   └── files/              # Files Feature
│   │
│   ├── shared/
│   │   └── websocket/
│   │       ├── ws-router.ts    # WebSocket router
│   │       └── types.ts
│   │
│   ├── controllers/        # HTTP controllers (gradually migrating to features)
│   ├── lib/                # Utility libraries
│   ├── llm/                # LLM logging and interceptor
│   ├── config/             # Configuration
│   └── server.ts           # Server entry
│
└── shared/                 # 🔗 Shared types (frontend and backend)
    └── types/
        ├── api.types.ts
        ├── chat.types.ts
        ├── file.types.ts
        └── websocket.types.ts

Deleted directories:
- stores/, services/, controllers/, types/ → Merged into features/ or shared/
- core/, models/ → Removed (frontend)
- server/routes/, server/middleware/, server/services/ → Removed (backend)
```

## Core Features

### 1. Unified Layout System (AppLayout)
- **Top Menu**: Model selection, Thinking level, Working directory, Search
- **Sidebar**: Collapsible, displays recent workspaces, session list, settings
- **Bottom Menu**: View switcher (Chat/Files), sidebar control
- **Bottom Panel**: Pop-up terminal/preview panel

### 2. State Persistence
- **localStorage**: Saves current working directory, session ID, model selection
- **Server-side session**: Auto-saved on WebSocket disconnect, restored on reconnect

### 3. Dual View Mode
- **Chat View**: AI chat, message history, streaming responses
- **Files View**: File browsing, editing, execution

### 4. Working Directory & Session Management
```
Working Directory (currentDir)  →  pi process working directory
Session File                   →  Persisted session history
PID                            →  Dynamic process ID
```
When switching working directory: Terminate current pi → Start new pi in new directory → Load corresponding session

### 5. Backend Feature-Based Architecture

**WebSocket Message Routing System** (`shared/websocket/ws-router.ts`):
```typescript
// Before: Giant switch/case in server.ts
// After: Using Router for dispatch
await wsRouter.dispatch(type, ctx, payload);
```

**Handler Organization** (`features/*/ws/*.ts`):
- One file per message type
- Single responsibility
- Auto-registration

## Documentation

| Document | Description |
|----------|-------------|
| [`README.md`](./README.md) | Project overview and quick start (this document) |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Development guide, architecture description, API reference, coding standards |
| [`FEATURES.md`](./FEATURES.md) | Feature specification (UI layout, feature list) |
| [`LEARNING_GUIDE.md`](./LEARNING_GUIDE.md) | System design and learning guide |
| [`AGENTS.md`](./AGENTS.md) | AI assistant instructions and development rules |
| [`CHANGELOG.md`](./CHANGELOG.md) | Version history and changes |
| [`docs/ERROR_HANDLING.md`](./docs/ERROR_HANDLING.md) | Error handling best practices |
| [`REFACTOR_SUMMARY.md`](./REFACTOR_SUMMARY.md) | Backend architecture refactor summary |

### Quick Development Standards

- **Components**: Function components + Hooks, max 200 lines
- **State**: Zustand management, use Selector for subscribing to partial state
- **Structure**: `app/` → `features/` → `shared/` → `pages/`
- **Naming**: Components PascalCase, Hooks start with `use`, Store `*Store`
- **Performance**: Virtual scroll for large data, use useMemo/useCallback for caching
- **Backend**: Feature-Based architecture, WebSocket uses Router dispatch
- **Code Organization**: Follow section markers (State → Ref → Effects → Computed → Actions → Render) for complex components

See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete standards and [UI_REACT_COMPONENT_REFACTOR_GUIDE.md](./docs/UI_REACT_COMPONENT_REFACTOR_GUIDE.md) for refactoring guidelines.

## Common Commands

```bash
# Development
npm run dev              # Start development server
bash scripts/start-tmux-dev.sh  # Tmux 3-pane mode

# Build & Check
npm run build            # Production build
npm run check            # Code check (Biome + TypeScript)

# Testing
npm test                 # Run all tests
npm run test:unit        # Unit tests
npm run test:e2e         # E2E tests

# Service Management
node scripts/tmux-controller.js status    # View service status
node scripts/tmux-controller.js restart-frontend  # Restart frontend
```

## Environment Variables

```bash
# Development environment
VITE_API_URL=http://127.0.0.1:3000
PORT=3000

# Optional: Debug mode
DEBUG=true
```

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 15+

## Relationship with Monorepo

This project is the standalone Gateway project extracted from pi-mono monorepo.

| Feature | Standalone | Monorepo |
|---------|------------|----------|
| Dependency management | npm direct install | workspace links |
| Version management | Independent | Unified |
| Deployment | Independent | Integrated |

### Local Package Development Debugging

To link packages from local monorepo:

```bash
cd /path/to/pi-mono/packages/coding-agent
npm link
cd /path/to/pi-gateway-standalone
npm link @mariozechner/pi-coding-agent
```

## License

MIT
