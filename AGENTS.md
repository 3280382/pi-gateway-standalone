# Pi Gateway Standalone - AI Assistant Guide

> **This is the primary reference document for AI Coding Agents**. Read this first before starting any task.

## Project Identification

- **Name**: pi-gateway-standalone
- **Location**: /root/pi-gateway-standalone
- **GitHub**: https://github.com/3280382/pi-gateway-standalone
- **Type**: Web gateway for Pi Coding Agent (React + Node.js)

## Language Standards

**All project documentation and code must be written in English.** This includes:
- All documentation files (README, DEVELOPMENT, FEATURES, CHANGELOG, AGENTS)
- Code comments and inline documentation
- Variable names, function names, and type definitions
- Commit messages and PR descriptions
- Test descriptions and output messages

This standard ensures the project is accessible to international contributors and maintains consistency across all development work.

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
# REQUIRED: Run full check before ANY commit
npm run check  # Fix all errors and warnings - NO EXCEPTIONS

# Commit format
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Examples:
feat(chat): add message search
fix(files): fix sidebar duplication
refactor(core): optimize initialization
```

### Code Quality Requirements (CRITICAL)

**AI assistants MUST complete ALL of the following before marking a task as complete:**

1. **Syntax Check**: Run `npm run check` and fix ALL errors and warnings
   - Biome linting errors must be resolved
   - TypeScript compilation must pass with `--noEmit`
   - No console errors or warnings allowed

2. **Functional Testing**: Verify the feature works correctly
   - Test the feature manually in the browser
   - Verify WebSocket connections work (if applicable)
   - Check both success and error scenarios

3. **Regression Testing**: Ensure no existing functionality is broken
   - Run `npm run test` for unit tests
   - Run `bash scripts/run-terminal-tests.sh` for integration tests
   - Verify all related features still work

4. **Commit Verification**: After committing, verify the changes
   - Review the diff with `git show HEAD`
   - Ensure commit message follows the format
   - Confirm version number with `git log --oneline -1`

**NEVER mark a task as complete with only syntax checking. Testing is MANDATORY.**

### Quick Verification Checklist

Before declaring a task complete, verify:
- [ ] `npm run check` passes with 0 errors and 0 warnings
- [ ] Feature works correctly in browser (manual test)
- [ ] No console errors in browser DevTools
- [ ] Related features still work (regression check)
- [ ] Unit tests pass (`npm run test`)
- [ ] Commit message follows `type(scope): subject` format
- [ ] Version number noted for user reference

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

**Unified Development and Test Environment (Recommended)**

```bash
# Tmux 3-pane mode - Start frontend, backend, and monitoring simultaneously
bash scripts/start-tmux-dev.sh
```

### Auto Monitoring and Hot Reload

Tmux mode is configured with automatic monitoring and hot reload:

| Component | Hot Reload Method | Description |
|-----------|-------------------|-------------|
| Backend | `tsx watch` auto-restart | Auto-restart after code changes |
| Frontend | Vite HMR hot update | Browser auto-refresh after code changes |

**Notes:**
- No manual restart needed under normal circumstances, changes take effect automatically
- Manual restart only required after adding new dependencies or modifying config files
- Development and testing use the same environment for consistency

### Restart Frontend/Backend Individually

Use `scripts/tmux-dev.sh` script to manage:

```bash
# Restart frontend only
bash scripts/tmux-dev.sh restart-frontend

# Restart backend only
bash scripts/tmux-dev.sh restart-backend

# Check status
bash scripts/tmux-dev.sh status

# Stop frontend
bash scripts/tmux-dev.sh stop-frontend

# Stop backend
bash scripts/tmux-dev.sh stop-backend

# Start frontend
bash scripts/tmux-dev.sh start-frontend

# Start backend
bash scripts/tmux-dev.sh start-backend
```

**Direct Command Method (tmux shortcuts):**

```bash
# After entering tmux, switch to the corresponding pane to restart

# Restart backend (pane 1)
tmux select-pane -t gateway-dev:0.1
tmux send-keys -t gateway-dev:0.1 C-c  # stop
tmux send-keys -t gateway-dev:0.1 'npm run dev' Enter  # start

