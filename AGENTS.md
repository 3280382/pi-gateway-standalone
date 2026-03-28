# Pi Gateway Standalone - Development Rules

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

```bash
# Check status
bash scripts/dev-status.sh
node scripts/tmux-controller.js status

# Restart services
node scripts/tmux-controller.js restart-frontend
node scripts/tmux-controller.js restart-backend

# Clear cache
node scripts/tmux-controller.js clear-cache

# Code check
npm run check
npm run typecheck
```

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
npm run check  # Fix all errors, warnings, infos
```

## Testing

```bash
npm test                 # Unit + Integration tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests
```

## Git

### Commit Message Format
```
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Example:
feat(chat): add message search
```

### Never commit unless user asks

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
