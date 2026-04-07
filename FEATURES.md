# Pi Gateway Feature Specification

> **Product Positioning**: Web gateway for Pi Coding Agent, providing developers with a beautiful AI chat interface and file management functionality.
> 
> **Core Value**: Enable natural conversation with AI assistants in the browser while managing the local file system.

---

## 1. Interface Architecture

### 1.1 Unified Layout System (AppLayout)

All views share a unified layout framework:

```
┌─────────────────────────────────────────────────────────────┐
│ Header (64px) - TopBar                                      │
│ ├─ Row1: [System Prompt] [Model Select ▼] [Thinking ▼] [Status ● PID]  │
│ └─ Row2: [📁 Working Dir]          [🔍 Search Box]                │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ Sidebar  │  Content (Main Content Area)                              │
│ (Collapsible) │  ├─ contentBody                                  │
│ 280px    │  │   • Chat: MessageList (Message List)              │
│          │  │   • Files: FileBrowser (File Browser)           │
│ Recent Workspaces│  │                                               │
│ Session List  │  └─ inputArea (Input Box, Chat view only)        │
│ Settings      │                                                  │
├──────────┴──────────────────────────────────────────────────┤
│ Footer (44px) - BottomMenu                                  │
│ [← Sidebar] [💬 Chat] [📁 Files] [↑ Bottom Panel]               │
├─────────────────────────────────────────────────────────────┤
│ BottomPanel (Pop-up, overlay)                               │
│ ├─ Drag to resize height                                            │
│ ├─ Terminal output (File execution results)                                  │
│ └─ Preview content                                                │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Area Responsibilities

| Area | Responsibility | Height/Width | Desktop | Mobile |
|------|---------------|--------------|---------|--------|
| **Header** | Model selection, Thinking level, Working directory, Search | 64px | Fixed top | Fixed top (56px) |
| **Sidebar** | Recent workspaces, Session list, Settings | 280px | Left collapsible | Drawer overlay |
| **Content** | Main content (Message list/File browser) | flex:1 | Right main area | Full width |
| **InputArea** | Chat input box | auto | Bottom of Content | Bottom of Content |
| **Footer** | View switcher, Sidebar control | 44px | Fixed bottom | Fixed bottom |
| **BottomPanel** | Terminal/Preview | Variable | Pops up from above Footer | Pops up from above Footer |

---

## 2. Core Features

### 2.1 TopBar (Top Menu)

#### Row 1 - Main Controls
| Feature | Description | Status |
|---------|-------------|--------|
| System Prompt Button | Display AGENTS.md and SYSTEM prompts | ✅ |
| Model Selector | Select AI model (deepseek-chat, etc.) | ✅ |
| Thinking Level | None/Low/Med/High/XHigh | ✅ |
| Connection Status | Green dot + PID display | ✅ |

#### Row 2 - Working Directory and Search
| Feature | Description | Status |
|---------|-------------|--------|
| Working Directory Button | Click to open directory picker | ✅ |
| Search Box | Search history messages, supports filters | ✅ |

---

### 2.2 Sidebar (Side Panel)

| Feature | Description | Status |
|---------|-------------|--------|
| **Pi Gateway** | Logo and title | ✅ |
| **Recent Workspaces** | Recent working directory list, quick switch | ✅ |
| **Sessions** | Session list under current directory, click to load | ✅ |
| **Settings** | Settings group | ✅ |
| **Theme** | Dark/Light theme toggle | ✅ |
| **Font** | Font size selection | ✅ |
| **LLM Log** | LLM log toggle | ✅ |
| **Refresh** | Refresh interval setting | ✅ |

---

### 2.3 Chat View

#### MessageList (Message List)
| Feature | Description | Status |
|---------|-------------|--------|
| Message Display | User messages (gray) / AI messages (white) | ✅ |
| Streaming Output | Typewriter effect, character by character display | ✅ |
| Code Highlighting | Syntax highlighting for multiple languages | ✅ |
| Thinking Blocks | Yellow background, collapsible | ✅ |
| Tool Calls | Blue background, displays tool name and parameters | ✅ |
| Message Actions | Copy, delete, regenerate | ✅ |
| Message Collapse | Long press/click to collapse long messages | ✅ |

#### InputArea (Input Box)
| Feature | Description | Status |
|---------|-------------|--------|
| Multi-line Input | Supports multi-line text, auto-growing | ✅ |
| @ File Reference | Click @ button or type @ to trigger file picker | ✅ |
| / Slash Command | Click / button or type / to trigger command menu | ✅ |
| Send Button | Paper plane icon, sends message | ✅ |
| Stop Button | Can stop during streaming output | ✅ |
| New Session Button | Create new session | ✅ |

---

### 2.4 Files View

#### FileBrowser (File Browser)
| Feature | Description | Status |
|---------|-------------|--------|
| Directory Browsing | Click directory to enter, display parent directory (..) | ✅ |
| Real-time Loading | Get latest data from server each time (no caching) | ✅ |
| File Grid | Grid/List view toggle | ✅ |
| Batch Operations | Multi-select files for batch operations | ✅ |
| File Preview | Text file preview, code highlighting | ✅ |
| File Edit | Built-in editor, supports saving | ✅ |
| File Execute | Execute scripts in terminal | ✅ |

---

### 2.5 State Persistence

#### Frontend Persistence (localStorage)
| State Item | Description |
|------------|-------------|
| currentDir | Current working directory |
| currentSessionId | Current session ID |
| currentModel | Currently selected model |
| thinkingLevel | Thinking level |
| theme | Theme settings |
| recentWorkspaces | Recent workspaces list |

#### Backend Persistence (Session File)
| State Item | Description |
|------------|-------------|
| Session History | JSONL files under `.pi/sessions/` |
| Message Records | Contains all messages and metadata |
| Auto-save | Automatically saved on WebSocket disconnect |

---

## 3. Workflows

### 3.1 Initialization Flow

```
1. Frontend loads
   ├─ Restore currentDir, currentSessionId from localStorage
   ├─ Display loading state
   └─ Connect WebSocket

