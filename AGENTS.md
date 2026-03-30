# Pi Gateway Standalone - Development Rules

## 🎯 PROJECT IDENTIFICATION

**Current Project**: pi-gateway-standalone  
**Location**: /root/pi-gateway-standalone

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
├── server/    # Express backend (Node.js)
└── shared/    # Shared types and constants
```

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
# │   AI/pi (bottom)  │  ← Bottom 66%
# └───────────────────┘
```

### Key Commands

#### Complete Workflow Commands
```bash
# Full code modification workflow (recommended)
bash scripts/complete-workflow.sh all

# Or step by step:
npm run build                    # 1. Compile and build
npm run check                    # 2. Lint and type check
npm test                         # 3. Run tests
node scripts/tmux-controller.js status  # 4. Check service status
```

#### Service Management
```bash
# Check status
bash scripts/dev-status.sh
node scripts/tmux-controller.js status

# Restart services (use cautiously - only when needed)
node scripts/tmux-controller.js restart-frontend
node scripts/tmux-controller.js restart-backend

# Clear cache
node scripts/tmux-controller.js clear-cache
```

**Hot Reload**: Frontend (Vite) and backend (tsx) are running in hot-reload mode.
- Code changes are automatically compiled and reloaded
- **Do NOT restart services after every change** - wait for hot reload
- Only restart if:
  - Changes are not reflected after compilation (cache issues)
  - Service crashes or becomes unresponsive
  - WebSocket connections fail to establish

#### Code Quality
```bash
# Code check
npm run check                    # Biome + TypeScript
npm run typecheck               # TypeScript only
npm run build                   # Build verification
```

#### Testing
```bash
# Run tests
npm test                        # Unit + Integration tests
npm run test:unit               # Unit tests only
npm run test:integration        # Integration tests only
npm run test:e2e                # E2E tests
```

#### Service Verification
```bash
# Check logs
tail -20 /root/pi-gateway-standalone/logs/frontend_current.log
tail -20 /root/pi-gateway-standalone/logs/backend_current.log

# Verify endpoints (with timeout)
timeout 5 curl -s http://127.0.0.1:5173 > /dev/null && echo "Frontend OK"
timeout 5 curl -s http://127.0.0.1:3000/health > /dev/null && echo "Backend OK"
```

### 🚨 IMPORTANT: Development Workflow Rules

1. **Use tmux services for development**: When frontend/backend are running in tmux panes, use them for compilation and testing
2. **Do not start independent processes**: Never start separate vite/tsx processes outside tmux
3. **Observe, don't interfere**: Watch the tmux panes for logs; don't kill services unless explicitly asked
4. **Wait for completion**: Allow compilation to finish before checking results
5. **Check logs after**: View log files only after operations complete
6. **ALWAYS use timeout for bash commands**: All bash commands must have timeout to prevent hanging
   ```bash
   # Good - with timeout
   timeout 30 npm run build
   timeout 10 curl -s http://127.0.0.1:5173/
   
   # Avoid - without timeout (may hang forever)
   npm run build
   curl -s http://127.0.0.1:5173/
   ```

### ✅ COMPLETE CODE MODIFICATION WORKFLOW

After making code changes, follow this **complete workflow** in order:

#### Step 1: Compile and Build
```bash
# First, ensure code compiles without errors
npm run build
```

#### Step 2: Lint and Type Check
```bash
# Fix all linting issues and type errors
npm run check  # Biome + TypeScript
npm run typecheck  # TypeScript only
```

**Requirements**:
- No linting warnings or errors
- No TypeScript errors (warnings should be minimized)
- Code follows project style guidelines

#### Step 3: Run Tests
```bash
# Run all tests and ensure they pass
npm test  # Unit + Integration tests
```

**Requirements**:
- All tests must pass
- No flaky or skipped tests (unless explicitly documented)
- Test coverage should not decrease significantly

#### Step 4: Verify with Running Services
```bash
# Check service status
node scripts/tmux-controller.js status

# Check service logs (hot reload will show compilation)
tail -20 /root/pi-gateway-standalone/logs/frontend_current.log
tail -20 /root/pi-gateway-standalone/logs/backend_current.log

# Only restart if hot reload is not working (cache issues)
# node scripts/tmux-controller.js restart-frontend
# node scripts/tmux-controller.js restart-backend
```

