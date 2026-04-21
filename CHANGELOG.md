# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **UI Style Unification**: Unified Chat and File component styles
  - Two-row header layout (76px total: 38px per row) for both Chat and File views
  - Chat AppHeader: Row 1 (Working Directory + Thinking Level + Status), Row 2 (Search + Model)
  - FileToolbar: Matching two-row layout with path bar, filter/sort, view toggle
  - Unified button styles: 28x28px with 15x15px icons, consistent border-radius (6px)
  - Unified border colors: rgba(48, 54, 61, 0.5) across all components
  - Moved System Prompt button from AppHeader to InputArea toolbar
  - Filter badge now integrated inside search input (right-aligned)
- **FileBottomMenu Enhancement**: New navigation and view controls
  - Navigation buttons: Home, Refresh, Up (cyan theme)
  - View toggle: Grid/List switch (purple-gray theme)
  - New file button: Create files (emerald theme)
  - Tree view button: Fullscreen directory tree (amber theme)
  - Delete button: Delete selected files (rose theme)
- **Client Chat Feature Hooks Architecture**: Complete refactor of chat feature with hook-based architecture
  - New hooks: `useChatPanel`, `useInputArea`, `useFilePicker`, `useImageUpload`, `useSlashCommands`
  - New hooks: `useDirectoryPicker`, `useModelSelector`, `useThinkingSelector`, `useSearchFilters`
  - Extracted `DirectoryPicker` component from AppHeader
  - Reduced component complexity: InputArea (-49% lines), ChatPanel (-57% lines)
  - Business logic completely separated from UI components
- **Unified AppLayout System**: Centralized layout component with consistent structure
  - Header (64px): TopBar with model selector, thinking level, working directory, search
  - Sidebar (280px): Recent workspaces, sessions, settings with collapsible design
  - Content area: MessageList (chat) or FileBrowser (files)
  - Footer (44px): BottomMenu with view switcher and sidebar toggle
  - BottomPanel: Overlay panel for terminal/preview with resizable height
- **State Persistence**: 
  - Frontend: localStorage stores currentDir, currentSessionId, currentModel, thinkingLevel
  - Backend: Session files automatically saved on WebSocket disconnect
- **Working Directory & Session Management**:
  - Directory picker for selecting working directory
  - Session lifecycle: init → change_dir → dispose → reinit with new dir
  - PID tracking for pi process management
- **Dual View Mode**: Chat view (with input) and Files view (without input)
- **Layout Context**: React Context for managing sidebar, bottom panel, and view state

### Changed
- Refactored App.tsx to use unified AppLayout
- Updated TopBar with two-row layout (Row 1: controls, Row 2: working dir + search)
- Moved InputArea to Content area (only visible in Chat view)
- Fixed icon sizes (added explicit width/height to all SVG icons)
- Updated state management to use LayoutContext for view switching

### Fixed
- Fixed TopBar picker overlay styles (added missing CSS)
- Fixed MessageList and InputArea visibility issues
- Fixed sidebar visibility in FileBrowser view
- Fixed view switching between Chat and Files

## [0.57.1] - 2025-03-28

### Added
- Initial gateway implementation with web UI
- WebSocket-based real-time communication
- Directory browser with visual file navigation
- Model selection interface
- Thinking level adjustment (Off to Extra High)
- Session management and history
- Tool execution visualization
- Dark theme with modern design
- Responsive layout for desktop and mobile

### Added
- Comprehensive test suite (82 tests)
  - Server tests for API and WebSocket (14 tests)
  - REST API endpoint tests (19 tests)
  - WebSocket integration tests (8 tests)
  - Headless browser WebUI tests (41 tests)
- Security: Disabled x-powered-by header
- Thinking content display with collapsible blocks
- Tool call details with arguments and results
- Prompt input chat box tests (12 new tests):
  - Input visibility and display tests
  - Text input simulation (short, long, special chars, unicode)
  - Send button functionality
  - Input hints display
  - Focus management
  - Rapid input handling
  - Input positioned at bottom verification tests
- Font size selector in Settings sidebar section with labeled buttons (tiny, small, medium)
- Three font size presets: Tiny (default), Small, Medium
- Message collapse/expand toggle button (−/+) in message headers
- MutationObserver for automatic scroll-to-bottom on new content

### Changed
- UI is now more compact:
  - Reduced font sizes: Tiny (default): base 11px, sm 10px, xs 9px
  - Three font size options: Tiny, Small, Medium (saved to localStorage)
  - Reduced padding and margins throughout
  - Smaller buttons and icons (22px)
  - Compact sidebar (220px width)
  - Tighter spacing between elements
