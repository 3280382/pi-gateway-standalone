# Feature Specification

## Product Overview

Pi Gateway is a web gateway for Pi Coding Agent, providing developers with an AI chat interface and file management functionality.

## Layout Architecture

### Unified Layout System

All views share a unified layout framework:

```
┌─────────────────────────────────────────────┐
│ Header (76px)                               │
│ ├─ Row 1: Working Directory | Status       │
│ └─ Row 2: Search Box                        │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │  Content Area                    │
│ (280px)  │  ├─ MessageList / FileBrowser   │
│          │  └─ InputArea (Chat only)       │
├──────────┴──────────────────────────────────┤
│ Footer (44px)                               │
│ └─ View Switcher (Chat | Files)            │
└─────────────────────────────────────────────┘
```

## Core Features

### 1. Chat Feature

| Feature | Description |
|---------|-------------|
| **Message Display** | User (gray) / AI (white) messages |
| **Streaming** | Typewriter effect for AI responses |
| **Code Highlighting** | Syntax highlighting for code blocks |
| **Thinking Blocks** | Collapsible reasoning sections |
| **Tool Calls** | Display tool execution with terminal-style formatting |
| **Input Toolbar** | System Prompt, @ File, / Command, ! Shell, Image upload |
| **Message Collapse** | Collapse/expand toggle (−/+) in message headers |
| **Fullscreen Mode** | Double-click long messages for fullscreen view |

### 2. File Browser Feature

| Feature | Description |
|---------|-------------|
| **Directory Browsing** | Navigate directories with parent (..) entry |
| **View Modes** | Grid/List toggle |
| **Batch Operations** | Multi-select files |
| **File Preview** | Text file preview with syntax highlighting |
| **File Operations** | Create, delete files |
| **Navigation** | Home, Refresh, Up buttons |

#### Terminal Feature

- **Technology**: xterm.js + node-pty for full TTY support
- **WebSocket Path**: `/ws/terminal` (separate from chat WebSocket)
- **Multi-Session**: Tab-based session switching
- **PTY Support**: Full TTY support for interactive programs (vim, top, pi, etc.)

### 3. Sidebar

| Feature | Description |
|---------|-------------|
| **Workspaces** | Recent working directories |
| **Sessions** | Session list for current directory |
| **Model Settings** | Model selection and parameters |
| **Chat Settings** | Font size, theme (light/dark), LLM Log |

#### Font Size Options

| Size | Base | Small | Extra Small |
|------|------|-------|-------------|
| Tiny | 11px | 10px | 9px |
| Small | 13px | 12px | 11px |
| Medium | 15px | 14px | 13px |

### 4. State Persistence

| Location | Data | Storage |
|----------|------|---------|
| Frontend | currentDir, currentSessionId, currentModel, thinkingLevel | localStorage |
| Backend | Session history | `.pi/sessions/` (auto-save on disconnect) |

## User Workflows

### Initialization Flow

1. Frontend loads → Restore from localStorage
2. WebSocket connects → Send `init` message
3. Backend starts pi process → Return session info
4. Load session history → Display interface

### Directory Switching Flow

1. User opens directory picker
2. Select new directory
3. Send `change_dir` message
4. Backend restarts pi process
5. Load new session

### Session Switching Flow

1. User clicks session in sidebar
2. Frontend loads session via REST API `/api/session/load`
3. Parse JSONL format with metadata and messages
4. Render all message types (user, assistant, tool calls)

## UI/UX Guidelines

### Color Scheme (Dark Theme)

| Purpose | Color | Hex |
|---------|-------|-----|
| Primary | Blue | `#58a6ff` |
| Success | Green | `#238636` |
| Warning | Yellow | `#d29922` |
| Error | Red | `#f85149` |
| Background | Dark | `#0d1117` |
| Surface | Gray | `#161b22` |
| Border | Subtle | `rgba(48, 54, 61, 0.5)` |

### Spacing

| Element | Size |
|---------|------|
| Header | 76px (38px × 2 rows) |
| Sidebar | 280px |
| Footer | 44px |
| Standard padding | 12px–16px |
| Icon buttons | 28×28px |
| Icons | 15×15px |

### Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Desktop | > 768px | Full layout with sidebar |
| Tablet | 768px | Sidebar auto-hides |
| Mobile | < 768px | Drawer sidebar, simplified header |

### Button Styles

- **Size**: 28×28px with 15×15px icons
- **Border Radius**: 6px
- **Border**: 1px solid `rgba(48, 54, 61, 0.5)`

### Bottom Menu Button Themes

| Button | Color Theme |
|--------|-------------|
| Home/Refresh/Up | Cyan |
| Grid/List toggle | Purple-gray |
| New File | Emerald |
| Tree View | Amber |
| Delete | Rose |
