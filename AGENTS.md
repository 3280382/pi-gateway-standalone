# Pi Gateway Standalone - AI Assistant Guide

> **执行前，先判断。** (Judge before acting.)
> **This is the primary reference document for AI Coding Agents**. Read this first before starting any task.
  **You should prioritize reasoning through research, making direct modifications, reading code directly, and fixing bugs immediately upon discovery. Do not rely on extensive trial-and-error testing as your primary approach. Testing is only a means for final verification, not a method of thinking.**
## Language Standards

**All project documentation and code must be written in English.**

## First Message Rule

**If the user did not give a concrete task, ALWAYS read in parallel:**
1. `README.md` - Project overview
2. `DEVELOPMENT.md` - Development standards
3. `FEATURES.md` - Feature specification
4. `CHANGELOG.md` - Version history

Then ask which specific feature to work on.

## Key Constraints (Non-Violable)

```
client/  → Cannot import @server/*
server/  → Cannot import @client/*
shared/  → Types only (no runtime logic)
```

## Code Commit Standards

```bash
# AI 开发时运行（只报 errors，约 466 个可逐步修复）
npm run check

# 提交前只检查本次改动的文件（最常用，通常 0 errors）
npm run check:changed

# CI 严格检查（errors + warnings）
npm run check:ci

# Commit format
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Examples:
feat(chat): add message search
fix(files): fix sidebar duplication
```

## Code Quality Requirements (CRITICAL)

**AI assistants MUST complete ALL of the following before marking a task as complete:**

1. **Syntax Check**: Run `npm run check` and fix ALL errors
2. **Functional Testing**: Use Playwright to test UI changes - screenshots REQUIRED
3. **Regression Testing**: Run `npm run test` and `bash scripts/run-terminal-tests.sh`
4. **Commit Verification**: Review diff with `git show HEAD`

**NEVER mark a task as complete with only syntax checking.**

## Refactoring Requirements

**When user requests refactoring:**

1. **Scope Adherence**: Refactor ONLY within the specified scope. Do NOT expand the scope without explicit user approval.
2. **Behavior Preservation**: Do NOT modify existing business logic unless user explicitly requests changes.
3. **No Feature Changes**: Do NOT add new features or delete existing features. Refactoring is code structure improvement only.
4. **Full Regression Testing**: After refactoring, MUST run complete regression tests:
   - `npm run check`
   - `npm run test`
   - `bash scripts/run-terminal-tests.sh`
   - Playwright tests for affected areas

**Golden Rule**: Refactoring should change HOW code works internally, not WHAT it does externally.

## Development/Test Environment

**The tmux 3-pane mode is started by a human. AI assistants MUST NOT run `bash ./dev-start.sh`.**

When the development environment is active, use `scripts/dev-ctl.sh` to manage services:

```bash
# Restart frontend (tmux pane 0.0)
bash scripts/dev-ctl.sh restart-frontend

# Restart backend (tmux pane 0.1)
bash scripts/dev-ctl.sh restart-backend

# Check tmux, process, and port status
bash scripts/dev-ctl.sh status

# View logs (default last 50 lines)
bash scripts/dev-ctl.sh logs frontend
bash scripts/dev-ctl.sh logs backend 100
```

**Principles:**
- Frontend (Vite HMR) and Backend (tsx watch) auto-reload
- Do NOT start standalone servers
- If the tmux session is missing, ask the human to run `bash ./dev-start.sh`


## Testing Standards

### Script Execution Safety

**ALL operations with hang risks MUST have timeouts.**

#### Bash Commands
```bash
timeout 30s npm run check
timeout 60s npm run test
timeout 120s bash scripts/run-all-tests.sh
timeout 10s curl -s http://localhost:3000/api/health
```
**Rule of thumb:** If it can block, it must have a timeout.

### Test Script Management

**Temporary Test Scripts:**
- Place in `test/tmp/` directory
- Clean up after feature completion
- Consider merging useful tests into existing test suites

**Testing Workflow:**
1. **Prefer existing tests** - Check `scripts/run-all-tests.sh` and `scripts/run-terminal-tests.sh`
2. **Check existing logs first** - Review `logs/backend_current.log` and browser console
3. **Minimize temporary scripts** - Avoid duplicating logging/testing logic
4. **Maintain test completeness** - Ensure core features are covered by permanent tests

**Anti-patterns:**
- ❌ Creating many one-off test scripts with duplicate logging
- ❌ Re-implementing log collection that already exists
- ❌ Leaving temporary scripts scattered in root directory

### Quick Testing Reference

| Command | Description |
|---------|-------------|
| `bash scripts/run-all-tests.sh` | Run all tests |
| `bash scripts/run-terminal-tests.sh all` | Integration tests |
| `npm run test` | Unit tests |
| `cat test-results/latest/summary.md` | View test report |

### Headless Browser Testing (MANDATORY for UI Changes)

```bash
# Run browser tests
npx playwright test --config=playwright.mobile.config.ts

# Debug with visible browser
npx playwright test --config=playwright.mobile.config.ts --headed
```

**Testing Checklist:**
- [ ] Navigate to affected component
- [ ] Take screenshot for verification
- [ ] Verify no console errors
- [ ] Test responsive behavior if applicable

## Performance Debugging

### 1. Code Logic Review First
Before using tools, manually review:
- Unnecessary re-renders
- Expensive calculations in render paths
- Missing memoization
- Inefficient data structures

### 2. Systematic Performance Analysis

**Step 1: Reproduce with Headless Browser**
```bash
npx playwright test test/e2e/chat.spec.ts --config=playwright.mobile.config.ts
```
**Step 2: Add Performance Logging**
```typescript
// Client-side
console.time('functionName');
// ... logic
console.timeEnd('functionName');

// Server-side
const start = Date.now();
// ... logic
console.log(`[PERF] Handler took ${Date.now() - start}ms`);
```
**Step 3: Analyze Logs**
```bash
cat test-results/latest/browser/console.log
tail -100 test-results/latest/backend/server.log
jq '.[] | {type: .type, timestamp: .timestamp}' test-results/latest/browser/ws-messages.json
```

**Step 4: Identify Slow Functions**
- Look for functions taking >100ms
- Check for repeated expensive calls
- Find blocking operations in async contexts

**Step 5: Deep Dive If Nested**
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
- Write business logic in components (extract to Hook)
- Put runtime logic in `shared/`

## Debugging Tips

### Runtime Verification Principle

**When code review fails to find the bug:**

After extensive code reading and modification, if the bug persists, the issue is likely not in your logic but in:
- Environment differences
- Data state mismatches
- Hidden dependencies

**Rule: Trust only observed execution.**

Run the actual code. Inspect real data. Verify environment state. The bug lives in the gap between theory and reality—not in your understanding.

### Standard Checks

- **Frontend**: Vite auto-reloads, check DevTools
- **Backend**: tsx watch auto-restarts, check `logs/backend_current.log`
- **WebSocket**: Browser Network WS tab
- **Test Results**: `cat test-results/latest/summary.md`