2. WebSocket connection successful
   ├─ Send init message (workingDir, sessionId)
   ├─ Backend starts pi process
   ├─ Load or create session file
   └─ Return sessionId, pid, model, thinkingLevel

3. Frontend initialization complete
   ├─ Save state to store
   ├─ Load session history messages
   └─ Display main interface
```

### 3.2 Switching Working Directory

```
1. User clicks working directory button
2. Open directory picker (DirectoryPicker)
3. Select new directory
4. Send change_dir message to backend
5. Backend disposes current session
6. Start new pi process in new directory
7. Return new sessionId and pid
8. Frontend updates state, loads new session
```

### 3.3 View Switching

```
Chat View → Files View:
├─ Hide InputArea
├─ Display FileBrowser
└─ Bottom panel displays file execution terminal

Files View → Chat View:
├─ Display InputArea
├─ Display MessageList
└─ Bottom panel displays normal terminal
```

---

## 4. Technical Implementation

### 4.1 Layout Implementation

```typescript
// AppLayout.tsx - Unified layout
<div className={styles.layout}>
  <header className={styles.header}><TopBar /></header>
  <div className={styles.body}>
    <aside className={styles.sidebar}><SidebarPanel /></aside>
    <main className={styles.content}>
      <div className={styles.contentBody}>{children}</div>
      {showInput && <div className={styles.inputArea}><InputArea /></div>}
    </main>
  </div>
  <footer className={styles.footer}><BottomMenu /></footer>
  {isBottomPanelOpen && <div className={styles.bottomPanel}>...</div>}
</div>
```

### 4.2 State Management

```typescript
// LayoutContext - Layout state
{
  currentView: 'chat' | 'files',
  isSidebarVisible: boolean,
  isBottomPanelOpen: boolean,
  bottomPanelHeight: number,
}

// sessionStore (persisted) - User settings
{
  currentDir: string,
  currentSessionId: string | null,
  currentModel: string,
  thinkingLevel: ThinkingLevel,
}
```

---

## 5. Responsive Adaptation

### Breakpoints
- **Desktop**: > 768px - Full layout
- **Tablet**: 768px - Sidebar auto-hides
- **Mobile**: < 768px - Drawer sidebar, simplified top menu

### Mobile Adaptation
- Top menu height reduced from 64px to 56px
- Sidebar becomes drawer style, slides out from left
- Bottom menu always visible
- Touch optimization: Larger click areas