- Message boxes now use 100% width with word-break
- Fixed scroll to bottom issue - added html/body height: 100% and proper flex constraints
- Chat container now properly constrained and scrollable (height: 0 with flex: 1)
- All message boxes now have collapse/expand functionality
- Fixed tool call message font size to use CSS variables (was hardcoded 11px)
- Fixed empty assistant message issue - empty messages are now removed
- All font sizes now use CSS variables consistently (no hardcoded px values)
- Default font size (Tiny): base 11px, sm 10px, xs 9px
- Reformatted tool call messages with terminal-style display:
  - Shows `$ command args` format like terminal input
  - Command line with prompt ($) and status indicator
  - Output displayed like terminal output in monospace font
  - Fixed collapse/expand overflow with min-width constraints
  - Proper text wrapping and overflow handling for long commands
- Tool result JSON parsing:
  - Extracts text from `content[].text` when `type === "text"`
  - Converts `\n` escape sequences to real newlines
  - Falls back to pretty-printed JSON for complex objects
- Session loading from JSONL files:
  - Auto-loads most recent session from `.pi/agent/sessions/{cwd}/` on page load
  - Parses JSONL format with session metadata, model changes, and messages
  - Renders user messages, assistant messages with thinking blocks
  - Displays tool calls and tool results from session history
  - New API endpoint `/api/session/load` to fetch session file content
  - Tested: Successfully loads and renders 15+ messages from session files
  - Fixed: Clicking session in sidebar now properly loads and displays session
  - Extracts conversation context for LLM when switching sessions
  - Enhanced message formatting with syntax highlighting for code blocks
  - Supports JSON, Python, JavaScript/TypeScript, HTML, Bash, CSS highlighting
  - Human-readable markdown formatting (headers, lists, links, blockquotes)
- Fixed tool call display when loading from session files:
  - Commands now display on multiple lines for better readability
  - Long commands wrap at 80 characters with proper indentation
  - Tool output formatted with markdown for human-readable display
  - Syntax highlighting applied to tool results (JSON, code, etc.)
  - Fixed CSS selector escaping for tool IDs containing special characters (like `bash:0`)
  - Tool calls now properly render from session files (was failing due to invalid selector)
  - Tool results now display as human-readable text instead of raw JSON (handles content arrays from session files)
- Added markdown table support with beautiful styling:
  - Tables render with clean borders and rounded corners
  - Header row has distinct background color
  - Zebra striping on hover for better readability
  - Proper padding and alignment for all cells
  - Responsive design that fits within message width
- UI redesign: cleaner, less boxy appearance
  - Removed full borders from messages, replaced with left accent lines
  - Removed borders from tool executions and thinking blocks
  - Increased content width usage with better padding
  - More whitespace between messages for better readability
  - Hover effects on accent lines for interactive feedback
- Fixed top bar layout issues:
  - Model name now truncates with ellipsis instead of wrapping to multiple lines
  - Working directory display now left-aligned instead of center
  - Fixed model selector modal not showing any models (now renders model list from API)
- Added light/dark mode toggle in settings sidebar
  - Uses CSS variables for all colors (--bg-*, --text-*, --accent-*)
  - Theme preference saved to localStorage
  - Smooth transition between themes
- Added fullscreen message feature
  - Double-click on a long/scrollable message to open in fullscreen
  - Double-click again (or click X) to close
  - Useful for reading long code blocks or tool outputs
- Unified rendering system: Both real-time streaming and session loading now use the same rendering functions:
  - `createUserMessage()` - unified user message creation
  - `createAssistantMessage()` - unified assistant message creation
  - `addThinkingToMessage()` - unified thinking block rendering
  - `addTextToMessage()` - unified text content rendering with append mode for sessions
  - `addToolToMessage()` - unified tool execution rendering
  - `updateToolInElement()` - unified tool output updates
  - Consistent formatting for both real-time and loaded sessions
- Fixed session loading to display all messages (not just first one)
- Fixed text accumulation for assistant messages with multiple content items
- Tool calls now properly linked with tool results via toolCallId matching
- Added working directory display in top bar with folder icon
- Fixed directory change functionality:
  - Now properly loads sessions for new directory via REST API
  - Updates session list in sidebar immediately
  - Displays most recent session from new directory
  - Working directory display updates correctly
  - Fixed session disposal when reinitializing with new working directory
  - Prevents memory leaks by properly disposing old session before creating new one
  - Fixed: `state.selectedDir` now properly set when navigating directories
  - Session count changes from 64 to 11 when switching from /root to /

### Fixed
- Race conditions in WebSocket message handling
- Server startup timeout issues
- Mobile sidebar toggle test - now uses JavaScript evaluation for reliability
- Performance test thresholds adjusted for CI environments
- Tool execution now shows arguments and results properly
- Mobile viewport height bug: Changed from 100vh to 100dvh with fallbacks
- Input container now fixed at bottom using position: fixed
- Chat container padding prevents content from being hidden behind input

## [0.57.0] - 2025-03-19

- Initial release