# Restart frontend (pane 0)
tmux select-pane -t gateway-dev:0.0
tmux send-keys -t gateway-dev:0.0 C-c  # stop
tmux send-keys -t gateway-dev:0.0 'npm run dev:react' Enter  # start
```

### Code Check

```bash
npm run check  # Must run before committing
```

## Testing Standards

### Quick Testing Reference

| Command | Description |
|---------|-------------|
| `bash scripts/run-all-tests.sh` | Run all tests (recommended) |
| `bash scripts/run-terminal-tests.sh all` | Run terminal server + client tests |
| `bash scripts/run-terminal-tests.sh server` | Run server tests only |
| `bash scripts/run-terminal-tests.sh client` | Run browser tests only |
| `npm run test` | Run Vitest unit tests |
| `cat test-results/latest/summary.md` | View latest test report |

### Test Results Location

All test results are output to `test-results/<timestamp>/` directory:

```
test-results/latest/
├── summary.md           # Human-readable summary report
├── backend/
│   ├── server.log      # Backend service complete logs
│   └── test.log        # Backend test execution logs
├── frontend/
│   └── dev-server.log  # Frontend service logs
├── browser/
│   ├── test.log        # Playwright test logs
│   ├── console.log     # Browser console output
│   └── ws-messages.json # WebSocket message records
└── screenshots/
    └── *.png           # Test screenshots
```

### Test Output Standards (Important)

All tests must follow unified output standards to ensure results are human-readable, traceable, and backup-capable.

#### Test Results Directory Structure

```
test-results/
├── YYYY-MM-DD_HH-MM-SS/           # Independent directory for each test (timestamp named)
│   ├── summary.md                 # Human-readable test summary
│   ├── report.json                # Machine-readable complete report
│   ├── backend/
│   │   ├── server.log             # Backend complete runtime logs
│   │   └── test.log               # Backend test execution logs
│   ├── frontend/
│   │   ├── build.log              # Frontend build logs
│   │   └── dev-server.log         # Frontend dev server logs
│   ├── browser/
│   │   ├── console.log            # Browser console logs
│   │   ├── network.log            # Browser network request logs
│   │   └── ws-messages.json       # WebSocket message records
│   └── screenshots/
│       ├── 01-test-name.png       # Sequentially numbered screenshots
│       ├── 02-test-name.png
│       └── failed-*.png           # Failed test screenshots
└── latest -> YYYY-MM-DD_HH-MM-SS  # Symlink to latest results
```

#### Test Script Standards

Test scripts must implement the following automated processes, **no AI model intervention required**:

```bash
#!/bin/bash
# Test script template standard

set -e

# ========== 1. Configuration ==========
TEST_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
RESULTS_DIR="test-results/${TEST_TIMESTAMP}"
BACKUP_DIR="test-results/backups"

# ========== 2. Backup and Cleanup ==========
# Auto backup last test results
if [ -L "test-results/latest" ]; then
    LAST_RESULT=$(readlink test-results/latest)
    if [ -d "$LAST_RESULT" ]; then
        mkdir -p "$BACKUP_DIR"
        cp -r "$LAST_RESULT" "$BACKUP_DIR/$(basename $LAST_RESULT)"
        echo "Backed up last results: $BACKUP_DIR/$(basename $LAST_RESULT)"
    fi
fi

# Clean up old latest link
rm -f test-results/latest

# Create new results directory
mkdir -p "$RESULTS_DIR"/{backend,frontend,browser,screenshots}

# ========== 3. Start Services and Capture Logs ==========
# Backend log capture
npm run dev > "$RESULTS_DIR/backend/server.log" 2>&1 &
SERVER_PID=$!

# Frontend log capture
npm run dev:react > "$RESULTS_DIR/frontend/dev-server.log" 2>&1 &
FRONTEND_PID=$!

# Wait for services to start
sleep 5

# ========== 4. Execute Tests and Capture All Output ==========
npx playwright test \
    --reporter=html,json,line \
    --output="$RESULTS_DIR" \
    2>&1 | tee "$RESULTS_DIR/test-run.log"

TEST_EXIT_CODE=${PIPESTATUS[0]}

# ========== 5. Collect Browser Logs ==========
# Browser console logs (auto-collected by playwright to test-results/

# ========== 6. Generate Human-Readable Report ==========
cat > "$RESULTS_DIR/summary.md" << 'REPORT'
Test Report: ${TEST_TIMESTAMP}

