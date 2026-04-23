# Pi Gateway Testing Guide

> Comprehensive testing standards, environment setup, and coding guidelines for the Pi Gateway project.

## Table of Contents

1. [Testing Environment Overview](#1-testing-environment-overview)
2. [Testing Tools & Configuration](#2-testing-tools--configuration)
3. [Test Code Standards](#3-test-code-standards)
4. [Test Classification & Strategy](#4-test-classification--strategy)
5. [Writing Tests](#5-writing-tests)
6. [Running Tests](#6-running-tests)
7. [CI/CD Integration](#7-cicd-integration)

---

## 1. Testing Environment Overview

### Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Testing | Vitest | Fast unit tests with jsdom environment |
| Component Testing | Vitest + `@testing-library/react` | React component rendering and interaction |
| Integration Testing | Vitest + real server | API endpoint and WebSocket testing |
| E2E Testing | Playwright | Full browser automation tests |
| Mocking | Vitest `vi` | Module and function mocking |

### Project Test Structure

```
test/
├── setup.ts                    # Vitest setup (mocks, cleanup)
├── setup-server.ts             # Global server startup for integration tests
├── lib/
│   └── test-utils.ts           # TestLogger, TestReporter, TestWebSocketClient
├── unit/                       # Pure unit tests (no environment dependencies)
│   ├── chat/
│   ├── server/
│   ├── client/
│   ├── tools/
│   └── models/                 # NOTE: removed - models no longer exist
├── integration/                # Integration tests (requires running server)
│   ├── api/
│   └── features/
└── e2e/                        # Playwright E2E tests

src/
├── client/.../*.test.ts(x)     # Co-located client tests
└── server/.../*.test.ts        # Co-located server tests
```

### Key Configuration Files

- `vitest.config.ts` — Vitest configuration with jsdom, aliases, and include/exclude patterns
- `playwright.config.ts` — Playwright desktop configuration
- `playwright.mobile.config.ts` — Playwright mobile (iPhone) configuration

---

## 2. Testing Tools & Configuration

### Vitest Configuration

```typescript
// vitest.config.ts highlights
{
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globalSetup: ["./test/setup-server.ts"], // Shared test server on port 3456
    maxWorkers: 1,
    minWorkers: 1,
    sequence: { concurrent: false },
  }
}
```

**Important:** Integration tests rely on a shared server started by `globalSetup`. Do NOT start individual servers in each test file.

### Playwright Configuration

- Desktop: `playwright.config.ts` — tests against `http://127.0.0.1:3002`
- Mobile: `playwright.mobile.config.ts` — iPhone 14 Pro viewport (393×852)

### Test Utilities

Use `test/lib/test-utils.ts` for consistent logging and reporting:

```typescript
import { TestLogger, TestReporter } from "@test/lib/test-utils";

const logger = new TestLogger("my-component");
const reporter = new TestReporter("my-component");

it("does something", async () => {
  await reporter.runTest("test name", async () => {
    // test body
  });
});
```

---

## 3. Test Code Standards

### Naming Conventions

```typescript
// File naming
ComponentName.test.tsx       // React component tests
moduleName.test.ts           // Utility/module tests
feature.integration.test.ts  // Integration tests

// Describe blocks
describe("ModuleName", () => {           // Top-level: module/feature
describe("functionName", () => {         // Second-level: function/component
describe("edge cases", () => {           // Third-level: scenario category

// Test names
it("should [expected behavior] when [condition]", () => {});
it("returns correct result for valid input", () => {});
it("throws error for invalid path", () => {});
```

### Code Style

```typescript
import { describe, expect, it, vi } from "vitest";

// Pure function test — no mocks needed
describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [1024, "1.0 KB"],
    [1048576, "1.0 MB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

// Mock-based test
describe("apiClient", () => {
  it("fetches data successfully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: "test" }),
    });

    const result = await apiClient.fetchData();
    expect(result).toEqual({ data: "test" });
  });
});
```

### Required Test Patterns

| Pattern | When to Use |
|---------|-------------|
| `it.each` | Testing pure functions with multiple inputs/outputs |
| `beforeEach` | Resetting shared state between tests |
| `vi.mock` | Mocking external modules (fs, ws, etc.) |
| `vi.fn()` | Mocking functions and tracking calls |
| `async/await` | All async operations (API calls, timers) |

### Anti-Patterns

- ❌ Do NOT start a new server in every integration test file (use globalSetup)
- ❌ Do NOT use `Math.random()` without seeding in tests
- ❌ Do NOT test implementation details — test behavior
- ❌ Do NOT leave `console.log` in committed tests (use TestLogger)
- ❌ Do NOT test third-party libraries

---

## 4. Test Classification & Strategy

### 4.1 Pure Unit Tests (No Mocks, No Environment)

**Definition:** Functions that take input, return output, with no side effects and no external dependencies.

**Strategy:** Direct invocation with `it.each` for parameterization.

| Module | Functions | Location |
|--------|-----------|----------|
| `server/features/chat/agent-session/utils.ts` | `encodeCwd`, `expandPath`, `safeFileName`, `extractSessionIdFromPath` | `src/server/features/chat/agent-session/utils.test.ts` |
| `server/features/files/utils.ts` | `getExtension`, `getMimeType`, `isHighlightable`, `isBinaryFile`, `formatFileSize`, `formatTimeAgo` | `src/server/features/files/utils.test.ts` |
| `server/lib/errors.ts` | `ApiError`, `NotFoundError`, `ValidationError`, `ErrorFactory` | `src/server/lib/errors.test.ts` |
| `client/features/chat/utils/sessionUtils.ts` | `extractShortSessionId`, `formatSessionId` | `src/client/features/chat/utils/sessionUtils.test.ts` |
| `client/lib/formatters.ts` | `formatFileSize`, `formatDate`, `formatTimeAgo`, `formatPath`, `truncateText`, `getFileExtension` | `src/client/lib/formatters.test.ts` |
| `client/features/chat/utils/messageUtils.ts` | `normalizeContent`, `normalizeContentItem`, `normalizeSessionMessages` | `src/client/features/chat/utils/messageUtils.test.ts` |
| `client/features/chat/services/messageReconstruction.ts` | `MessageReconstructor`, `isContentDeltaEvent`, `getContentTypeFromDelta` | `src/client/features/chat/services/messageReconstruction.test.ts` |
| `server/features/chat/session-processor.ts` | `processSessionEntries` | `src/server/features/chat/session-processor.test.ts` |

### 4.2 Mock-Based Unit Tests

**Definition:** Code with external dependencies that can be mocked (fs, WebSocket, HTTP, databases).

**Strategy:** Use `vi.mock()` for modules, `vi.fn()` for functions.

| Module | Dependencies to Mock | Location |
|--------|---------------------|----------|
| `server/features/chat/ws-handlers/handler-utils.ts` | `WSContext.ws.send` | `src/server/features/chat/ws-handlers/handler-utils.test.ts` |
| `server/features/chat/llm/log-manager.ts` | `node:fs`, `node:fs/promises` | `src/server/features/chat/llm/log-manager.test.ts` |
| `client/services/websocket.client.ts` | `WebSocket`, `fetch` | `src/client/services/websocket.client.test.ts` (exists) |
| Client stores (Zustand) | `zustand/middleware` persist | `src/client/features/*/stores/*.test.ts` (exists) |

### 4.3 Integration Tests

**Definition:** Tests requiring a running server instance or real filesystem.

**Strategy:** Use `test/setup-server.ts` globalSetup. Do NOT spawn servers per file.

| Feature | Endpoints/Flows | Location |
|---------|----------------|----------|
| REST API | `/api/files/file/*`, `/api/models`, `/api/sessions` | `test/integration/api/` |
| File Browser | Browse, content, tree, raw | `test/integration/features/file-browser.test.ts` |
| Session Loading | Load, list, switch | `test/integration/features/session-load.test.ts` |
| WebSocket | init, prompt, abort, change_dir | `test/integration/comprehensive.test.ts` |

### 4.4 E2E Tests

**Definition:** Full browser automation testing user workflows.

**Strategy:** Use Playwright with page objects.

| Feature | Scenarios | Config |
|---------|-----------|--------|
| Chat UI | Message input, streaming, tool display | `playwright.config.ts` |
| File Browser | Navigation, preview, tree view | `playwright.config.ts` |
| Mobile Layout | Sidebar, responsive breakpoints | `playwright.mobile.config.ts` |

---

## 5. Writing Tests

### 5.1 Pure Function Template

```typescript
import { describe, expect, it } from "vitest";
import { myFunction } from "./myModule";

describe("myFunction", () => {
  describe("normal cases", () => {
    it.each([
      { input: "a", expected: "A" },
      { input: "b", expected: "B" },
    ])("converts $input to $expected", ({ input, expected }) => {
      expect(myFunction(input)).toBe(expected);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(myFunction("")).toBe("");
    });

    it("handles null/undefined", () => {
      expect(myFunction(null as any)).toBe("");
    });
  });
});
```

### 5.2 Mock-Based Test Template

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
import { myModuleFunction } from "./myModule";

describe("myModuleFunction", () => {
  it("returns false when file does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(myModuleFunction("/missing")).toBe(false);
  });
});
```

### 5.3 Component Test Template

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders with default props", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

---

## 6. Running Tests

### Commands

```bash
# Unit + Integration tests (Vitest)
npm run test

# Single file
npx vitest run src/server/features/files/utils.test.ts

# Watch mode
npx vitest src/server/features/files/utils.test.ts

# E2E tests (Playwright)
npx playwright test --config=playwright.config.ts

# Mobile E2E
npx playwright test --config=playwright.mobile.config.ts

# All tests
bash scripts/run-all-tests.sh
bash scripts/run-terminal-tests.sh
```

### Interpreting Results

Results are saved to `logs/test/latest/`:

```
logs/test/latest/
├── summary.md
├── vitest/
│   └── report.json
├── backend/
│   └── server.log
├── browser/
│   ├── console.log
│   └── ws-messages.json
└── screenshots/
```

---

## 7. CI/CD Integration

### Pre-Commit Checklist

```bash
# 1. Syntax check
npm run check

# 2. Unit tests
npm run test

# 3. E2E tests (if environment is running)
npx playwright test --config=playwright.config.ts
```

### GitHub Actions Matrix

| Job | Command | Time |
|-----|---------|------|
| Lint + TypeCheck | `npm run check:ci` | ~30s |
| Unit Tests | `npm run test` | ~60s |
| E2E Tests | `npx playwright test` | ~120s |

---

## Appendix: Test Coverage Assessment

### Already Covered (✅)

- `src/client/features/chat/stores/chatStore.test.ts` — 17 tests
- `src/client/features/chat/stores/modalStore.test.ts` — 10 tests
- `src/client/features/chat/stores/llmLogStore.test.ts` — 9 tests
- `src/client/features/files/stores/fileStore.test.ts` — 25 tests
- `src/client/features/chat/services/api/chatApi.test.ts` — 14 tests
- `src/client/services/websocket.client.test.ts` — 10 tests
- `test/unit/chat/filter-messages.test.ts` — 20 tests
- `test/unit/tools/tool-display-dom.test.ts` — 5 tests
- Server controllers (file, git, workspace) — co-located tests

### Needs Coverage (⚠️)

- Pure utilities in `server/features/chat/agent-session/utils.ts`
- Pure utilities in `server/features/files/utils.ts`
- Error classes in `server/lib/errors.ts`
- Session processor in `server/features/chat/session-processor.ts`
- Client formatters in `client/lib/formatters.ts`
- Message utilities in `client/features/chat/utils/messageUtils.ts`
- Message reconstruction in `client/features/chat/services/messageReconstruction.ts`
- WebSocket handler utilities in `server/features/chat/ws-handlers/handler-utils.ts`
- LLM log manager in `server/features/chat/llm/log-manager.ts`

### To Remove/Fix (❌)

- `test/unit/models/file.model.test.ts` — references deleted `src/client/models/file.model`
- `test/unit/models/message.model.test.ts` — references deleted `src/client/models/message.model`
- `test/integration/api/api.test.ts` — routes outdated (`/api/browse` → `/api/files/file/browse`)
