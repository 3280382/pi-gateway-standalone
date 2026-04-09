# Development Guide

## 🎯 Current Project
**Project Name**: pi-gateway-standalone  
**Project Location**: /root/pi-gateway-standalone  
**GitHub**: https://github.com/3280382/pi-gateway-standalone

## Quick Start (Recommended: Tmux 3-Pane Mode)

```bash
bash scripts/start-tmux-dev.sh
```

This creates three panes in one tmux session:
- **Top Left**: Frontend service (http://127.0.0.1:5173)
- **Top Right**: Backend service (http://127.0.0.1:3000)
- **Bottom**: AI interaction pane

Shortcuts:
- `Ctrl+b + ↑/↓/←/→` - Switch panes
- `Ctrl+b + d` - Detach session (runs in background)

### Traditional Startup Method

```bash
bash dev-start.sh  # Non-tmux, runs directly in background
```

## Project Architecture

Adopts **Modular Monolith Architecture** - organized by feature domains:

```
src/
├── client/
│   ├── app/                    # Application root layer
│   │   ├── App.tsx
│   │   ├── Footer.tsx
│   │   ├── LayoutContext/      # Global layout state
│   │   └── pages/              # ErrorScreen, LoadingScreen
│   │
│   ├── features/               # Feature domains (fully self-contained)
│   │   ├── chat/               # Chat feature
│   │   │   ├── components/     # UI components
│   │   │   ├── sidebar/        # Sidebar components
│   │   │   ├── stores/         # chatStore, sidebarStore...
│   │   │   ├── services/       # chatApi, sidebarApi...
│   │   │   ├── controllers/    # chat.controller
│   │   │   ├── hooks/          # useChat
│   │   │   └── types/          # Type definitions
│   │   │
│   │   └── files/              # File feature
│   │       ├── components/     # FileBrowser...
│   │       ├── stores/         # fileStore...
│   │       ├── services/       # fileApi...
│   │       └── hooks/          # useDragDrop...
│   │
│   ├── shared/                 # Global shared (minimum necessary)
│   │   ├── ui/                 # Atomic components
│   │   ├── stores/             # sessionStore
│   │   ├── services/           # websocket.service...
│   │   ├── controllers/        # session.controller...
│   │   ├── hooks/              # Global hooks
│   │   └── types/              # Type definitions
│   │
│   └── lib/                    # Utility libraries

├── server/                     # Backend code
└── shared/                     # Shared types
```

## Core Architecture Components

### 1. Application Layout Architecture

Layered layout design:

```
App (100vh flex column)
├── PageContainer (flex: 1)
│   ├── ChatPage
│   │   └── ChatLayout
│   │       ├── AppHeader (76px, two-row)
│   │       │   ├── Row 1: WorkingDir | Thinking | Status
│   │       │   └── Row 2: Search | Model
│   │       ├── SidebarPanel (280px overlay)
│   │       └── ChatPanel (flex: 1)
│   │           ├── MessageList
│   │           └── InputArea (with toolbar)
│   │
│   └── FilesPage
│       └── FilesLayout
│           ├── FileToolbar (76px, two-row)
│           ├── FileSidebar (280px overlay)
│           ├── FileBrowser (flex: 1)
│           └── FileBottomMenu (toolbar with navigation)
│
└── Footer (44px)
```

**Design Principles**:
- **App Level**: Only contains Footer (global controls) and PageContainer
- **Feature Level**: Each view independently manages its own Header, Sidebar, Content
- **Chat Sidebar**: Fixed position overlay, slide animation
- **Files Sidebar**: Fixed position overlay, async directory tree loading
- **LayoutContext**: Cross-component state sharing (sidebar visibility, bottom panel, etc.)

### 2. State Management Architecture

#### Frontend State (Zustand + Persist)

**Global Stores** (`src/client/shared/stores/`):

```typescript
// sessionStore.ts - Persisted to localStorage
{
  currentSessionId,  // Current session ID
  currentDir,        // Current working directory
  currentModel,      // Current model
  thinkingLevel,     // Thinking level
  theme,             // Theme
  recentWorkspaces,  // Recent workspaces
}

// chatStore.ts - Chat state
{
  messages,          // Message list
  isStreaming,       // Whether streaming output
  inputText,         // Input text
  activeMessageId,   // Currently active message
}

// fileStore.ts - File browser state
{
  currentPath,       // Current path
  items,             // File list
  viewMode,          // View mode (grid/list)
  selectedItems,     // Selected files
  isLoading,         // Loading state
}

// sidebarStore.ts - Sidebar state
{
  isVisible,         // Whether visible
  activeTab,         // Active tab
}

// modalStore.ts - Modal state
{
  activeModal,       // Currently active modal
  modalData,         // Modal data
}
```

**Feature Stores** (`src/client/features/*/stores/`):
Each feature domain can have its own independent local state management

#### Backend State (PiAgentSession)

```typescript
class PiAgentSession {
  session: AgentSession | null;  // pi-coding-agent session
  workingDir: string;             // Current working directory
  ws: WebSocket;                  // WebSocket connection
  
  initialize(workingDir, sessionId?)  // Initialize session
  dispose()                           // Cleanup resources, auto-save
}
```

### 3. Working Directory & Session Lifecycle

```
┌─────────────┐     WebSocket Connection      ┌──────────────┐
│   Frontend  │ ──────────────────────────>   │   Backend    │
│ Select Dir  │                             │ PiAgentSession│
└─────────────┘                             └──────┬───────┘
                                                   │
                                                   ▼
                                         ┌──────────────────┐
                                         │ 1. Terminate old pi process │
                                         │ 2. Start pi in new directory │
                                         │ 3. Load/Create session       │
                                         │ 4. Return new PID            │
                                         └──────────────────┘
```

**Relationship Description**:
- **Working Directory**: pi process working directory, file operations based on this directory
- **Session File**: Persisted session history (`.pi/sessions/`)
- **PID**: Dynamic process ID, different each time pi starts

## Path Aliases

```typescript
// Frontend
import { AppLayout } from '@/components/layout/AppLayout';
import { useSessionStore } from '@/stores/sessionStore';
import type { Message } from '@shared/types/message.types';

// Backend
import { PiAgentSession } from '@server/features/chat/agent-session/agentSession';
import type { ApiResponse } from '@shared/types/api.types';
```

## Development Standards

### Frontend Architecture Principles

```
UI = f(State)
```

- **Function Components + Hooks**: Comprehensive use of Function Component
- **Unidirectional Data Flow**: Data flows top-down, events bottom-up
- **Strict Layering**: View(UI) ← Logic(Hooks) ← State(Store) ← Service(API)
- **Immutability**: All state updates must return new objects

### Project Structure

```
src/client/
├── features/               # Feature domains (organized by business)
│   ├── core/               # Core application features
│   │   ├── layout/         # Global layout (AppLayout, AppHeader, AppFooter, panels)
│   │   ├── pages/          # Page components (ChatPage, FilesPage, LoadingScreen)
│   │   ├── providers/      # Global Providers
│   │   └── navigation/     # Navigation components
│   ├── chat/               # Chat feature (InputArea, MessageList, ChatPanel)
│   │   ├── components/     # UI components (pure rendering, no business logic)
│   │   ├── hooks/          # Business logic Hooks (split by function)
│   │   ├── stores/         # State management (Zustand)
│   │   ├── services/       # API services
│   │   └── types/          # Type definitions
│   ├── files/              # File feature (FileGrid, FileList, BatchActionBar)
│   ├── header/             # Top menu (ModelSelector, DirectoryPicker, SearchBox)
│   ├── sidebar/            # Sidebar (RecentWorkspaces, Sessions, Settings)
│   ├── footer/             # Bottom menu
│   ├── panels/             # Panels (TerminalPanel, LlmLogPanel)
│   └── system/             # System features (modals, search)
├── shared/                 # Shared resources
│   ├── components/         # Common components
│   │   ├── ui/             # Basic UI (Button, Input, IconButton, Select)
│   │   ├── layout/         # Layout containers
│   │   └── ErrorBoundary.tsx
│   ├── hooks/              # Common Hooks
│   ├── styles/             # Global styles
│   └── utils/              # Utility functions
├── stores/                 # Global state (Zustand)
│   ├── sessionStore.ts     # Session settings (persisted)
│   ├── chatStore.ts        # Chat state
│   ├── fileStore.ts        # File browser state
│   ├── sidebarStore.ts     # Sidebar state
│   ├── modalStore.ts       # Modal state
│   ├── searchStore.ts      # Search state
│   └── llmLogStore.ts      # LLM log state
├── services/               # API services
│   ├── api/                # REST API client
│   └── websocket.service.ts # WebSocket service
├── controllers/            # Controllers
├── hooks/                  # Global Hooks
└── types/                  # Global types
```

### Component Development

```typescript
// Layout components only responsible for layout, content passed via children
function AppLayout({ children, showInput }: AppLayoutProps) {
  return (
    <div className={styles.layout}>
      <header>...</header>
      <main>{children}</main>
      {showInput && <InputArea />}
    </div>
  );
}

// Content components only responsible for rendering, not layout
function MessageList({ messages }: MessageListProps) {
  return <div className={styles.list}>...</div>;
}
```

**Component Standards**:
- Single responsibility, components not exceeding 200 lines
- Props must define TypeScript interfaces
- Event naming uses `on + verb + noun` (e.g., `onToggleCollapse`)
- Use stable keys, prohibit using index

**Code Organization**:
For complex components with multiple states and effects, follow the structured order:
1. **State** - useState, Zustand selectors
2. **Ref** - useRef for DOM references
3. **Effects** - useEffect hooks
4. **Computed** - useMemo for derived values
5. **Actions** - useCallback for event handlers
6. **Render** - JSX return statement

Use section markers (`// ========== 1. State ==========`) for clarity. See [UI_REACT_COMPONENT_REFACTOR_GUIDE.md](./docs/UI_REACT_COMPONENT_REFACTOR_GUIDE.md) for detailed refactoring guidelines.

### State Management

| State Type | Tool | Use Case |
|------------|------|----------|
| Local state | useState | Form input, toggle state |
| Feature state | Zustand | Chat messages, file list |
| Global state | Zustand | User info, theme settings |

```typescript
// ✅ Correct: Use Selector to subscribe to partial state
const messages = useChatStore((s) => s.messages);
const isStreaming = useChatStore((s) => s.isStreaming);

// ❌ Wrong: Destructure to get entire store
const store = useChatStore();  // Causes unnecessary re-renders

// ✅ Correct: Call store action directly
const setCurrentDir = useSessionStore((s) => s.setCurrentDir);
setCurrentDir('/new/path');
```

### Hooks Standards

```typescript
// ✅ Must start with use
function useChat() { }
function useVirtualList() { }

// useEffect applicable scenarios
useEffect(() => {
  const subscription = websocketService.subscribe(callback);
  return () => subscription.unsubscribe();  // Must cleanup
}, []);

// ❌ Prohibited: Direct fetch in component
useEffect(() => {
  fetch('/api/data').then(...);  // Should be in services/
}, []);
```

### Performance Optimization

```typescript
// ✅ Large data lists use virtual scroll
import { FixedSizeList } from 'react-window';

// ✅ Use useMemo to cache calculations
const filteredMessages = useMemo(() => 
  messages.filter(m => m.visible),
  [messages]
);

// ✅ Use useCallback to cache callbacks
const handleToggle = useCallback((id: string) => {
  toggleMessage(id);
}, [toggleMessage]);
```

### Code Style

| Type | Standard | Example |
|------|----------|---------|
| Components | PascalCase | `MessageItem`, `ChatPage` |
| Hooks | camelCase + use | `useChat`, `useVirtualList` |
| Store | camelCase + Store | `chatStore`, `sessionStore` |
| Types | PascalCase | `Message`, `ChatState` |
| Interfaces | PascalCase + Props | `MessageItemProps` |

**Import Order**:
```typescript
// 1. React core
// 2. Third-party libraries
// 3. Internal shared (@/shared/*)
// 4. Within feature (../store/*)
// 5. Types
// 6. Styles
```

### Chat Feature Hooks Architecture

Chat feature adopts **Hook-Based Architecture**, completely separating business logic from UI components:

```
┌─────────────────────────────────────────────────────────────┐
│                     Components (UI Layer)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ChatPanel   │  │ InputArea   │  │ AppHeader           │  │
│  │ (Layout)    │  │ (Input UI)  │  │ (Top Menu)          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Hooks (Logic Layer)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │useChatPanel │  │useInputArea │  │useDirectoryPicker   │  │
│  │useChat      │  │useFilePicker│  │useModelSelector     │  │
│  │useChatInit  │  │useImageUpload│  │useThinkingSelector  │  │
│  │             │  │useSlashCmds │  │useSearchFilters     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Services (API Layer)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ chatApi.ts  │  │ sessionManager  │  │ websocket.service   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Hooks Classification

| Hook | Purpose | Corresponding Component |
|------|---------|------------------------|
| `useChatPanel` | Message scrolling, send coordination | ChatPanel |
| `useInputArea` | Input handling, send logic | InputArea |
| `useFilePicker` | @mention file selection | InputArea |
| `useImageUpload` | Image upload, OCR | InputArea |
| `useSlashCommands` | / command selection | InputArea |
| `useDirectoryPicker` | Directory browser | AppHeader |
| `useModelSelector` | Model selection | AppHeader |
| `useThinkingSelector` | Thinking level | AppHeader |
| `useSearchFilters` | Search filtering | AppHeader |
| `useChat` | Basic chat operations | Multiple components |
| `useChatInit` | Initialization logic | ChatPage |
| `useChatMessages` | Message filtering | MessageList |

#### File Feature Hooks

| Hook | Purpose | Corresponding Component |
|------|---------|------------------------|
| `useFileBrowser` | File browser main logic | FileBrowser |
| `useFileNavigation` | Navigate up, home, refresh | FileBottomMenu |
| `useFileFiltering` | Filter and sort files | FileToolbar |
| `useFileBottomMenu` | Bottom menu actions | FileBottomMenu |
| `useDragDrop` | Drag and drop file operations | FileBrowser |
| `useFileTree` | Directory tree loading | FileSidebar, TreeViewModal |

#### Development Standards

```typescript
// ✅ Correct: UI components only responsible for rendering, logic in Hook
function InputArea(props: InputAreaProps) {
  const inputArea = useInputArea(props);
  return (
    <div>
      <textarea onChange={inputArea.handleChange} />
      <button onClick={inputArea.handleSend}>Send</button>
    </div>
  );
}

// ✅ Correct: Hook handles all business logic
function useInputArea(options: UseInputAreaOptions) {
  const filePicker = useFilePicker(options);
  const imageUpload = useImageUpload();
  
  const handleSend = useCallback(() => {
    // Send logic...
  }, []);
  
  return { handleSend, filePicker, imageUpload };
}
```

### Common Mistakes

| Mistake | Correct Approach |
|---------|-----------------|
| `document.getElementById` | Use React ref |
| `Math.random()` as key | Use stable unique ID |
| Directly modify array/object | Return new object `[...arr]` |
| Create new function in render | Use useCallback |
| Component > 200 lines | Split component or extract Hook |
| Props drilling > 3 layers | Use Context or Store |
| Write business logic in component | Extract to Hook |

## Git Workflow

### Regular Commit Principle

**Don't wait for user instructions to commit**, but proactively commit based on feature completion:

| Scenario | Action |
|----------|--------|
| Complete an independent feature | Commit immediately |
| Fix a bug | Commit immediately |
| Refactor code | Commit immediately |
| Modify more than 5 files | Consider splitting commit |
| Tests pass | Commit immediately |

**Commit Format**:
```
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Example:
feat(chat): add message search
fix(files): fix sidebar duplication
refactor(core): optimize initialization
```

**Pre-commit Check**:
```bash
npm run build    # Ensure build succeeds
```

### Branch Management

- `main`: Main branch, keep deployable state
- `feature/*`: Feature branches
- `fix/*`: Fix branches

## Common Commands

```bash
# Development
npm run dev                       # Start development server
bash scripts/start-tmux-dev.sh    # Tmux mode

# Build & Check
npm run build                     # Production build
npm run check                     # Code check
npm run typecheck                 # TypeScript check

# Testing
npm test                          # All tests
npm run test:unit                 # Unit tests
npm run test:e2e                  # E2E tests

# Service Management
node scripts/tmux-controller.js status           # Service status
node scripts/tmux-controller.js restart-frontend # Restart frontend

# Debugging
tail -f logs/frontend_current.log  # Frontend logs
tail -f logs/backend_current.log   # Backend logs
```

## Testing Strategy

- **Unit Tests**: Components, stores, utility functions
- **Integration Tests**: API routes, WebSocket messages
- **E2E Tests**: Complete user flows (Playwright)

## WebSocket API

### Message Types

| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `init` | C→S | Initialize session, return complete session info |
| `prompt` | C→S | Send message to AI |
| `abort` | C→S | Abort generation |
| `change_dir` | C→S | Switch working directory |
| `new_session` | C→S | Create new session |
| `list_sessions` | C→S | List all sessions in working directory |
| `load_session` | C→S | Load specified session |
| `set_model` | C→S | Set model |
| `thinking_level_change` | C→S | Switch thinking level |
| `initialized` | S→C | init completion response |
| `dir_changed` | S→C | Directory switch completion |
| `session_loaded` | S→C | Session load completion |
| `sessions_list` | S→C | Session list |

### Example

```typescript
// Initialize Session
websocketService.send("init", {
  workingDir: "/root/project",
  sessionId: "optional-existing-session-id"
});

// Response
{
  type: "initialized",
  sessionId: "xxx",
  sessionFile: "/path/to/session.jsonl",
  workingDir: "/root/project",
  model: "claude-3-5-sonnet",
  thinkingLevel: "medium",
  systemPrompt: "...",
  agentsFiles: [...],
  skills: [...],
  pid: 12345
}
```

## Debugging Tips

1. **Frontend Hot Reload**: Vite auto-reloads, no manual refresh needed
2. **Backend Hot Reload**: tsx watch mode, auto-restarts
3. **WebSocket Debugging**: Check browser DevTools Network WS tab
4. **State Inspection**: Redux DevTools can view Zustand state
