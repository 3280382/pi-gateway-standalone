# Pi Gateway Standalone - AI Assistant Guide

> **This is the primary reference document for AI Coding Agents**. Read this first before starting any task.

## Project Identification

- **Name**: pi-gateway-standalone
- **Location**: /root/pi-gateway-standalone
- **GitHub**: https://github.com/3280382/pi-gateway-standalone
- **Type**: Web gateway for Pi Coding Agent (React + Node.js)

## First Message Rule

**If the user did not give a concrete task, ALWAYS read in parallel:**
1. `README.md` - Project overview and quick start
2. `DEVELOPMENT.md` - Development guide and architecture principles
3. `FEATURES.md` - Feature specification and UI guidelines

Then ask which specific feature to work on.

## Quick Decision Reference

### Pre-Modification Checklist
- [ ] Do I understand the affected feature domain (chat/files/shared)?
- [ ] Have I checked the corresponding store/service/component?
- [ ] Does it comply with import constraints (client/ cannot import @server/*)?
- [ ] Have I run `npm run check`?

### Common Tasks Quick Path

| Task Type | Key Location | Notes |
|-----------|--------------|-------|
| **Modify chat UI** | `src/client/features/chat/components/` | Check MessageList, InputArea, ChatPanel |
| **Modify sidebar** | `src/client/features/chat/components/sidebar/` | SidebarPanel, ModelParamsSection |
| **Modify header** | `src/client/features/chat/components/Header/` | AppHeader, DirectoryPicker |
| **Add WebSocket message** | `src/server/features/chat/ws-handlers/message/` | Follow existing handler pattern |
| **Modify state management** | `src/client/features/chat/stores/` | Use Zustand, check persist config |
| **Modify file browser** | `src/client/features/files/components/` | FileBrowser, FileGrid |

### Key Constraints (Non-Violable)

```
client/          → Cannot import @server/*
server/          → Cannot import @client/*  
shared/          → No runtime logic (types only)
```

### Code Commit Standards

```bash
# Must run before committing
npm run check  # Fix all errors and warnings

# Commit format
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Examples:
feat(chat): add message search
fix(files): fix sidebar duplication
refactor(core): optimize initialization
```

## Documentation Navigation

**Do NOT read these documents directly unless AGENTS.md guides you to:**

| Document | When to Read | Content Summary |
|----------|--------------|-----------------|
| [`README.md`](./README.md) | First Message Rule or need project overview | Quick start, project structure |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Need development standards, architecture details | Development guide, API reference |
| [`FEATURES.md`](./FEATURES.md) | Need UI specs, feature definitions | Feature specification, user flows |
| [`CHANGELOG.md`](./CHANGELOG.md) | Need version history | Version changes |

## Project Structure Quick Reference (High Level)

```
src/
├── client/features/     # Frontend feature domains
│   ├── chat/           # Chat feature (components/, stores/, services/)
│   └── files/          # File feature (components/, stores/, services/)
├── server/features/    # Backend feature domains
│   └── chat/           # agent-session/, ws-handlers/, controllers/
└── shared/             # Shared types (type definitions only)
```

**For detailed structure, see README.md and DEVELOPMENT.md**

## Development Environment

```bash
# Recommended: Tmux 3-pane mode
bash scripts/start-tmux-dev.sh

# Or traditional way
npm run dev        # Backend
npm run dev:react  # Frontend (another terminal)

# Check code
npm run check
```

## Debugging Tips

1. **Frontend Hot Reload**: Vite auto-reloads
2. **Backend Hot Reload**: tsx watch auto-restarts
3. **WebSocket Debugging**: Browser DevTools Network WS tab
4. **View Logs**: `tail -f logs/backend_current.log`

## Prohibited Practices

- ❌ Direct fetch in components (use services/)
- ❌ Use Math.random() as key
- ❌ Directly modify arrays/objects (return new objects)
- ❌ Write business logic in components (extract to Hook)
- ❌ Put runtime logic in shared/

## Need Help?

If the answer is not in the documentation:
1. Check existing code for similar functionality
2. Check stores/ for relevant state
3. Check services/ for relevant APIs
4. Ask user to confirm requirements
