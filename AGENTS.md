# Pi Gateway Standalone - AI Assistant Guide

## Project Identification

- **Name**: pi-gateway-standalone
- **Location**: /root/pi-gateway-standalone
- **GitHub**: https://github.com/3280382/pi-gateway-standalone

## First Message Rule

If the user did not give a concrete task, **ALWAYS read in parallel**:
1. `README.md` - Project overview
2. `DEVELOPMENT.md` - Development guide
3. `FEATURES.md` - Feature specification

Then ask which specific feature to work on.

## Quick Reference

### Project Structure
See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed architecture and project structure.

### Development Rules
See [DEVELOPMENT.md](./DEVELOPMENT.md) for:
- Architecture principles
- Component development guidelines
- State management patterns
- Code style and naming conventions
- Performance optimization guidelines

### Key Constraints

| From | Cannot Import To |
|------|------------------|
| `client/` | `@server/*` |
| `server/` | `@client/*` |
| `shared/` | Runtime logic (types only) |

### Before Committing

```bash
npm run check  # Fix all errors, warnings
```

### Commit Format

```
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Example:
feat(chat): add message search
```

## Documentation

| Document | Purpose |
|----------|---------|
| [`README.md`](./README.md) | Quick start, project overview, architecture |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Detailed development guide, coding standards, API reference |
| [`FEATURES.md`](./FEATURES.md) | UI specification, feature list, workflows |
| [`CHANGELOG.md`](./CHANGELOG.md) | Version history and changes |
