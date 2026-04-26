# Pi Gateway Standalone - AI Assistant Guide

> **Judge before acting.**

## Language Standards

All documentation and code must be written in English.

## First Message Rule

If no concrete task is given, read these in parallel:
1. `README.md` - Project overview
2. `DEVELOPMENT.md` - Development standards
3. `FEATURES.md` - Feature specification
4. `CHANGELOG.md` - Version history

Then ask which specific feature to work on.

## Key Constraints

```
client/  → Cannot import @server/*
server/  → Cannot import @client/*
shared/  → Types only (no runtime logic)
```

## Code Commit Standards

```bash
# Required before any commit
npm run check

# Commit format
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore
```

> **⚠️ `git commit` hangs**: The pre-commit hook runs `npm run check` (~2s on 364 files).
> If output is empty for >5s, the hook is running. Use:
> ```bash
> timeout 10s git commit --no-verify -m "type(scope): subject"
> ```
> Only skip verify if `npm run check` was already run separately and passed.

## Code Quality Requirements

Complete ALL before marking a task as complete:

1. **Syntax Check**: Run `npm run check`, fix all errors
2. **Functional Testing**: Use Playwright with screenshots
3. **Regression Testing**: Run `npm run test` and `bash scripts/run-terminal-tests.sh`
4. **Commit Verification**: Review diff with `git show HEAD`

**Never mark complete with only syntax checking.**

## Refactoring Requirements

1. **Scope Adherence**: Refactor only within specified scope
2. **Behavior Preservation**: Do not modify business logic unless explicitly requested
3. **No Feature Changes**: Do not add/delete features
4. **Full Regression Testing**: After refactoring, run:
   - `npm run check`
   - `npm run test`
   - `bash scripts/run-terminal-tests.sh`
   - Playwright tests for affected areas

**Golden Rule**: Refactoring changes HOW code works internally, not WHAT it does externally.

## Development Environment

Use `scripts/dev.sh` to manage services:

```bash
bash scripts/dev.sh start          # Start backend + frontend
bash scripts/dev.sh status         # Check service status
bash scripts/dev.sh restart-backend   # Restart backend
bash scripts/dev.sh restart-frontend  # Restart frontend
bash scripts/dev.sh logs backend      # View backend logs
bash scripts/dev.sh logs frontend     # View frontend logs
bash scripts/dev.sh stop           # Stop all services
```

**Principles:**
- Frontend (Vite HMR) and Backend (tsx watch) auto-reload
- Do NOT start standalone servers
- Do NOT kill processes on ports 3000/5173

## Testing Standards

### Script Execution Safety

All operations with hang risks MUST have timeouts:

```bash
timeout 30s npm run check
timeout 60s npm run test
timeout 120s bash scripts/run-all-tests.sh
timeout 10s curl -s http://localhost:3000/api/health
```

### Test Script Management

**Temporary scripts:**
- Place in `test/tmp/`
- Clean up after completion
- Merge useful tests into existing suites

**Environment**: All testing uses the shared development environment.
- Backend runs on port 3000, frontend on port 5173
- Do NOT start separate test servers
- Do NOT kill processes on ports 3000/5173

**Anti-patterns:**
- Creating one-off test scripts with duplicate logging
- Killing processes on ports 3000/5173
- Starting standalone test servers on alternate ports

### Quick Testing Reference

| Command | Description |
|---------|-------------|
| `bash scripts/run-all-tests.sh` | Run all tests |
| `bash scripts/run-terminal-tests.sh all` | Integration tests |
| `npm run test` | Unit tests |
| `cat logs/test/latest/summary.md` | View test report |

### Headless Browser Testing

**Config note:** `playwright.mobile.config.ts` uses `testMatch: "*-dev.test.ts"`. Test files must match this pattern.

```bash
npx playwright test --config=playwright.mobile.config.ts
npx playwright test --config=playwright.mobile.config.ts --headed
```

**Quick ad-hoc check** (no test file needed, catches browser-side JS errors immediately):

```ts
// test/tmp/check.ts — run with: npx tsx test/tmp/check.ts
import { chromium } from "playwright";
const page = await (await chromium.launch()).newPage();
page.on("pageerror", (e) => console.error("[PAGE]", e.message));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.screenshot({ path: "test/tmp/shot.png" });
```

**Checklist:**
- [ ] Navigate to affected component
- [ ] Take screenshot for verification
- [ ] Verify no console errors

## Performance Debugging

### 1. Code Logic Review First

Manually review:
- Unnecessary re-renders
- Expensive calculations in render paths
- Missing memoization
- Inefficient data structures

### 2. Systematic Performance Analysis

**Step 1: Reproduce**
```bash
npx playwright test test/e2e/chat.spec.ts --config=playwright.mobile.config.ts
```

**Step 2: Add Logging**
```typescript
console.time('functionName');
console.timeEnd('functionName');

const start = Date.now();
console.log(`[PERF] ${Date.now() - start}ms`);
```

**Step 3: Analyze Logs**
```bash
cat logs/test/browser/console.log
tail -100 logs/dev/backend_current.log
jq '.[] | {type, timestamp}' logs/test/browser/ws-messages.json
```

**Step 4: Identify Slow Functions**
- Functions taking >100ms
- Repeated expensive calls
- Blocking operations in async contexts

**Step 5: Deep Dive**
If slow function has sub-calls, repeat the analysis flow for sub-calls.

### Common Performance Issues

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| UI freezing | RAF batching too large | Reduce batch size |
| Memory growing | Event listeners not cleaned | Add unsubscribe |
| Slow initial load | Large bundle/data fetching | Code split, lazy load |
| Laggy scrolling | Too many DOM nodes | Virtualize list |

## Prohibited Practices

- Direct `fetch` in components (use services/)
- `Math.random()` as React key
- Directly modify arrays/objects in state
- Write business logic in components
- Put runtime logic in `shared/`

## Debugging Tips

### Runtime Verification Principle

When code review fails to find the bug, the issue is likely not in your logic but in:
- Environment differences
- Data state mismatches
- Hidden dependencies

**Trust only observed execution.** Run the code, inspect real data, verify environment state.

### Standard Checks

- **Frontend**: Vite auto-reloads, check DevTools
- **Backend**: tsx watch auto-restarts, check `logs/dev/backend_current.log`
- **WebSocket**: Browser Network WS tab
- **Test Results**: `cat logs/test/latest/summary.md`