[Summary]
- Test Time: $(date)
- Test Type: E2E / Unit / Integration
- Overall Result: Pass / Fail

[Statistics]
- Total Tests: X | Passed: X | Failed: X | Skipped: X
- Total Duration: X seconds

[Log File Locations]
- Backend Logs: backend/server.log
- Frontend Logs: frontend/dev-server.log
- Browser Console: browser/console.log
- Test Execution Logs: test-run.log

REPORT

# ========== 7. Update latest Link ==========
ln -sf "$RESULTS_DIR" test-results/latest

# ========== 8. Output Results Summary ==========
echo ""
echo "═══════════════════════════════════════════════════════"
echo "Testing Complete"
echo "═══════════════════════════════════════════════════════"
echo "Results Directory: $RESULTS_DIR"
echo "View Report: cat $RESULTS_DIR/summary.md"
echo "View Screenshots: ls $RESULTS_DIR/screenshots/"
echo ""

# Return test exit code
exit $TEST_EXIT_CODE
```

#### Available Test Commands

```bash
# Run all tests (auto backup, log collection, report generation)
bash scripts/run-all-tests.sh

# Run server tests only (headless, no browser)
bash scripts/run-terminal-tests.sh server

# Run client browser tests only
bash scripts/run-terminal-tests.sh client

# Run full E2E tests
npx playwright test test/e2e/

