# Feature Specification

> **AI Assistants**: This is a supplementary document. Read [`AGENTS.md`](./AGENTS.md) first.

## Product Overview

Pi Gateway is a web gateway for Pi Coding Agent, providing developers with an AI chat interface and file management functionality.

## Layout Architecture

### Unified Layout System

All views share a unified layout framework:

```
┌─────────────────────────────────────────────┐
│ Header                                      │
│ ├─ Row 1: Working Directory | Status       │
│ └─ Row 2: Search Box                        │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │  Content Area                    │
│ (280px)  │  ├─ MessageList / FileBrowser   │
│          │  └─ InputArea (Chat only)       │
├──────────┴──────────────────────────────────┤
│ Footer (View Switcher)                      │
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
| **Tool Calls** | Display tool execution |
| **Input Toolbar** | System Prompt, @ File, / Command, ! Shell, Image upload |

### 2. File Browser Feature

| Feature | Description |
|---------|-------------|
| **Directory Browsing** | Navigate directories with parent (..) entry |
| **View Modes** | Grid/List toggle |
| **Batch Operations** | Multi-select files |
| **File Preview** | Text file preview with syntax highlighting |
| **Multi-Session Terminal** | WebSocket-based terminal with node-pty support |

#### Terminal Feature Details

- **Technology**: xterm.js + node-pty for full TTY support
- **WebSocket Path**: `/ws/terminal` (separate from chat WebSocket)
- **Multi-Session**: Single WebSocket connection manages multiple terminal sessions
- **PTY Support**: Full TTY support for interactive programs (vim, top, pi, etc.)
- **Features**:
  - Tab-based session switching
  - Streaming output display
  - Terminal resize (cols/rows)
  - Session persistence during navigation
  - Input focus pushes interface up (like Chat InputArea)

### 3. Sidebar

| Feature | Description |
|---------|-------------|
| **Workspaces** | Recent working directories |
| **Sessions** | Session list for current directory |
| **Model Settings** | Model selection and parameters |
| **Chat Settings** | LLM Log, theme settings |

## State Persistence

### Frontend (localStorage)

- `currentDir`: Current working directory
- `currentSessionId`: Current session ID
- `currentModel`: Selected model
- `thinkingLevel`: Thinking level

### Backend (Session File)

- Session history stored in `.pi/sessions/`
- Auto-save on WebSocket disconnect

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Desktop | > 768px | Full layout with sidebar |
| Tablet | 768px | Sidebar auto-hides |
| Mobile | < 768px | Drawer sidebar, simplified header |

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

## UI/UX Guidelines

### Color Scheme

- **Primary**: `#58a6ff` (Blue)
- **Success**: `#238636` (Green)
- **Warning**: `#d29922` (Yellow)
- **Error**: `#f85149` (Red)
- **Background**: `#0d1117` (Dark)

### Spacing

- Header: 76px (2 rows)
- Sidebar: 280px
- Footer: 44px
- Standard padding: 12px-16px