**Requirements**:
- Frontend service running on http://127.0.0.1:5173
- Backend service running on http://127.0.0.1:3000
- No startup errors in logs
- WebSocket connection established (if applicable)
- **Note**: Services use hot reload, wait for compilation instead of restarting

#### Step 5: Confirm Frontend/Backend Locations
```bash
# Verify service endpoints (with timeout)
timeout 5 curl -s http://127.0.0.1:5173 > /dev/null && echo "Frontend OK"
timeout 5 curl -s http://127.0.0.1:3000/health > /dev/null && echo "Backend OK"
```

**Requirements**:
- Frontend accessible at http://127.0.0.1:5173
- Backend accessible at http://127.0.0.1:3000
- API endpoints responding correctly
- WebSocket server accepting connections

#### Step 6: Final Verification
```bash
# Run comprehensive check (with timeouts)
timeout 30 npm run check
timeout 120 npm test
timeout 10 node scripts/tmux-controller.js status
```

**Only after all steps pass** can the modification be considered complete.

### Log Files

#### Current Logs (Check these first)
- **Frontend**: `/root/pi-gateway-standalone/logs/frontend_current.log`
- **Backend**: `/root/pi-gateway-standalone/logs/backend_current.log`

#### How to Check Logs
```bash
# Quick check of current logs
tail -20 /root/pi-gateway-standalone/logs/frontend_current.log
tail -20 /root/pi-gateway-standalone/logs/backend_current.log

# See all logs
ls -la /root/pi-gateway-standalone/logs/
```

#### Command Timeout Guidelines
All bash commands **MUST** include timeout to prevent hanging:
```bash
# Build/compile - 60-120s timeout
timeout 60 npm run build
timeout 30 npm run check

# Service operations - 30s timeout
timeout 30 node scripts/tmux-controller.js restart-frontend

# HTTP requests - 5-10s timeout
timeout 5 curl -s http://127.0.0.1:5173/
timeout 5 curl -s http://127.0.0.1:3000/health

# File operations - 10s timeout
timeout 10 tail -50 /path/to/log

# Long operations - 120-300s timeout
timeout 120 npm test
```

#### Log File Rules
1. **Always use `*_current.log`** for latest logs
2. **Old logs are archived** with timestamps
3. **Wait for compilation** before checking logs
4. **Logs are in project directory**: `/root/pi-gateway-standalone/logs/`

## Code Quality Rules

### TypeScript
- Strict mode enabled
- No `any` types unless absolutely necessary
- Use path aliases: `@/*`, `@shared/*`, `@server/*`
- Never use inline imports (no `await import()` for types)

### Boundaries
- `client/` cannot import `@server/*`
- `server/` cannot import `@client/*`
- `shared/` only types/constants, no runtime logic

### Before Committing
```bash
timeout 30 npm run check  # Fix all errors, warnings, infos
```

## Testing

```bash
timeout 120 npm test                 # Unit + Integration tests
timeout 60 npm run test:unit        # Unit tests only
timeout 120 npm run test:integration # Integration tests only
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

### Git Commits

- **Commit when needed**: If you believe changes should be committed (significant progress, logical checkpoint, or before switching tasks), ask the user for confirmation
- **Don't commit blindly**: Small or temporary changes don't need immediate commits
- **Let the user decide**: If user explicitly says "commit" or "don't commit", follow their instruction

## Dependencies

This project depends on published npm packages:
- `@mariozechner/pi-ai`
- `@mariozechner/pi-agent-core`
- `@mariozechner/pi-coding-agent`

To link local monorepo versions for debugging:
```bash
cd /path/to/pi-mono/packages/coding-agent && npm link
cd ~/pi-gateway-standalone && npm link @mariozechner/pi-coding-agent
```

## Documentation (Read Before Starting)

**MUST READ** (in this order):
1. `README.md` - Project overview, architecture, quick start commands
2. `DEVELOPMENT.md` - Detailed development workflow, tmux setup, testing strategy
3. `FEATURES.md` - Complete feature list, UI layout, operation flows

**Reference**:
- `STANDALONE.md` - Notes specific to standalone version
- `SYSTEM.md` - System prompt and common tasks