# Run unit tests
npm run test
```

#### Test Results Checklist

After test script runs, check if results directory contains:

- [ ] `summary.md` - Human-readable summary
- [ ] `report.json` - Detailed JSON report
- [ ] `backend/server.log` - Backend complete logs
- [ ] `frontend/dev-server.log` - Frontend service logs
- [ ] `browser/console.log` - Browser console output
- [ ] `browser/ws-messages.json` - WebSocket communication records
- [ ] `screenshots/*.png` - Key step screenshots (at least one per test)
- [ ] `latest` symlink pointing to current results

#### Test Automation Standards (No AI Intervention Required)

Test scripts have fully automated the following processes, **AI models should not repeat**:

```bash
# Script auto-handles (no AI operation needed)
1. Backup last test results to backups/ directory
2. Clean up old latest link
3. Create new timestamp directory structure
4. Start backend service and capture all output to backend/server.log
5. Start frontend service and capture all output to frontend/dev-server.log
6. Run tests and collect detailed execution logs
7. Capture browser console output to browser/console.log
8. Capture WebSocket messages to browser/ws-messages.json
9. Auto-screenshot and save to screenshots/ directory
10. Generate human-readable summary.md report
11. Update latest symlink
12. Output test statistics and results summary

# AI should NOT repeat
- Do not manually create test-results/ directory
- Do not manually copy log files
- Do not manually generate reports
- Do not manually backup old results
```

#### Diagnostic Process When Tests Fail

When tests fail, view logs in the following order:

```bash
# 1. View test summary
cat test-results/latest/summary.md

# 2. View server test logs
tail -100 test-results/latest/backend/test.log

# 3. View server runtime logs
tail -100 test-results/latest/backend/server.log

# 4. View browser test logs
tail -100 test-results/latest/browser/test.log

# 5. View browser console
cat test-results/latest/browser/console.log

# 6. View WebSocket messages
jq . test-results/latest/browser/ws-messages.json | head -50

# 7. View screenshots
ls -la test-results/latest/screenshots/
```

#### Test Backup Strategy

Automatic backup executed on each test run:

```bash
test-results/
├── backups/                       # Historical test result backups
│   ├── 2024-01-15_10-30-00/      # Backup for each test run
│   ├── 2024-01-15_09-15-00/
│   └── ...
├── 2024-01-15_11-00-00/          # Current test (latest)
│   └── ...
└── latest -> 2024-01-15_11-00-00 # Symlink to latest results
```

Retention Policy:
- Automatically keep last 10 test backups
- Manual cleanup: `rm -rf test-results/backups/*`
- View backups: `ls -lt test-results/backups/`

#### Playwright Test Configuration Standards

Test files must be configured with correct output:

```typescript
// test/example.test.ts
import { test, expect } from "@playwright/test";
import { mkdirSync, appendFileSync } from "node:fs";

const RESULTS_DIR = process.env.TEST_RESULTS_DIR || "test-results/latest";
mkdirSync(`${RESULTS_DIR}/browser`, { recursive: true });

const logFile = `${RESULTS_DIR}/browser/console.log`;

test.beforeEach(async ({ page }) => {
  // Capture all console output
  page.on("console", (msg) => {
    const logEntry = `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`;
    appendFileSync(logFile, logEntry);
  });
  
  // Capture WebSocket messages
  page.on("websocket", (ws) => {
    ws.on("framereceived", (data) => {
      appendFileSync(`${RESULTS_DIR}/browser/ws-messages.json`, 
        JSON.stringify({ type: "received", data, time: Date.now() }) + "\n");
    });
  });
});

test("example test", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ 
    path: `${RESULTS_DIR}/screenshots/01-example.png`,
    fullPage: true 
  });
  expect(await page.title()).toBe("Expected Title");
});
```

#### Environment Variables

Test scripts automatically set the following environment variables:

```bash
TEST_RESULTS_DIR=test-results/YYYY-MM-DD_HH-MM-SS
TEST_TIMESTAMP=YYYY-MM-DD_HH-MM-SS
TEST_LOG_LEVEL=debug|info|warn|error
TEST_BROWSER=chromium
TEST_PORT=3000+random
```

### Testing Best Practices

#### Writing New Test Files

Follow this template to ensure output standards:

```typescript
// test/my-feature.test.ts
import { test, expect } from "@playwright/test";
import { mkdirSync, appendFileSync, writeFileSync } from "node:fs";

// Use environment variable or default value
const RESULTS_DIR = process.env.TEST_RESULTS_DIR 
  || "/root/pi-gateway-standalone/test-results/latest";
const SCREENSHOTS_DIR = `${RESULTS_DIR}/screenshots`;
const LOG_DIR = `${RESULTS_DIR}/browser`;

// Ensure directories exist
mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });

// Log file
const LOG_FILE = `${LOG_DIR}/my-feature.log`;

function log(level: string, message: string) {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  console.log(entry.trim());
  appendFileSync(LOG_FILE, entry);
}

test.beforeEach(async ({ page }) => {
  // Capture console logs
  page.on("console", (msg) => {
    appendFileSync(`${LOG_DIR}/console.log`, 
      `[${msg.type()}] ${msg.text()}\n`);
  });
});

test("my feature test", async ({ page }) => {
  log("INFO", "Starting test");
  
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  
  // Screenshot - use sequential naming
  await page.screenshot({ 
    path: `${SCREENSHOTS_DIR}/01-my-feature.png`,
    fullPage: true 
  });
  
  // Test logic...
  
  log("INFO", "Test completed");
});
```

#### Test Naming Conventions

| Type | Naming Example | Location |
|------|----------------|----------|
| Unit Test | `*.test.ts` | `src/**/` or `test/unit/` |
| Integration Test | `*.test.ts` | `test/integration/` |
| E2E Test | `*.spec.ts` | `test/e2e/` |
| Terminal Test | `terminal-*.test.ts` | `test/` |

#### Screenshot Naming Conventions

```
screenshots/
├── 01-page-loaded.png          # Sequentially numbered
├── 02-terminal-opened.png
├── 03-command-executed.png
├── failed-invalid-state.png    # Failed state screenshot
└── error-modal-displayed.png   # Error case screenshot
```

#### Test Data Isolation

- Each test uses independent test data
- Clean up created resources after testing
- Use random ports to avoid conflicts
- Use temporary directories for test files

## Debugging Tips

1. **Frontend Hot Reload**: Vite auto-reloads
2. **Backend Hot Reload**: tsx watch auto-restarts
3. **WebSocket Debugging**: Browser DevTools Network WS tab
4. **View Logs**: `tail -f logs/backend_current.log`
5. **View Test Results**: `cat test-results/latest/summary.md`

## Prohibited Practices

- Direct fetch in components (use services/)
- Use Math.random() as key
- Directly modify arrays/objects (return new objects)
- Write business logic in components (extract to Hook)
- Put runtime logic in shared/

## Need Help?

If the answer is not in the documentation:
1. Check existing code for similar functionality
2. Check stores/ for relevant state
3. Check services/ for relevant APIs
4. Ask user to confirm requirements
